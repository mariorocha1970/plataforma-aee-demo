import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPOS_AEE = [
  "Desenvolvimento", "Consistência e impacto", "Visão e estratégia", "Liderança", "Gestão",
  "Desenvolvimento pessoal e bem-estar das crianças e dos alunos", "Oferta educativa e gestão curricular",
  "Ensino, aprendizagem e avaliação", "Planificação e acompanhamento das práticas educativa e letiva",
  "Resultados académicos", "Resultados sociais", "Reconhecimento da comunidade",
];

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  return Array.isArray(data?.output) ? data.output.flatMap((item: any) => item?.content ?? []).filter((item: any) => item?.type === "output_text").map((item: any) => item?.text ?? "").join("") : "";
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), route: "/api/analyze-interview" });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "O Agente de IA ainda não está configurado." }, { status: 503 });
    const body = await request.json();
    const panel = typeof body?.panel === "string" ? body.panel.trim() : "Painel não identificado";
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 40) return NextResponse.json({ ok: false, error: "O relato é insuficiente para análise." }, { status: 400 });
    let model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";
    if (model === "gpt-5.6") model = "gpt-5.6-sol";

    const prompt = `Atue como especialista em Avaliação Externa das Escolas em Portugal.
Analise as notas integrais de uma entrevista ao painel «${panel}» e organize apenas a informação probatoriamente útil pelos campos do referencial.

Regras:
1. Não copie frases soltas nem produza uma ata da entrevista.
2. Formule sínteses interpretativas coesas, em português europeu, distinguindo declaração, prática, resultado e impacto.
3. Não trate a afirmação de um entrevistado como facto comprovado; use linguagem prudente e indique necessidade de triangulação.
4. Não invente informação nem causalidade.
5. Registe elementos concretos de suporte, sem nomes de pessoas.
6. Sinalize contradições internas, reservas, generalizações e ausência de demonstração de impacto.
7. Converta lacunas em questões objetivas para outros painéis ou pedidos documentais.
8. Marque como pertinente apenas os campos efetivamente sustentados pelo relato.
9. Atribua cada ideia ao campo principal, evitando repetição entre campos.

Campos:
${CAMPOS_AEE.map((campo, index) => `${index + 1}. ${campo}`).join("\n")}

Relato integral:
---
${text.slice(0, 100_000)}
---`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, store: false, input: prompt,
        text: { format: { type: "json_schema", name: "analise_entrevista_aee", strict: true, schema: {
          type: "object", additionalProperties: false,
          properties: { analises: { type: "array", items: { type: "object", additionalProperties: false,
            properties: {
              campo: { type: "string", enum: CAMPOS_AEE }, pertinente: { type: "boolean" }, sintese: { type: "string" },
              suporte: { type: "array", items: { type: "string" } }, reservas: { type: "array", items: { type: "string" } },
              questoesAprofundar: { type: "array", items: { type: "string" } },
            }, required: ["campo", "pertinente", "sintese", "suporte", "reservas", "questoesAprofundar"],
          } } }, required: ["analises"],
        } } },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const quota = data?.error?.code === "insufficient_quota" || /quota|billing/i.test(data?.error?.message ?? "");
      return NextResponse.json({ ok: false, error: quota ? "A conta da API não tem saldo disponível ou atingiu o limite de utilização." : data?.error?.message || "A IA não conseguiu analisar o relato." }, { status: response.status });
    }
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A resposta da IA não contém uma análise utilizável." }, { status: 502 });
    const analysis = JSON.parse(raw);
    return NextResponse.json({ ok: true, model, analysis, result: analysis, data: analysis });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na análise da entrevista." }, { status: 500 });
  }
}
