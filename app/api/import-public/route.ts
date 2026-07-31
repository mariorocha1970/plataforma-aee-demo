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

function splitSetCookies(headers: Headers) {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  const raw = values.length ? values : headers.get("set-cookie") ? [headers.get("set-cookie") as string] : [];
  return raw.map((value) => value.split(";", 1)[0]).filter(Boolean);
}

function infoEscolasPayload(html: string, sourceUrl: string) {
  if (!/infoescolas\.medu\.pt/i.test(sourceUrl) || !/google\.visualization\.DataTable/.test(html)) return null;
  const clean = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&ordm;|&#186;/gi, "º").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
  const titleMap = new Map<string, string>();
  for (const match of html.matchAll(/id=['"]DivTit(\d+)['"][^>]*>([\s\S]*?)(?:<span\b|<\/div>)/gi)) titleMap.set(match[1], clean(match[2]));
  const school = clean(html.match(/class=['"]titEstCur['"][^>]*>([\s\S]*?)(?:<br|<\/td>)/i)?.[1] ?? "InfoEscolas");
  const records: Array<{ indicator: string; value: string; context: string; location: string }> = [];
  const functions = [...html.matchAll(/function\s+drawChart\d+\(\)\s*\{([\s\S]*?)(?=google\.setOnLoadCallback\(drawChart\d+\)|<\/script>)/g)];
  for (const functionMatch of functions) {
    const block = functionMatch[1];
    const chartId = block.match(/getElementById\(['"]DivChart(\d+)['"]\)/)?.[1];
    const title = chartId ? titleMap.get(chartId) : undefined;
    const rowsLiteral = block.match(/data\.addRows\((\[[\s\S]*?\])\);/)?.[1];
    if (!title || !rowsLiteral) continue;
    const columns = [...block.matchAll(/data\.addColumn\(['"](?:string|number)['"],\s*['"]([^'"]+)['"]\)/g)].map((item) => clean(item[1]));
    const rows = [...rowsLiteral.matchAll(/\[([^\[\]]*)\]/g)].map((row) => {
      const cells: Array<string | number | null> = [];
      const token = /\s*(?:'((?:\\.|[^'])*)'|"((?:\\.|[^"])*)"|([^,]*))\s*(?:,|$)/g;
      let item: RegExpExecArray | null;
      while ((item = token.exec(row[1])) && cells.length < columns.length) {
        const raw = item[1] ?? item[2] ?? item[3]?.trim() ?? "";
        if (item[1] !== undefined || item[2] !== undefined) cells.push(raw.replace(/\\'/g, "'").replace(/\\n/g, " "));
        else cells.push(raw === "" ? null : Number(raw));
        if (item[0] === "") break;
      }
      return cells;
    });
    rows.forEach((row) => {
      const period = String(row[0] ?? "Observação");
      const sampleColumn = columns.findIndex((column) => /numero alunos amostra/i.test(column));
      const sample = sampleColumn > 0 && typeof row[sampleColumn] === "number" ? `; amostra=${row[sampleColumn]}` : "";
      for (let index = 1; index < Math.min(columns.length, row.length); index += 1) {
        const column = columns[index];
        const numeric = row[index];
        if (typeof numeric !== "number" || !Number.isFinite(numeric) || /balanco|numero alunos amostra/i.test(column)) continue;
        let value = numeric;
        let suffix = "";
        const isEquity = /indicador de equidade/i.test(title);
        const isPercentage = !isEquity && (/^perc\d*$/i.test(column) || /taxa|percentagem/i.test(title) || (/distribui[cç][aã]o.*sexo/i.test(title) && Math.abs(numeric) <= 1));
        if (isPercentage) { value = Math.abs(numeric) <= 1 ? numeric * 100 : numeric; suffix = "%"; }
        else if (isEquity) suffix = " p.p.";
        const displayColumn = column.replace(/^Perc(\d)$/i, "$1.º ano").replace(/Media Nacional/gi, "Média nacional");
        const formatted = Number(value.toFixed(2)).toLocaleString("pt-PT", { maximumFractionDigits: 2 });
        records.push({
          indicator: `${title} — ${displayColumn}`,
          value: `${formatted}${suffix}`,
          context: `${school}; período/categoria=${period}; série=${displayColumn}; valor=${formatted}${suffix}${sample}`,
          location: `${title} · ${period}`,
        });
      }
    });
  }
  return records.length ? { kind: "infoescolas", school, sourceUrl, records } : null;
}

function declaredCharset(contentType: string) {
  return contentType.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]?.trim().toLowerCase() || "";
}

function decodeText(bytes: ArrayBuffer, contentType: string) {
  const raw = new Uint8Array(bytes);
  const bom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf ? "utf-8"
    : raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe ? "utf-16le"
    : raw.length >= 2 && raw[0] === 0xfe && raw[1] === 0xff ? "utf-16be"
    : "";
  const declared = declaredCharset(contentType);
  const candidates = [...new Set([bom, declared, "utf-8", "windows-1252", "iso-8859-1"].filter(Boolean))];
  let best = "";
  let bestScore = Number.POSITIVE_INFINITY;
  for (const charset of candidates) {
    try {
      const decoded = new TextDecoder(charset, { fatal: false }).decode(raw);
      const replacements = (decoded.match(/\uFFFD/g) ?? []).length;
      const mojibake = (decoded.match(/(?:Ã.|Â.|â€|ï¿½)/g) ?? []).length;
      const score = replacements * 100 + mojibake * 10;
      if (score < bestScore) { best = decoded; bestScore = score; }
      if (score === 0) break;
    } catch { /* tenta a codificação seguinte */ }
  }
  return best || new TextDecoder("utf-8").decode(raw);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { url?: unknown } | null;
    if (typeof body?.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "Indique um endereço público válido." }, { status: 400 });

    let current = await assertPublicUrl(body.url.trim());
    let response: Response | null = null;
    const cookies = new Map<string, string>();
    const cookieHost = current.hostname.toLowerCase();
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      response = await fetch(current.toString(), {
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
        headers: { "User-Agent": "Plataforma-AEE/1.0 (+public-data-import)", Accept: "text/html,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain;q=0.9,*/*;q=0.5", ...(cookies.size && current.hostname.toLowerCase() === cookieHost ? { Cookie: [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ") } : {}) },
      });
      if (current.hostname.toLowerCase() === cookieHost) splitSetCookies(response.headers).forEach((cookie) => { const separator = cookie.indexOf("="); if (separator > 0) cookies.set(cookie.slice(0, separator), cookie.slice(separator + 1)); });
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

    const originalContentType = response.headers.get("content-type") || "application/octet-stream";
    const contentType = originalContentType.split(";")[0].trim();
    if (contentType.includes("html") || contentType.startsWith("text/")) {
      const decoded = decodeText(bytes, originalContentType);
      const infoEscolas = infoEscolasPayload(decoded, current.toString());
      if (infoEscolas) return NextResponse.json(infoEscolas, { headers: { "Cache-Control": "no-store", "X-Source-URL": current.toString(), "X-Source-Filename": encodeURIComponent("InfoEscolas.json") } });
      bytes = new TextEncoder().encode(removeExecutableHtml(decoded)).buffer;
    }
    const filename = sourceFilename(current, response.headers.get("content-disposition"));
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("text/") ? `${contentType}; charset=utf-8` : contentType,
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
