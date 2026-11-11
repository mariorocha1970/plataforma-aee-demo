import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const itemProperties = {
  numero: { type: "string" }, item: { type: "string" },
  concordoTotalmente: { type: "number" }, concordo: { type: "number" },
  discordo: { type: "number" }, discordoTotalmente: { type: "number" }, total: { type: "number" },
};
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    grupos: {
      type: "array", maxItems: 12,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          grupo: { type: "string" },
          maiorConcordancia: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, properties: itemProperties, required: Object.keys(itemProperties) } },
          menorConcordancia: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, properties: itemProperties, required: Object.keys(itemProperties) } },
        },
        required: ["grupo", "maiorConcordancia", "menorConcordancia"],
      },
    },
  }, required: ["grupos"],
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
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 100) return NextResponse.json({ ok: false, error: "Não foi possível extrair informação suficiente dos questionários." }, { status: 400 });
    if (text.length > 140_000) return NextResponse.json({ ok: false, error: "Os questionários excedem o limite preventivo de 140 000 caracteres." }, { status: 413 });
    const prompt = `Analise estatisticamente os questionários de satisfação da Avaliação Externa das Escolas.

REGRAS:
- Identifique e processe cada grupo separadamente.
- Reconstitua número, texto do item e percentagens de Concordo Totalmente, Concordo, Discordo e Discordo Totalmente.
- Corrija quebras de linha e fusões de células apenas quando a coerência numérica o permita; não invente valores ausentes.
- Para maior concordância, calcule CT + C e selecione os cinco valores mais elevados, ordenados do maior para o menor.
- Para menor concordância, calcule D + DT, selecione os três valores mais elevados e apresente esses três do menor para o maior.
- A seleção depende sempre da soma, nunca de uma coluna isolada.
- Preserve o texto e os acentos dos itens.
- Em «total», use CT + C nos itens de maior concordância e D + DT nos itens de menor concordância.
- Quando uma categoria não estiver disponível, use 0 e não a estime.

DADOS EXTRAÍDOS DOS PDF:
---
${text}
---`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_STATISTICS_MODEL?.trim() || "gpt-5-mini", store: false, input: prompt, reasoning: { effort: "minimal" }, max_output_tokens: 8_000, text: { format: { type: "json_schema", name: "analise_questionarios_relatorios_simplificados", strict: true, schema: SCHEMA } } }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não conseguiu analisar os questionários." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém tabelas utilizáveis." }, { status: 502 });
    return NextResponse.json({ ok: true, analysis: JSON.parse(raw) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na análise dos questionários." }, { status: 500 });
  }
}
