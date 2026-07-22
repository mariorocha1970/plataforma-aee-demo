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

const ANALISE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    analises: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campo: { type: "string", enum: CAMPOS_AEE },
          pertinente: { type: "boolean" },
          sintese: { type: "string" },
          suporte: { type: "array", maxItems: 4, items: { type: "string" } },
          reservas: { type: "array", maxItems: 3, items: { type: "string" } },
          questoesAprofundar: { type: "array", maxItems: 3, items: { type: "string" } },
        },
        required: ["campo", "pertinente", "sintese", "suporte", "reservas", "questoesAprofundar"],
      },
    },
  },
  required: ["analises"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text")
    .map((item: any) => item?.text ?? "")
    .join("");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    route: "/api/analyze-interview",
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
    const prompt = `Atue como especialista em Avaliação Externa das Escolas em Portugal.
Analise o relato da entrevista ao painel «${panel}» e devolva apenas os campos do referencial efetivamente sustentados.

REGRAS:
- Não produza uma ata nem copie frases soltas.
- Redija, no máximo, 120 palavras de síntese por campo, em português europeu.
- Distinga declarações, práticas, resultados e impacto; não trate perceções como factos comprovados.
- Não invente informação, causalidade ou juízos.
- Atribua cada ideia apenas ao campo principal e elimine repetições.
- Inclua no máximo 4 elementos de suporte, 3 reservas e 3 questões a aprofundar por campo.
- Devolva somente campos pertinentes. Não crie objetos vazios para os restantes campos.
- Assinale necessidade de triangulação, contradições e insuficiência de demonstração de impacto.

CAMPOS DO REFERENCIAL:
${campos}

RELATO:
---
${interviewText.slice(0, 30_000)}
---`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        input: prompt,
        reasoning: { effort: "low" },
        max_output_tokens: 2_500,
        text: {
          format: {
            type: "json_schema",
            name: "analise_entrevista_aee",
            strict: true,
            schema: ANALISE_SCHEMA,
          },
        },
      }),
    });

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

    const analysis = JSON.parse(raw);
    return NextResponse.json({ ok: true, model, analysis, result: analysis, data: analysis });
  } catch (error) {
    console.error("Erro na análise da entrevista:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Erro interno na análise da entrevista.",
    }, { status: 500 });
  }
}
