import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { narrativa: { type: "string" } },
  required: ["narrativa"],
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
    const field = body?.field;
    const diagnostic = body?.diagnostic || {};
    const evidence = Array.isArray(body?.evidence) ? body.evidence.slice(0, 40) : [];
    const mandatoryAcademicComparisons = (Array.isArray(body?.mandatoryAcademicComparisons) ? body.mandatoryAcademicComparisons : [])
      .map((item: any) => String(item || "").slice(0, 2_500)).filter(Boolean).slice(0, 12);
    if (!field?.name || !evidence.length) return NextResponse.json({ ok: false, error: "O campo não contém evidências validadas." }, { status: 400 });

    const profiles = new Map((Array.isArray(diagnostic?.evidenceProfiles) ? diagnostic.evidenceProfiles : []).map((item: any) => [Number(item?.evidenceId), item]));
    const compactEvidence = evidence.map((item: any, index: number) => ({
      id: index + 1,
      afirmacao: String(item?.claim || "").slice(0, 900),
      fonte: String(item?.source || "").slice(0, 180),
      tipo: String(item?.sourceType || ""),
      localizacao: String(item?.location || "").slice(0, 180),
      estado: String(item?.status || ""),
      qualidadeProbatoria: profiles.get(Number(item?.id)) || String(item?.strength || ""),
      indicadores: Array.isArray(item?.indicatorIds) ? item.indicatorIds.map(String) : [],
    }));
    const prompt = `Produza uma síntese de triangulação para Avaliação Externa das Escolas, em português europeu.

CAMPO: ${field.section} — ${field.name}
DOMÍNIO: ${field.domain}
REFERENTES: ${(Array.isArray(field.referents) ? field.referents : []).join("; ")}

EVIDÊNCIAS VALIDADAS:
${JSON.stringify(compactEvidence)}

DIAGNÓSTICO PROBATÓRIO DO CAMPO:
${JSON.stringify(diagnostic)}

ANÁLISES ESTATÍSTICAS COMPARADAS A TRIANGULAR E PRESERVAR:
${JSON.stringify(mandatoryAcademicComparisons)}

REGRAS:
- Cruze semanticamente as fontes; não se limite a enumerá-las.
- Avalie cada evidência na relação com o indicador associado; não atribua força uniforme a uma fonte nem use o número bruto de fontes como medida de robustez.
- A autoridade institucional da fonte reforça a credibilidade do que ela efetivamente demonstra, mas não cria cobertura automática nem prova a atualidade de evidência histórica.
- Use evidenceQuality para a qualidade probatória e triangulation como dimensão autónoma. Uma evidência forte pode ter triangulação não realizada sem deixar de ser forte.
- Distinga fontes independentes de mera repetição e documento normativo de prática comprovada.
- Distinga intenção, prática, monitorização, resultado e impacto.
- Identifique convergências, divergências, contradições e lacunas.
- Uma entrevista exprime informação testemunhal e não comprova isoladamente um facto.
- Não transforme ausência de evidência em evidência de ausência.
- Em 5.4.1, os dados do InfoEscolas só sustentam resultados académicos quando apresentam, para o mesmo indicador, a escola/agrupamento e o nacional em leitura comparada dos três últimos anos letivos. Não analise séries isoladas nem use outros gráficos contextuais como evidência académica.
- Na narrativa de 5.4.1 destinada ao Relatório, apresente dados quantitativos anuais apenas sobre os percursos diretos de sucesso: percentagem de alunos que concluem cada ciclo no tempo esperado (1.º ciclo em quatro anos, 2.º ciclo em dois anos, 3.º ciclo em três anos e, no secundário e profissional, no prazo definido pelo indicador oficial). Compare a escola/agrupamento com a referência nacional nos três últimos anos letivos disponíveis.
- Os dados sobre alunos com apoio ASE, provas nacionais, retenção/desistência e outros indicadores permanecem na base probatória e devem ser considerados na triangulação, mas não originam séries numéricas autónomas na narrativa final. Só podem sustentar uma síntese interpretativa sem inventário de valores, quando forem pertinentes e convergentes com outras evidências.
- Na leitura comparada, preserve os valores por ano, a diferença em pontos percentuais e a evolução da distância face ao nacional. Se a série estiver incompleta, declare essa limitação sem preencher valores nem concluir uma tendência.
- As análises estatísticas acima já foram validadas na Matriz. Integre os seus factos materiais na narrativa e cruze-os com as restantes evidências; distinga a descrição quantitativa da interpretação triangulada e não atribua causas sem confirmação independente.
- Não invente dados, frequência, causalidade ou representatividade.
- Redija 1 a 3 parágrafos contínuos, claros e sóbrios, sem citar nomes de ficheiros ou páginas no corpo.
- Não inclua reservas genéricas ou preventivas. Só formule uma reserva quando o diagnóstico identificar uma limitação concreta.
- Se coveragePercent for 100, não afirme que faltam indicadores. Se evidenceQuality for Forte, triangulation for Confirmada, hasResultsOrImpact for verdadeiro e não houver contradições, omita inteiramente a reserva.
- Quando exista limitação, nomeie-a com precisão: indicadores sem evidência, qualidade probatória insuficiente, triangulação parcial/não realizada, contradição ou ausência de resultados/impacto.
- Não formule uma classificação global nem use linguagem promocional.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_TRIANGULATION_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "minimal" },
        max_output_tokens: 1_800,
        text: { format: { type: "json_schema", name: "triangulacao_campo_aee", strict: true, schema: RESULT_SCHEMA } },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ ok: false, error: data?.error?.message || "A IA não concluiu a triangulação." }, { status: response.status });
    const raw = outputText(data);
    if (!raw) return NextResponse.json({ ok: false, error: "A IA não devolveu uma triangulação utilizável. Não houve repetição automática." }, { status: 502 });
    let result: any;
    try { result = JSON.parse(raw); } catch { return NextResponse.json({ ok: false, error: "A resposta ficou incompleta. Não houve repetição automática paga." }, { status: 502 }); }
    return NextResponse.json({ ok: true, narrative: String(result?.narrativa || "").trim() });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na triangulação." }, { status: 500 });
  }
}
