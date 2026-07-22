import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const conclusion = {
  type: "object",
  additionalProperties: false,
  properties: {
    domain: { type: "string", enum: ["Autoavaliação", "Liderança e gestão", "Prestação do serviço educativo", "Resultados"] },
    strengths: { type: "array", items: { type: "string" }, maxItems: 6 },
    improvements: { type: "array", items: { type: "string" }, maxItems: 6 },
    rating: { type: "string", enum: ["Excelente", "Muito bom", "Bom", "Suficiente", "Insuficiente", "Por definir"] },
    rationale: { type: "string" },
  },
  required: ["domain", "strengths", "improvements", "rating", "rationale"],
};

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { conclusions: { type: "array", items: conclusion, minItems: 4, maxItems: 4 } },
  required: ["conclusions"],
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
    const domains = Array.isArray(body?.domains) ? body.domains.slice(0, 4) : [];
    if (domains.length !== 4) return NextResponse.json({ ok: false, error: "São necessários os quatro domínios e respetivas triangulações." }, { status: 400 });
    const schoolName = String(body?.schoolName || "a organização escolar").slice(0, 180);
    const prompt = `Formule a síntese conclusiva de uma Avaliação Externa das Escolas, em português europeu, relativa a ${schoolName}.

DADOS POR DOMÍNIO (narrativas já trianguladas, perfil probatório e proposta local):
${JSON.stringify(domains).slice(0, 48_000)}

ESCALA:
- Excelente: predomínio de pontos fortes em todos os campos, com práticas inovadoras e resultados notáveis generalizados e sustentados, sem áreas que careçam de melhorias significativas.
- Muito bom: predomínio de pontos fortes em todos os campos, incluindo boas práticas e resultados notáveis de caráter generalizado.
- Bom: os pontos fortes sobrepõem-se de forma significativa aos pontos fracos nos campos analisados.
- Suficiente: equilíbrio entre pontos fortes e pontos fracos ou indefinição clara de impacto positivo.
- Insuficiente: predomínio de pontos fracos que exigem intervenção corretiva urgente e prioritária.

REGRAS:
- Devolva exatamente os quatro domínios e preserve a respetiva designação oficial.
- Pontos fortes e áreas de melhoria são juízos avaliativos concisos, autónomos e coerentes com o texto do relatório; não são listas de atividades nem transcrições de evidências.
- Formule apenas o que esteja sustentado pelas narrativas fornecidas. Não invente práticas, inovação, resultados, impacto ou generalização.
- Um ponto forte deve evidenciar relevância, abrangência e efeito positivo; uma área de melhoria deve identificar com clareza o processo ou resultado a aperfeiçoar, sem prescrever soluções.
- Não repita o mesmo conteúdo como ponto forte e área de melhoria.
- Não cite ficheiros, páginas, quantidades de fontes ou mecanismos internos da plataforma.
- Se a cobertura ou robustez forem insuficientes, use «Por definir» e explique objetivamente o que impede a classificação.
- «Excelente» exige evidência expressa de inovação, resultados notáveis generalizados e sustentados e ausência de melhorias significativas. «Muito bom» exige predomínio em todos os campos e resultados notáveis generalizados.
- A fundamentação deve explicar em duas ou três frases a relação entre o padrão dos juízos e a menção proposta.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CONCLUSIONS_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 4_500,
        text: { format: { type: "json_schema", name: "conclusoes_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a síntese." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu conclusões utilizáveis. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. A proposta local foi preservada e não houve repetição automática paga." }, { status: 502 }); }
    return NextResponse.json({ ok: true, conclusions: result?.conclusions });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na síntese conclusiva." }, { status: 500 });
  }
}
