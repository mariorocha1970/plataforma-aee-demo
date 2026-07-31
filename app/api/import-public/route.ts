import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

function addressIsPrivate(address: string) {
  const family = isIP(address);
  return family === 4 ? isPrivateIpv4(address) : family === 6 ? isPrivateIpv6(address) : true;
}

async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Utilize um endereço HTTP ou HTTPS.");
  if (url.username || url.password) throw new Error("O endereço não pode incluir credenciais.");
  if ((url.protocol === "https:" && url.port && url.port !== "443") || (url.protocol === "http:" && url.port && url.port !== "80")) throw new Error("O endereço utiliza uma porta não permitida.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("O endereço indicado não é público.");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => addressIsPrivate(entry.address))) throw new Error("O endereço indicado resolve para uma rede local ou privada.");
  return url;
}

function sourceFilename(url: URL, disposition: string | null) {
  const encoded = disposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = disposition?.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = encoded ? decodeURIComponent(encoded) : plain || decodeURIComponent(url.pathname.split("/").pop() || "recurso-publico");
  return candidate.replace(/[\r\n]/g, "").slice(0, 180) || "recurso-publico";
}

function removeExecutableHtml(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<script\b[^>]*\/?\s*>/gi, " ")
    .replace(/\s(?:on\w+|srcdoc)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, " ");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    if (typeof body?.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "Indique um endereço público válido." }, { status: 400 });

    let current = await assertPublicUrl(body.url.trim());
    let response: Response | null = null;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      response = await fetch(current.toString(), {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "Plataforma-AEE/1.0 (+public-data-import)", Accept: "text/html,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain;q=0.9,*/*;q=0.5" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("O portal devolveu um redirecionamento sem destino.");
      if (redirect === MAX_REDIRECTS) throw new Error("O endereço contém demasiados redirecionamentos.");
      current = await assertPublicUrl(new URL(location, current).toString());
    }

    if (!response?.ok) return NextResponse.json({ error: `O portal recusou a leitura (estado ${response?.status || 502}).` }, { status: response?.status && response.status >= 400 && response.status < 600 ? response.status : 502 });
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > MAX_BYTES) return NextResponse.json({ error: "O recurso excede o limite de 20 MB. Descarregue-o e carregue-o como ficheiro local." }, { status: 413 });
    let bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_BYTES) return NextResponse.json({ error: "O recurso excede o limite de 20 MB. Descarregue-o e carregue-o como ficheiro local." }, { status: 413 });
    if (!bytes.byteLength) return NextResponse.json({ error: "O portal devolveu uma resposta vazia." }, { status: 422 });

    const contentType = (response.headers.get("content-type") || "application/octet-stream").split(";")[0].trim();
    if (contentType.includes("html")) {
      const decoded = new TextDecoder("utf-8").decode(bytes);
      bytes = new TextEncoder().encode(removeExecutableHtml(decoded)).buffer;
    }
    const filename = sourceFilename(current, response.headers.get("content-disposition"));
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Source-URL": current.toString(),
        "X-Source-Filename": encodeURIComponent(filename),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler o endereço público.";
    const friendly = /timeout|aborted/i.test(message) ? "O portal demorou demasiado tempo a responder." : message;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
