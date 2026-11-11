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

const QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questoes: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campo: { type: "string", enum: CAMPOS_AEE },
          pergunta: { type: "string" },
          finalidade: { type: "string" },
          referencias: { type: "array", maxItems: 3, items: { type: "string" } },
        },
        required: ["campo", "pergunta", "finalidade", "referencias"],
      },
    },
  },
  required: ["questoes"],
};

const ALL_PANELS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    paineis: {
      type: "array",
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          painel: { type: "string" },
          questoes: QUESTION_SCHEMA.properties.questoes,
        },
        required: ["painel", "questoes"],
      },
    },
  },
  required: ["paineis"],
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
    if (!apiKey) return NextResponse.json({ ok: false, error: "O Agente de IA ainda não está configurado." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    if (!body) return NextResponse.json({ ok: false, error: "O pedido não contém JSON válido." }, { status: 400 });
    const panels = Array.isArray(body.panels) ? body.panels.filter((item: unknown) => typeof item === "string" && item.trim()).map((item: string) => item.trim()).slice(0, 16) : [];
    const allPanels = panels.length > 0;
    const panel = typeof body.panel === "string" ? body.panel.trim() : "Painel não identificado";
    const agenda = typeof body.agenda === "string" ? body.agenda.trim() : "não identificada";
    const evidence = Array.isArray(body.evidence) ? body.evidence.slice(0, 90) : [];
    const comments = Array.isArray(body.questionnaireComments) ? body.questionnaireComments.slice(0, 40) : [];
    const report = typeof body.questionnaireReport === "string" ? body.questionnaireReport.slice(0, 12_000) : "";
    if (!evidence.length && !comments.length && !report.trim()) return NextResponse.json({ ok: false, error: "Não foi fornecida base probatória para preparar o guião." }, { status: 400 });

    const prompt = `Prepare ${allPanels ? "os guiões de entrevista de todos os painéis indicados" : "um guião de entrevista"} para a Avaliação Externa das Escolas.

AGENDA: ${agenda}
${allPanels ? `PAINÉIS (use exatamente estas designações e mantenha esta ordem):\n${panels.map((item: string, index: number) => `${index + 1}. ${item}`).join("\n")}` : `PAINEL: ${panel}`}

REGRAS OBRIGATÓRIAS:
- Formule 4 a 10 perguntas por painel, abertas, claras, curtas, não indutoras e adequadas às responsabilidades e experiência de cada painel.
- ${allPanels ? "Inclua todos os painéis indicados, sem omitir ou fundir nenhum. Diferencie efetivamente os guiões; não repita mecanicamente as mesmas perguntas." : "Produza apenas o guião do painel indicado."}
- Use as perguntas para confirmar, aprofundar ou contraditar práticas, resultados, impactos, lacunas e divergências presentes na base fornecida.
- Não peça ao painel informação que, razoavelmente, não possa conhecer.
- Distribua as perguntas pelos campos materialmente pertinentes; evite perguntas genéricas ou repetidas.
- Em «referencias», copie apenas a fonte e a localização efetivamente fornecidas. Quando existir página, secção ou folha, conserve-a exatamente.
- Nunca invente páginas, documentos, resultados de questionário, citações, factos ou referências. Se uma pergunta decorrer de uma lacuna sem referência exata, devolva a lista de referências vazia.
- Resultados de questionários e comentários são perceções ou sinais a aprofundar, não factos comprovados.
- Em «finalidade», explique numa frase o que a pergunta procura confirmar, aprofundar ou contraditar.
- Escreva em português europeu e não inclua dados pessoais.

EVIDÊNCIAS DOCUMENTAIS, QUANTITATIVAS E JÁ VALIDADAS:
${JSON.stringify(evidence)}

COMENTÁRIOS/OBSERVAÇÕES DOS QUESTIONÁRIOS:
${JSON.stringify(comments)}

SÍNTESE DOS QUESTIONÁRIOS:
${report}`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_INTERVIEW_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: allPanels ? 14_000 : 3_000,
        text: { format: { type: "json_schema", name: allPanels ? "guioes_paineis_aee" : "guiao_entrevista_aee", strict: true, schema: allPanels ? ALL_PANELS_SCHEMA : QUESTION_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const quota = data?.error?.code === "insufficient_quota" || /quota|billing/i.test(data?.error?.message ?? "");
      return NextResponse.json({ ok: false, error: quota ? "A conta da API não tem saldo disponível ou atingiu o limite de utilização." : data?.error?.message || "A IA não conseguiu preparar o guião." }, { status: response.status });
    }
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém um guião utilizável." }, { status: 502 });
    const parsed = JSON.parse(raw);
    if (allPanels) {
      if (!Array.isArray(parsed?.paineis)) return NextResponse.json({ ok: false, error: "A resposta não contém os guiões dos painéis esperados." }, { status: 502 });
      return NextResponse.json({ ok: true, panelGuides: parsed.paineis });
    }
    if (!Array.isArray(parsed?.questoes)) return NextResponse.json({ ok: false, error: "A resposta não contém a lista de questões esperada." }, { status: 502 });
    return NextResponse.json({ ok: true, questions: parsed.questoes });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na preparação do guião." }, { status: 500 });
  }
}
