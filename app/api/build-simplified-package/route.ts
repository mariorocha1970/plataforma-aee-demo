import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"] as const;
const domainMap = { type: "object", additionalProperties: false, properties: Object.fromEntries(DOMAINS.map((domain) => [domain, { type: "array", items: { type: "string" } }])), required: DOMAINS };
const reportSchema = {
  type: "object", additionalProperties: false,
  properties: {
    introducao: { type: "string" }, pontosFortes: domainMap, areasMelhoria: domainMap,
    projetosInteressantes: { type: "array", items: { type: "string" } },
    papelFamilias: { type: "array", items: { type: "string" } },
    classificacoes: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: { dominio: { type: "string", enum: DOMAINS }, classificacao: { type: "string" } }, required: ["dominio", "classificacao"] } },
  }, required: ["introducao", "pontosFortes", "areasMelhoria", "projetosInteressantes", "papelFamilias", "classificacoes"],
};
const questionnaireItem = {
  type: "object", additionalProperties: false,
  properties: { numero: { type: "string" }, item: { type: "string" }, concordoTotalmente: { type: "number" }, concordo: { type: "number" }, discordo: { type: "number" }, discordoTotalmente: { type: "number" }, total: { type: "number" } },
  required: ["numero", "item", "concordoTotalmente", "concordo", "discordo", "discordoTotalmente", "total"],
};
const schema = {
  type: "object", additionalProperties: false,
  properties: {
    alunos: reportSchema,
    familias: reportSchema,
    questionarios: { type: "object", additionalProperties: false, properties: { grupos: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, properties: { grupo: { type: "string" }, maiorConcordancia: { type: "array", maxItems: 5, items: questionnaireItem }, menorConcordancia: { type: "array", maxItems: 3, items: questionnaireItem } }, required: ["grupo", "maiorConcordancia", "menorConcordancia"] } } }, required: ["grupos"] },
  }, required: ["alunos", "familias", "questionarios"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).filter((item: any) => item?.type === "output_text").map((item: any) => item?.text ?? "").join("");
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "O Agente de IA ainda não está configurado." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    const report = typeof body?.report === "string" ? body.report.trim() : "";
    const questionnaires = typeof body?.questionnaires === "string" ? body.questionnaires.trim() : "";
    if (report.length < 500) return NextResponse.json({ ok: false, error: "O relatório validado não contém texto suficiente." }, { status: 400 });
    if (questionnaires.length < 100) return NextResponse.json({ ok: false, error: "Os PDF dos questionários não contêm texto suficiente." }, { status: 400 });
    if (report.length + questionnaires.length > 300_000) return NextResponse.json({ ok: false, error: "O conjunto excede o limite preventivo de 300 000 caracteres. Reduza ficheiros repetidos ou digitalizações redundantes." }, { status: 413 });

    const prompt = `Execute, numa única operação, três tarefas articuladas da Avaliação Externa das Escolas: análise dos questionários, relatório para alunos e relatório para famílias.

REGRAS COMUNS DOS DOIS RELATÓRIOS:
- Use a identificação, as datas da visita, os estabelecimentos visitados e as atividades observadas do ponto 1 apenas para redigir a introdução. Para o restante conteúdo, considere exclusivamente os pontos 2, 3, 4 e 5.
- Não acrescente factos, interpretações, conclusões, recomendações ou projetos inexistentes.
- Preserve o sentido, a graduação e os limites dos juízos da equipa.
- Inclua todos os pontos fortes do ponto 3 e todas as áreas de melhoria do ponto 4.
- Organize sempre pelos quatro domínios. Se não houver elementos, declare a ausência.
- Um bullet contém uma ideia principal e, no máximo, duas frases.
- Reformule; não copie períodos completos.
- Extraia as classificações apenas quando constem explicitamente do ponto 2.
- Escreva em português europeu.

RELATÓRIO PARA ALUNOS:
- Destinatários entre 10 e 15 anos. Frases curtas, diretas, voz ativa e vocabulário simples, sem infantilizar.
- Explique em linguagem comum conceitos técnicos indispensáveis.
- Pontos fortes correspondem a «O que está a correr bem»; áreas de melhoria correspondem a «O que pode melhorar».
- Não transforme áreas de melhoria em elogios.
- Selecione projetos e iniciativas com participação dos alunos ou contributo para aprendizagem, cidadania, inclusão ou bem-estar.
- Devolva papelFamilias como lista vazia.
- Em introducao, escreva exatamente dois parágrafos separados por uma linha em branco. O primeiro começa por «Entre os dias» e identifica datas, equipa coordenada pela Inspeção-Geral da Educação e Ciência, unidade orgânica e finalidade da visita. O segundo começa por «Durante a visita» e identifica, apenas se constarem do relatório, os membros ouvidos, os estabelecimentos visitados e a observação de aulas ou atividades. Não inclua saudação nem antecipe pontos fortes.

RELATÓRIO PARA FAMÍLIAS:
- Linguagem compreensível para adultos com escolaridade básica, frases curtas e listas claras.
- Inclua pontos fortes do ponto 3 e elementos positivos relevantes do ponto 5.
- Inclua áreas do ponto 4 e outros elementos a melhorar do ponto 5.
- Nenhuma área de melhoria pode começar por verbo no infinitivo.
- Inclua projetos, clubes, programas, iniciativas, parcerias e atividades mencionados.
- Recolha apenas referências explícitas ao papel e à participação das famílias.
- Em introducao, escreva exatamente três parágrafos separados por uma linha em branco. O primeiro começa por «Entre os dias» e identifica datas, equipa coordenada pela Inspeção-Geral da Educação e Ciência, unidade orgânica e finalidade. O segundo começa por «Durante a visita» e identifica, apenas se constarem do relatório, representantes ouvidos, estabelecimentos visitados e atividades ou aulas observadas. O terceiro começa por «A avaliação» e explica, em linguagem simples, os quatro domínios: Autoavaliação, Liderança e gestão, Prestação do serviço educativo e Resultados. Não inclua saudação nem antecipe pontos fortes.

ANÁLISE DOS QUESTIONÁRIOS:
- Identifique e processe apenas Q1, Q2, Q5 e Q6, mantendo obrigatoriamente estes códigos no início do nome de cada grupo.
- Q1 e Q2 destinam-se exclusivamente ao relatório dos alunos; Q5 e Q6 destinam-se exclusivamente ao relatório das famílias.
- Reconstitua número, texto e percentagens de Concordo Totalmente, Concordo, Discordo e Discordo Totalmente.
- Corrija apenas quebras de linha ou fusões de células comprovadas pela coerência numérica; não invente valores.
- Selecione os cinco itens com maior CT + C e ordene do maior para o menor.
- Selecione os três itens com maior D + DT e apresente esses três do menor para o maior.
- A seleção depende da soma, nunca de uma coluna isolada.
- Em total use CT + C nos itens positivos e D + DT nos itens negativos.
- Quando uma categoria não estiver disponível, use 0 e não a estime.

RELATÓRIO TÉCNICO VALIDADO:
---
${report}
---

DADOS EXTRAÍDOS DOS PDF DOS QUESTIONÁRIOS:
---
${questionnaires}
---`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_REPORT_MODEL?.trim() || "gpt-5-mini", store: false, input: prompt, reasoning: { effort: "minimal" }, max_output_tokens: 16_000, text: { format: { type: "json_schema", name: "pacote_relatorios_simplificados_aee", strict: true, schema } } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não conseguiu produzir o pacote de relatórios." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém um pacote utilizável." }, { status: 502 });
    return NextResponse.json({ ok: true, package: JSON.parse(raw) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na produção do pacote simplificado." }, { status: 500 });
  }
}
