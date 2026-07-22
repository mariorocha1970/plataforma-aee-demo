import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { relatorio: { type: "string" } },
  required: ["relatorio"],
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
    const narratives = Array.isArray(body?.narratives) ? body.narratives.slice(0, 12) : [];
    if (!narratives.length) return NextResponse.json({ ok: false, error: "Não existem triangulações revistas para redigir o relatório." }, { status: 400 });
    const schoolName = String(body?.schoolName || "a organização escolar").slice(0, 180);
    const localDraft = String(body?.localDraft || "").slice(0, 40_000);
    const prompt = `Aprimore a minuta de um relatório de Avaliação Externa das Escolas, em português europeu, relativa a ${schoolName}.

TRIANGULAÇÕES REVISTAS POR CAMPO:
${JSON.stringify(narratives)}

MINUTA LOCAL A PRESERVAR COMO ESTRUTURA:
---
${localDraft}
---

REGRAS:
- Preserve rigorosamente a organização pelos domínios e campos 5.1.1 a 5.4.3 presentes na minuta.
- Redija texto contínuo, claro, conciso e avaliativo, sem listas de evidências.
- Preserve o sentido e as reservas das triangulações; não acrescente factos, causalidade ou classificações.
- Distinga intenção, prática, monitorização, resultado e impacto.
- Não apresente perceções isoladas como factos comprovados.
- Não cite nomes de ficheiros, páginas ou identificadores no corpo do relatório.
- Evite repetições, generalizações e linguagem promocional.
- Mantenha a indicação de minuta sujeita a validação humana.
- Devolva apenas o relatório integral.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 5_000,
        text: { format: { type: "json_schema", name: "relatorio_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a redação." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu um relatório utilizável. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. A minuta local foi preservada e não houve repetição automática paga." }, { status: 502 }); }
    return NextResponse.json({ ok: true, report: String(result?.relatorio || "").trim() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na redação do relatório." }, { status: 500 });
  }
}
