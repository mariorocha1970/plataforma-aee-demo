import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPOS_AEE = [
  "Desenvolvimento", "Consistência e impacto", "Visão e estratégia", "Liderança", "Gestão",
  "Desenvolvimento pessoal e bem-estar das crianças e dos alunos", "Oferta educativa e gestão curricular",
  "Ensino, aprendizagem e avaliação", "Planificação e acompanhamento das práticas educativa e letiva",
  "Resultados académicos", "Resultados sociais", "Reconhecimento da comunidade",
] as const;

const EVIDENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    evidencias: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campo: { type: "string", enum: CAMPOS_AEE },
          afirmacao: { type: "string" },
          localizacao: { type: "string" },
          natureza: { type: "string", enum: ["intenção", "prática", "monitorização", "resultado", "impacto"] },
          reserva: { type: "string" },
          indicadores: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
        },
        required: ["campo", "afirmacao", "localizacao", "natureza", "reserva", "indicadores"],
      },
    },
  },
  required: ["evidencias"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text").map((item: any) => item?.text ?? "").join("");
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), route: "/api/analyze-document", architecture: "evidence-first-v40" });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "Adicione OPENAI_API_KEY às variáveis de ambiente do servidor." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ ok: false, error: "Não foi recebido texto para analisar." }, { status: 400 });
    if (text.length > 20_000) return NextResponse.json({ ok: false, error: "O segmento excede 20 000 caracteres." }, { status: 413 });

    const fileName = typeof body.fileName === "string" ? body.fileName : "Documento sem título";
    const location = typeof body.location === "string" ? body.location : "localização não indicada";
    const indicators = (Array.isArray(body?.indicators) ? body.indicators : [])
      .filter((item: any) => typeof item?.id === "string" && typeof item?.label === "string")
      .slice(0, 180)
      .map((item: any) => ({
        id: String(item.id),
        campo: String(item.field || ""),
        indicador: String(item.label).slice(0, 500),
      }));
    const fields = CAMPOS_AEE.map((field, index) => `${index + 1}. ${field}`).join("\n");
    const prompt = `Extraia evidências factuais úteis à Avaliação Externa das Escolas deste segmento de ${fileName} (${location}) e proponha, no mesmo momento, os indicadores diretamente sustentados.\n\nCAMPOS:\n${fields}\n\nINDICADORES DO QUADRO DE REFERÊNCIA (use apenas estes identificadores):\n${JSON.stringify(indicators)}\n\nREGRAS:\n- percorra todo o segmento; não privilegie apenas as primeiras ocorrências;\n- devolva até 24 evidências materialmente relevantes, procurando preservar a diversidade de indicadores efetivamente abordados;\n- uma evidência pode sustentar vários indicadores, mas associe apenas correspondências diretas;\n- use apenas indicadores pertencentes ao campo escolhido e exclusivamente os identificadores fornecidos;\n- não associe por mera proximidade temática ou porque o indicador seria expectável;\n- uma evidência por facto, com formulação factual e curta (máximo 65 palavras);\n- conserve a página/secção na localização;\n- classifique como intenção, prática, monitorização, resultado ou impacto;\n- não formule pontos fortes, áreas de melhoria nem juízos avaliativos;\n- não trate uma intenção como prática, uma atividade como resultado, nem um resultado pontual como impacto sustentado;\n- um relatório validado é uma fonte documental relevante, mas as afirmações nele contidas continuam sujeitas à natureza e aos limites da prova apresentada;\n- use a reserva para indicar limites, falta de dados, representatividade ou necessidade de triangulação; se não houver reserva, use string vazia;\n- se o facto for relevante para o campo mas não sustentar diretamente qualquer indicador, devolva indicadores como lista vazia;\n- não invente nem repita evidências; escreva em português europeu.\n\n--- INÍCIO DO SEGMENTO ---\n${text}\n--- FIM DO SEGMENTO ---`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_DOCUMENT_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 6_000,
        text: { format: { type: "json_schema", name: "evidencias_documentais_aee", strict: true, schema: EVIDENCE_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A OpenAI não concluiu a extração." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu evidências utilizáveis." }, { status: 502 });
    const result = JSON.parse(raw);
    if (!Array.isArray(result?.evidencias)) return NextResponse.json({ ok: false, error: "A resposta não contém a lista de evidências esperada." }, { status: 502 });
    const allowedIndicatorIds = new Set(indicators.map((item: any) => item.id));
    const evidence = result.evidencias.map((item: any) => ({
      ...item,
      indicadores: (Array.isArray(item?.indicadores) ? item.indicadores : [])
        .map(String)
        .filter((id: string) => allowedIndicatorIds.has(id)),
    }));
    return NextResponse.json({ ok: true, architecture: "indicator-aware-v48", evidence });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno durante a extração de evidências." }, { status: 500 });
  }
}
