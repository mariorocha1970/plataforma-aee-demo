import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { narrativa: { type: "string" } },
  required: ["narrativa"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text").map((item: any) => item?.text ?? "").join("");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "A API da OpenAI não está configurada." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    const field = body?.field;
    const evidence = Array.isArray(body?.evidence) ? body.evidence.slice(0, 40) : [];
    if (!field?.name || !evidence.length) return NextResponse.json({ ok: false, error: "O campo não contém evidências validadas." }, { status: 400 });

    const compactEvidence = evidence.map((item: any, index: number) => ({
      id: index + 1,
      afirmacao: String(item?.claim || "").slice(0, 900),
      fonte: String(item?.source || "").slice(0, 180),
      tipo: String(item?.sourceType || ""),
      localizacao: String(item?.location || "").slice(0, 180),
      estado: String(item?.status || ""),
      robustez: String(item?.strength || ""),
    }));
    const prompt = `Produza uma síntese de triangulação para Avaliação Externa das Escolas, em português europeu.

CAMPO: ${field.section} — ${field.name}
DOMÍNIO: ${field.domain}
REFERENTES: ${(Array.isArray(field.referents) ? field.referents : []).join("; ")}

EVIDÊNCIAS VALIDADAS:
${JSON.stringify(compactEvidence)}

REGRAS:
- Cruze semanticamente as fontes; não se limite a enumerá-las.
- Distinga fontes independentes de mera repetição e documento normativo de prática comprovada.
- Distinga intenção, prática, monitorização, resultado e impacto.
- Identifique convergências, divergências, contradições e lacunas.
- Uma entrevista exprime informação testemunhal e não comprova isoladamente um facto.
- Não transforme ausência de evidência em evidência de ausência.
- Não invente dados, frequência, causalidade ou representatividade.
- Redija 1 a 3 parágrafos contínuos, claros e sóbrios, sem citar nomes de ficheiros ou páginas no corpo.
- Termine com uma reserva proporcional quando a base probatória não permita demonstrar alcance, regularidade, resultados ou impacto.
- Não formule uma classificação global nem use linguagem promocional.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TRIANGULATION_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 1_800,
        text: { format: { type: "json_schema", name: "triangulacao_campo_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a triangulação." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu uma triangulação utilizável. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. Não houve repetição automática paga." }, { status: 502 }); }
    return NextResponse.json({ ok: true, narrative: String(result?.narrativa || "").trim() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na triangulação." }, { status: 500 });
  }
}
