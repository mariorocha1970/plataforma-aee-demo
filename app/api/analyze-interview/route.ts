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
          natureza: { type: "string", enum: ["perceção", "prática relatada", "resultado referido", "impacto alegado"] },
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

async function requestAnalysis(apiKey: string, model: string, prompt: string) {
  return fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: prompt,
      reasoning: { effort: "minimal" },
      max_output_tokens: 2_500,
      text: {
        format: {
          type: "json_schema",
          name: "evidencias_entrevista_aee",
          strict: true,
          schema: EVIDENCE_SCHEMA,
        },
      },
    }),
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    route: "/api/analyze-interview", architecture: "evidence-first-v41",
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "O Agente de IA ainda não está configurado." }, { status: 503 });
    }

    const body = await request.json().catch(() => null) as any;
    if (!body) return NextResponse.json({ ok: false, error: "O pedido não contém JSON válido." }, { status: 400 });

    const panel = typeof body.panel === "string" ? body.panel.trim() : "Painel não identificado";
    const interviewText = typeof body.text === "string" ? body.text.trim() : "";
    if (interviewText.length < 40) {
      return NextResponse.json({ ok: false, error: "O relato é insuficiente para análise." }, { status: 400 });
    }

    // A análise de entrevistas tem configuração própria para não herdar um
    // OPENAI_MODEL mais lento usado noutras funções da plataforma.
    const model = process.env.OPENAI_INTERVIEW_MODEL?.trim() || "gpt-5-mini";
    const campos = CAMPOS_AEE.map((campo, index) => `${index + 1}. ${campo}`).join("\n");
    const prompt = `Extraia evidências testemunhais úteis à Avaliação Externa das Escolas do relato do painel «${panel}».

REGRAS:
- Devolva no máximo 10 evidências e apenas as materialmente relevantes.
- Uma evidência por afirmação, curta e fiel ao sentido do relato (máximo 65 palavras).
- Não formule pontos fortes, áreas de melhoria, conclusões ou juízos avaliativos.
- Classifique como perceção, prática relatada, resultado referido ou impacto alegado.
- Nunca transforme uma declaração do painel em facto comprovado.
- Na localização, indique a parte ou tema do relato; se não for identificável, escreva «relato de entrevista».
- Na reserva, indique o que necessita de triangulação, a limitação de representatividade ou a ausência de demonstração; nunca deixe implícito que o testemunho basta para comprovar impacto.
- Atribua cada evidência apenas ao campo principal, elimine repetições e escreva em português europeu.

CAMPOS DO REFERENCIAL:
${campos}

RELATO:
---
${interviewText.slice(0, 30_000)}
---`;

    const response = await requestAnalysis(apiKey, model, prompt);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const quota = data?.error?.code === "insufficient_quota" || /quota|billing/i.test(data?.error?.message ?? "");
      const message = quota
        ? "A conta da API não tem saldo disponível ou atingiu o limite de utilização."
        : data?.error?.message || "A IA não conseguiu analisar o relato.";
      return NextResponse.json({ ok: false, error: message }, { status: response.status });
    }

    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém uma análise utilizável." }, { status: 502 });

    let analysis: any;
    try {
      analysis = JSON.parse(raw);
    } catch {
      return NextResponse.json({
        ok: false,
        error: "A resposta da IA ficou incompleta ou inválida. O relato não foi promovido nem originou uma segunda chamada paga.",
      }, { status: 502 });
    }
    if (!Array.isArray(analysis?.evidencias)) return NextResponse.json({ ok: false, error: "A resposta não contém a lista de evidências esperada." }, { status: 502 });
    return NextResponse.json({ ok: true, model, architecture: "evidence-first-v41", evidence: analysis.evidencias });
  } catch (error) {
    console.error("Erro na análise da entrevista:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno na análise da entrevista.",
    }, { status: 500 });
  }
}

