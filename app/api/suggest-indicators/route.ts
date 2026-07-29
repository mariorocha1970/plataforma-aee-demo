import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sugestoes: {
      type: "array",
      maxItems: 300,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          evidencia_id: { type: "number" },
          indicador_id: { type: "string" },
          justificacao: { type: "string" },
          confianca: { type: "string", enum: ["Alta", "Média"] },
        },
        required: ["evidencia_id", "indicador_id", "justificacao", "confianca"],
      },
    },
  },
  required: ["sugestoes"],
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
    const fields = Array.isArray(body?.fields) ? body.fields.slice(0, 12) : body?.field ? [body.field] : [];
    const evidence = Array.isArray(body?.evidence) ? body.evidence.slice(0, 160) : [];
    const indicators = (Array.isArray(body?.indicators) ? body.indicators : [])
      .filter((item: any) => item?.applicability !== "Não aplicável")
      .slice(0, 180);
    if (!fields.length || !evidence.length || !indicators.length) {
      return NextResponse.json({ ok: false, error: "Não existem evidências validadas ou indicadores aplicáveis para analisar." }, { status: 400 });
    }

    const compactEvidence = evidence.map((item: any) => ({
      id: Number(item?.id),
      campo_id: String(item?.fieldId || ""),
      afirmacao: String(item?.claim || "").slice(0, 1_000),
      fonte: String(item?.source || "").slice(0, 180),
      tipo: String(item?.sourceType || ""),
      localizacao: String(item?.location || "").slice(0, 180),
      estado: String(item?.status || ""),
      robustez: String(item?.strength || ""),
      indicadores_ja_confirmados: Array.isArray(item?.indicatorIds) ? item.indicatorIds : [],
    }));
    const compactIndicators = indicators.map((item: any) => ({
      id: String(item?.id || ""),
      campo_id: String(item?.fieldId || ""),
      indicador: String(item?.label || "").slice(0, 500),
    }));
    const compactFields = fields.map((item: any) => ({
      id: String(item?.id || ""),
      campo: `${String(item?.section || "")} — ${String(item?.name || "")}`,
      dominio: String(item?.domain || ""),
      referentes: Array.isArray(item?.referents) ? item.referents : [],
    }));

    const prompt = `Associe evidências validadas aos indicadores do Quadro de Referência da Avaliação Externa das Escolas, em português europeu.

CAMPOS EM ANÁLISE:
${JSON.stringify(compactFields)}

INDICADORES APLICÁVEIS:
${JSON.stringify(compactIndicators)}

EVIDÊNCIAS VALIDADAS:
${JSON.stringify(compactEvidence)}

REGRAS:
- Respeite rigorosamente o campo_id: uma evidência só pode ser associada a indicadores do mesmo campo.
- Use exclusivamente os identificadores fornecidos.
- Proponha uma associação apenas quando a afirmação da evidência sustentar diretamente o conteúdo do indicador.
- Não associe por mera semelhança lexical, proximidade temática ou porque o indicador seria expectável.
- Um documento orientador ou normativo pode sustentar a existência de uma intenção, regra ou opção, mas não prova automaticamente implementação, regularidade, resultado ou impacto.
- Um testemunho isolado não comprova generalização.
- Dados quantitativos só sustentam o indicador cuja variável, população e período estejam efetivamente representados.
- Não transforme ausência de informação em evidência negativa.
- Se a relação for indireta, vaga ou insuficiente, não proponha o indicador.
- Pode propor zero, um ou vários indicadores por evidência, mas evite associações excessivas.
- A confiança "Alta" exige correspondência explícita; use "Média" apenas quando a sustentação é direta mas requer prudência.
- Escreva uma justificação muito curta, concreta e sem inventar informação.
- Não repita associações já confirmadas, pois elas permanecem preservadas na interface.
- Devolva uma lista vazia quando nenhuma nova associação seja suficientemente sustentada.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_INDICATORS_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: fields.length > 1 ? 8_000 : 3_500,
        text: { format: { type: "json_schema", name: "associacao_indicadores_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a associação de indicadores." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu sugestões utilizáveis. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch {
      return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. Não houve repetição automática paga." }, { status: 502 });
    }
    const evidenceFields = new Map(compactEvidence.map((item: any) => [item.id, item.campo_id]));
    const indicatorFields = new Map(compactIndicators.map((item: any) => [item.id, item.campo_id]));
    const validEvidenceIds = new Set(compactEvidence.map((item: any) => item.id));
    const validIndicatorIds = new Set(compactIndicators.map((item: any) => item.id));
    const existing = new Set(compactEvidence.flatMap((item: any) => item.indicadores_ja_confirmados.map((id: string) => `${item.id}|${id}`)));
    const suggestions = (Array.isArray(result?.sugestoes) ? result.sugestoes : [])
      .filter((item: any) => {
        const evidenceId = Number(item?.evidencia_id);
        const indicatorId = String(item?.indicador_id);
        return validEvidenceIds.has(evidenceId)
          && validIndicatorIds.has(indicatorId)
          && evidenceFields.get(evidenceId) === indicatorFields.get(indicatorId)
          && !existing.has(`${evidenceId}|${indicatorId}`);
      })
      .map((item: any) => ({
        evidenceId: Number(item.evidencia_id),
        indicatorId: String(item.indicador_id),
        justification: String(item.justificacao || "").slice(0, 280),
        confidence: item.confianca === "Alta" ? "Alta" : "Média",
      }));
    return NextResponse.json({ ok: true, suggestions });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na associação de indicadores." }, { status: 500 });
  }
}
