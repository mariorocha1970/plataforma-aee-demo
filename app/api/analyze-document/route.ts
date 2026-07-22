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
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campo: { type: "string", enum: CAMPOS_AEE },
          afirmacao: { type: "string" },
          localizacao: { type: "string" },
          natureza: { type: "string", enum: ["intenção", "prática", "monitorização", "resultado", "impacto"] },
          reserva: { type: "string" },
        },
        required: ["campo", "afirmacao", "localizacao", "natureza", "reserva"],
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
    const fields = CAMPOS_AEE.map((field, index) => `${index + 1}. ${field}`).join("\n");
    const prompt = `Extraia evidências factuais úteis à Avaliação Externa das Escolas deste segmento de ${fileName} (${location}).\n\nCAMPOS:\n${fields}\n\nREGRAS:\n- devolva no máximo 10 evidências e apenas as materialmente relevantes;\n- uma evidência por facto, com formulação factual e curta (máximo 65 palavras);\n- conserve a página/secção na localização;\n- classifique como intenção, prática, monitorização, resultado ou impacto;\n- não formule pontos fortes, áreas de melhoria nem juízos avaliativos;\n- não trate uma intenção como prática nem uma atividade como impacto;\n- use a reserva para indicar limites, falta de dados, representatividade ou necessidade de triangulação; se não houver reserva, use string vazia;\n- não invente nem repita evidências; escreva em português europeu.\n\n--- INÍCIO DO SEGMENTO ---\n${text}\n--- FIM DO SEGMENTO ---`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_DOCUMENT_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 2_500,
        text: { format: { type: "json_schema", name: "evidencias_documentais_aee", strict: true, schema: EVIDENCE_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A OpenAI não concluiu a extração." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu evidências utilizáveis." }, { status: 502 });
    const result = JSON.parse(raw);
    if (!Array.isArray(result?.evidencias)) return NextResponse.json({ ok: false, error: "A resposta não contém a lista de evidências esperada." }, { status: 502 });
    return NextResponse.json({ ok: true, architecture: "evidence-first-v40", evidence: result.evidencias });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno durante a extração de evidências." }, { status: 500 });
  }
}
