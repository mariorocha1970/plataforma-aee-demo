import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    narrativas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campoId: { type: "string" },
          narrativa: { type: "string" },
        },
        required: ["campoId", "narrativa"],
      },
    },
  },
  required: ["narrativas"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text")
    .map((item: any) => item?.text ?? "")
    .join("");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "A API da OpenAI não está configurada." }, { status: 503 });

    const body = await request.json().catch(() => null) as any;
    const fields = Array.isArray(body?.fields) ? body.fields.slice(0, 20) : [];
    const evidence = Array.isArray(body?.evidence) ? body.evidence.slice(0, 180) : [];
    const diagnostics = body?.diagnostics && typeof body.diagnostics === "object" ? body.diagnostics : {};
    const mandatoryAcademicComparisons = (Array.isArray(body?.mandatoryAcademicComparisons) ? body.mandatoryAcademicComparisons : [])
      .map((item: any) => String(item || "").slice(0, 2_500)).filter(Boolean).slice(0, 12);
    if (!fields.length || !evidence.length) {
      return NextResponse.json({ ok: false, error: "Não existem campos com evidências validadas para triangular." }, { status: 400 });
    }

    const compactFields = fields.map((field: any) => ({
      id: String(field?.id || ""),
      campo: `${String(field?.section || "")} — ${String(field?.name || "")}`,
      dominio: String(field?.domain || ""),
      referentes: Array.isArray(field?.referents) ? field.referents.map(String) : [],
    }));
    const compactEvidence = evidence.map((item: any) => ({
      id: Number(item?.id),
      campoId: String(item?.fieldId || ""),
      afirmacao: String(item?.claim || "").slice(0, 750),
      fonte: String(item?.source || "").slice(0, 140),
      tipo: String(item?.sourceType || ""),
      localizacao: String(item?.location || "").slice(0, 140),
      estado: String(item?.status || ""),
      qualidadeRegistada: String(item?.strength || ""),
      indicadores: Array.isArray(item?.indicatorIds) ? item.indicatorIds.map(String) : [],
    }));

    const prompt = `Produza, numa única operação, sínteses de triangulação autónomas para todos os campos indicados da Avaliação Externa das Escolas, em português europeu.

CAMPOS:
${JSON.stringify(compactFields)}

EVIDÊNCIAS VALIDADAS:
${JSON.stringify(compactEvidence)}

DIAGNÓSTICOS PROBATÓRIOS POR CAMPO:
${JSON.stringify(diagnostics)}

ANÁLISES ESTATÍSTICAS COMPARADAS, VALIDADAS NA MATRIZ, PARA 5.4.1:
${JSON.stringify(mandatoryAcademicComparisons)}

REGRAS:
- Devolva exatamente uma narrativa por campo que tenha evidências; use o campoId recebido.
- Em cada campo, considere exclusivamente as evidências com o campoId correspondente.
- Cruze semanticamente fontes independentes; não enumere documentos.
- Avalie a qualidade na relação evidência–indicador; não atribua força uniforme à fonte nem use a contagem bruta de fontes como robustez.
- A autoridade institucional só reforça o que a evidência demonstra diretamente e não torna automaticamente atual uma constatação histórica.
- Trate evidenceQuality e triangulation dos diagnósticos como dimensões autónomas: evidência forte não equivale, por si só, a triangulação confirmada.
- Distinga intenção, prática, monitorização, resultado e impacto.
- Identifique convergências, divergências, contradições e lacunas.
- Documento normativo não prova execução; testemunho isolado não comprova um facto.
- Não transforme ausência de evidência em evidência de ausência.
- Em 5.4.1, os dados do InfoEscolas só sustentam resultados académicos quando apresentam, para o mesmo indicador, a escola/agrupamento e o nacional em leitura comparada dos três últimos anos letivos. Não analise séries isoladas nem use outros gráficos contextuais como evidência académica.
- Nos percursos diretos de sucesso, explicite a comparação com o nacional nos três últimos anos letivos disponíveis, incluindo conclusão no tempo esperado, conclusão dos alunos com apoio ASE e sucesso nas provas nacionais após percurso sem retenções, conforme o ciclo ou oferta.
- Na leitura comparada, preserve os valores por ano, a diferença em pontos percentuais e a evolução da distância face ao nacional. Se a série estiver incompleta, declare essa limitação sem preencher valores nem concluir uma tendência.
- Em 5.4.1, integre todos os factos materiais das análises estatísticas acima e cruze-os com as restantes evidências. Separe descrição quantitativa de interpretação triangulada e não atribua causas, efeitos ou impacto sem confirmação independente.
- Não invente dados, frequência, causalidade, representatividade ou generalização.
- Redija 1 a 3 parágrafos contínuos por campo, sem nomes de ficheiros ou páginas no corpo.
- Não use reservas genéricas ou preventivas. Só formule uma reserva quando o diagnóstico do campo identificar uma limitação concreta.
- Com coveragePercent igual a 100, não afirme que faltam indicadores. Com evidenceQuality Forte, triangulation Confirmada e hasResultsOrImpact verdadeiro, omita a reserva, salvo contradição identificada.
- Se houver limitação, nomeie-a com precisão: indicadores sem evidência, qualidade probatória insuficiente, triangulação parcial/não realizada, contradição ou ausência de resultados/impacto.
- Não formule classificações globais nem use linguagem promocional.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TRIANGULATION_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 10_000,
        text: { format: { type: "json_schema", name: "triangulacao_global_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a triangulação global." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu uma triangulação utilizável. Não houve repetição automática." }, { status: 502 });

    let result: any;
    try {
      result = JSON.parse(raw);
    } catch {
      return NextResponse.json({ ok: false, error: "A resposta global ficou incompleta. Não houve repetição automática paga." }, { status: 502 });
    }
    const fieldIds = new Set(compactFields.map((field: any) => field.id));
    const narratives = (Array.isArray(result?.narrativas) ? result.narrativas : [])
      .filter((item: any) => fieldIds.has(String(item?.campoId)) && String(item?.narrativa || "").trim())
      .map((item: any) => ({ fieldId: String(item.campoId), narrative: String(item.narrativa).trim() }));
    if (!narratives.length) return NextResponse.json({ ok: false, error: "A IA não devolveu narrativas válidas." }, { status: 502 });
    return NextResponse.json({ ok: true, narratives });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na triangulação global." }, { status: 500 });
  }
}
