import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"] as const;
const domainMap = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(DOMAINS.map((domain) => [domain, { type: "array", items: { type: "string" } }])),
  required: DOMAINS,
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    introducao: { type: "string" },
    pontosFortes: domainMap,
    areasMelhoria: domainMap,
    projetosInteressantes: { type: "array", items: { type: "string" } },
    papelFamilias: { type: "array", items: { type: "string" } },
    classificacoes: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: { dominio: { type: "string", enum: DOMAINS }, classificacao: { type: "string" } },
        required: ["dominio", "classificacao"],
      },
    },
  },
  required: ["introducao", "pontosFortes", "areasMelhoria", "projetosInteressantes", "papelFamilias", "classificacoes"],
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
    const audience = body?.audience === "familias" ? "familias" : "alunos";
    const report = typeof body?.report === "string" ? body.report.trim() : "";
    if (report.length < 500) return NextResponse.json({ ok: false, error: "O relatório validado não contém texto suficiente." }, { status: 400 });
    if (report.length > 180_000) return NextResponse.json({ ok: false, error: "O relatório excede o limite preventivo de 180 000 caracteres." }, { status: 413 });

    const shared = `REGRAS DE RIGOR OBRIGATÓRIAS:
- Considere exclusivamente os pontos 2, 3, 4 e 5 do relatório técnico.
- Não acrescente factos, interpretações, conclusões, recomendações ou projetos que não constem do relatório.
- Preserve integralmente o sentido, a graduação e os limites dos juízos da equipa de avaliação.
- Inclua todos os pontos fortes do ponto 3 e todas as áreas de melhoria do ponto 4, sem os fundir de modo a perder ideias.
- Use os quatro domínios, mesmo quando não existam elementos específicos; nesse caso declare expressamente a ausência.
- Um bullet contém uma ideia principal e, no máximo, duas frases.
- Não copie períodos completos do original; reformule.
- Extraia as classificações apenas se estiverem explicitamente indicadas no ponto 2.
- Escreva em português europeu.`;

    const students = `DESTINATÁRIOS: alunos entre os 10 e os 15 anos.
Use frases curtas, diretas e voz ativa. Empregue vocabulário simples, mas não infantilizado. Explique em linguagem comum qualquer conceito técnico indispensável.
PONTOS FORTES: apresente como «O que está a correr bem», por domínio.
ÁREAS DE MELHORIA: apresente como «O que pode melhorar», por domínio, sem converter fragilidades em elogios.
PROJETOS INTERESSANTES: selecione apenas projetos, clubes, atividades, parcerias ou iniciativas referidos no relatório que envolvam alunos ou contribuam para aprendizagem, cidadania, inclusão ou bem-estar.
PAPEL DAS FAMÍLIAS: devolva uma lista vazia, porque esta secção não integra a versão para alunos.`;

    const families = `DESTINATÁRIOS: pais e encarregados de educação com diferentes níveis de literacia.
Use frases curtas, vocabulário acessível e listas claras. Elimine linguagem técnica ou explique-a de forma simples.
PONTOS FORTES: inclua os do ponto 3 e outros elementos positivos relevantes explicitamente referidos no ponto 5, organizados pelos quatro domínios.
ÁREAS DE MELHORIA: inclua as do ponto 4 e outros elementos a melhorar explicitamente referidos no ponto 5. As frases não podem começar por verbos no infinitivo, para não assumirem a forma de recomendação.
PROJETOS INTERESSANTES: identifique projetos, clubes, programas, iniciativas, parcerias e atividades mencionados no relatório.
PAPEL DAS FAMÍLIAS: recolha apenas referências explícitas à participação das famílias, comunicação escola-família, associação de pais, acompanhamento dos alunos, reuniões, órgãos de participação ou iniciativas dirigidas aos pais.`;

    const prompt = `Transforme o relatório técnico de Avaliação Externa das Escolas numa versão simplificada.

${shared}

${audience === "alunos" ? students : families}

Na introdução, escreva um parágrafo curto que explique a finalidade desta versão simplificada sem inventar informação sobre a escola.

RELATÓRIO TÉCNICO VALIDADO:
---
${report}
---`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 8_000,
        text: { format: { type: "json_schema", name: `relatorio_simplificado_${audience}`, strict: true, schema: SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não conseguiu produzir o relatório simplificado." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém um relatório utilizável." }, { status: 502 });
    const content = JSON.parse(raw);
    return NextResponse.json({ ok: true, audience, content });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na redação do relatório simplificado." }, { status: 500 });
  }
}
