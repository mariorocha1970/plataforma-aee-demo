import { NextRequest, NextResponse } from "next/server";
import { normalizeAcronyms } from "../../text-normalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { relatorio: { type: "string" } },
  required: ["relatorio"],
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
    const narratives = Array.isArray(body?.narratives) ? body.narratives.slice(0, 12) : [];
    if (!narratives.length) return NextResponse.json({ ok: false, error: "Não existem triangulações revistas para redigir o relatório." }, { status: 400 });
    const schoolName = String(body?.schoolName || "a organização escolar").slice(0, 180);
    const localDraft = String(body?.localDraft || "").slice(0, 40_000);
    const mandatoryAcademicComparisons = (Array.isArray(body?.mandatoryAcademicComparisons) ? body.mandatoryAcademicComparisons : [])
      .map((item: any) => String(item || "").slice(0, 2_500)).filter(Boolean).slice(0, 12);
    const prompt = `Aprimore a minuta de um relatório de Avaliação Externa das Escolas, em português europeu, relativa a ${schoolName}.

TRIANGULAÇÕES REVISTAS POR CAMPO:
${JSON.stringify(narratives)}

MINUTA LOCAL A PRESERVAR COMO ESTRUTURA:
---

FACTOS ESTATÍSTICOS JÁ INTEGRADOS NA TRIANGULAÇÃO DE 5.4.1 E A PRESERVAR:
${JSON.stringify(mandatoryAcademicComparisons)}
${localDraft}
---

REGRAS:
- Preserve rigorosamente a organização pelos domínios e campos 5.1.1 a 5.4.3 presentes na minuta.
- Redija ao estilo dos relatórios da IGEC: texto contínuo, denso, sistemático, conciso e avaliativo, sem listas de evidências, sem descrição do funcionamento da plataforma e sem fórmulas metadiscursivas.
- Em cada campo, organize a redação pela sequência prática ou resultado predominante → evidência convergente → alcance/efeito → limitação materialmente relevante. Não enumere documentos nem repita a mesma ideia sob formulações diferentes.
- Use, em regra, um a três parágrafos curtos por campo. Evite transformar o relatório numa reprodução da matriz ou da triangulação.
- Preserve o sentido e as reservas das triangulações; não acrescente factos, causalidade ou classificações.
- Use o diagnóstico probatório incluído em cada campo para rever as reservas metodológicas.
- Elimine fórmulas genéricas sobre “representatividade restrita” ou “evidência independente adicional” quando não sejam justificadas pelo diagnóstico.
- Não equipare quantidade de fontes a robustez. Use evidenceQuality para a qualidade probatória das evidências face aos indicadores e triangulation para a confirmação independente.
- A autoridade de uma fonte não cria cobertura automática; uma constatação histórica deve ser apresentada como histórica se não houver confirmação atual.
- Se coveragePercent for 100, não afirme que faltam indicadores. Se evidenceQuality for Forte, triangulation for Confirmada, hasResultsOrImpact for verdadeiro e não houver contradições, omita inteiramente a reserva metodológica.
- Quando exista uma limitação, identifique-a concretamente: indicadores sem evidência, qualidade probatória insuficiente, triangulação parcial/não realizada, contradição ou ausência de resultados/impacto.
- Nunca repita a mesma reserva por rotina em vários campos e não produza pontuação duplicada.
- Distinga intenção, prática, monitorização, resultado e impacto.
- No campo 5.4.1 — Resultados académicos, trate os dados do InfoEscolas apenas em leitura comparada entre a escola/agrupamento e a referência nacional, considerando os três últimos anos letivos disponíveis.
- Em 5.4.1, redija dois a quatro parágrafos curtos, ao estilo IGEC, com uma apreciação global do triénio e uma leitura articulada do 1.º, 2.º e 3.º ciclos, dos cursos científico-humanísticos e do ensino profissional, quando existam dados. Não produza um inventário de indicadores.
- Para os percursos diretos de sucesso, privilegie a tendência trienal e use, em regra, apenas o valor mais recente da escola e da referência nacional para concretizar a apreciação. Só acrescente outro valor quando seja indispensável para demonstrar uma oscilação material.
- Os dados dos alunos beneficiários da ação social escolar podem sustentar a apreciação da equidade e completar a leitura do 1.º e 2.º ciclos, mas devem ser integrados em prosa, sem séries anuais autónomas.
- Não transcreva para o Relatório séries anuais autónomas relativas a ASE, provas nacionais, retenção/desistência ou outros gráficos. Essas evidências podem sustentar a interpretação triangulada e referências qualitativas sintéticas, mas não devem avolumar o texto com novos inventários de valores.
- Preserve o sentido dos factos estatísticos integrados na triangulação, mas selecione apenas os valores necessários à fundamentação do juízo. Não reproduza integralmente as séries, diferenças anuais ou cautelas repetidas.
- Para cada ciclo ou oferta, privilegie exclusivamente, na apresentação quantitativa do Relatório, o indicador de conclusão no tempo esperado (ou a designação oficial equivalente). Não transforme os restantes gráficos do InfoEscolas em séries estatísticas autónomas na narrativa.
- Nunca apresente um valor isolado da escola como comparação. Sempre que indicar um valor quantitativo, associe-lhe a referência adequada ou enquadre-o expressamente como dado interno. Se faltar uma série, não invente a comparação nem transforme a lacuna num parágrafo autónomo.
- É proibido terminar 5.4.1 com parágrafos adicionais iniciados por «No indicador» ou repetir, depois da síntese avaliativa, as séries estatísticas que a sustentam.
- Não apresente perceções isoladas como factos comprovados.
- Não cite nomes de ficheiros, páginas ou identificadores no corpo do relatório.
- Evite repetições, generalizações e linguagem promocional.
- Na primeira utilização de qualquer sigla, escreva primeiro a designação por extenso, em minúsculas, e só depois a sigla em maiúsculas entre parênteses. Nas utilizações seguintes use apenas a sigla.
- Mantenha a indicação de minuta sujeita a validação humana.
- Devolva apenas o relatório integral.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "medium" },
        max_output_tokens: 5_000,
        text: { format: { type: "json_schema", name: "relatorio_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a redação." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu um relatório utilizável. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. A minuta local foi preservada e não houve repetição automática paga." }, { status: 502 }); }
    return NextResponse.json({ ok: true, report: normalizeAcronyms(String(result?.relatorio || "").trim()) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na redação do relatório." }, { status: 500 });
  }
}
