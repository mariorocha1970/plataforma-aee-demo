import { NextRequest, NextResponse } from "next/server";
import { normalizeAcronyms } from "../../text-normalization";

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
    evidenceSupport: { type: "string", enum: ["Sustentada", "Parcialmente sustentada", "Não sustentada"] },
    supportWarning: { type: "string" },
  },
  required: ["domain", "strengths", "improvements", "rating", "rationale", "evidenceSupport", "supportWarning"],
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

function enforceRatingConsistency(conclusions: any[], domains: any[]) {
  return conclusions.map((item: any) => {
    if (item?.ratingLocked) return item;
    if (item?.rating !== "Suficiente") return item;
    const domain = domains.find((candidate: any) => String(candidate?.domain) === String(item?.domain));
    const profiles = Array.isArray(domain?.evidenceProfile) ? domain.evidenceProfile : [];
    if (!profiles.length || profiles.some((profile: any) => Number(profile?.count || 0) === 0)) return item;
    const contradictions = profiles.filter((profile: any) => profile?.diagnostic?.hasContradictions).length;
    const strongFields = profiles.filter((profile: any) => String(profile?.strength) === "Forte" || String(profile?.diagnostic?.evidenceQuality) === "Forte").length;
    const balance = profiles.reduce((total: { positive: number; limitation: number }, profile: any) => ({
      positive: total.positive + Number(profile?.evaluativeBalance?.positive || 0) + Number(profile?.evaluativeBalance?.mixed || 0) * 0.5,
      limitation: total.limitation + Number(profile?.evaluativeBalance?.limitation || 0) + Number(profile?.evaluativeBalance?.mixed || 0) * 0.5,
    }), { positive: 0, limitation: 0 });
    const strengths = Array.isArray(item?.strengths) ? item.strengths : [];
    const improvements = Array.isArray(item?.improvements) ? item.improvements : [];
    const clearPositivePredominance = balance.positive >= 6 && balance.positive >= Math.max(1, balance.limitation * 1.75);
    const conclusionIsPositive = strengths.length >= 3 && strengths.length > improvements.length;
    if (contradictions > 0 || !clearPositivePredominance || !conclusionIsPositive) return item;
    const rating = strongFields >= Math.ceil(profiles.length / 2) && improvements.length <= 2 ? "Muito bom" : "Bom";
    const fieldNames = (Array.isArray(domain?.fields) ? domain.fields : []).map((field: any) => String(field?.name || "").trim()).filter(Boolean);
    return {
      ...item,
      rating,
      rationale: `O predomínio de evidências positivas, convergentes e abrangentes nos campos ${fieldNames.join(", ")} sustenta a menção de ${rating}. As limitações identificadas são localizadas e não apresentam peso equivalente ao conjunto dos pontos fortes e dos resultados demonstrados.`,
    };
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, error: "A API da OpenAI não está configurada." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    const domains = Array.isArray(body?.domains) ? body.domains.slice(0, 4) : [];
    if (domains.length !== 4) return NextResponse.json({ ok: false, error: "São necessários os quatro domínios e respetivas triangulações." }, { status: 400 });
    const schoolName = String(body?.schoolName || "a organização escolar").slice(0, 180);
    const domainsJson = JSON.stringify(domains);
    if (domainsJson.length > 700_000) return NextResponse.json({ ok: false, error: "O perfil probatório excede o limite seguro. Consolide as evidências excessivamente repetidas antes de repetir a síntese." }, { status: 413 });
    const prompt = `Formule a síntese conclusiva de uma Avaliação Externa das Escolas, em português europeu, relativa a ${schoolName}.

DADOS POR DOMÍNIO (narrativas trianguladas e perfil probatório detalhado por campo):
${domainsJson}

ESCALA:
- Excelente: predomínio de pontos fortes em todos os campos, com práticas inovadoras e resultados notáveis generalizados e sustentados, sem áreas que careçam de melhorias significativas.
- Muito bom: predomínio de pontos fortes em todos os campos, incluindo boas práticas e resultados notáveis de caráter generalizado.
- Bom: os pontos fortes sobrepõem-se de forma significativa aos pontos fracos nos campos analisados.
- Suficiente: equilíbrio entre pontos fortes e pontos fracos ou indefinição clara de impacto positivo.
- Insuficiente: predomínio de pontos fracos que exigem intervenção corretiva urgente e prioritária.

REGRAS:
- Devolva exatamente os quatro domínios e preserve a respetiva designação oficial.
- Quando um domínio inclua assessorRating, essa menção foi fixada pela equipa de avaliação: preserve-a rigorosamente, mas faça uma validação probatória independente. Nunca invente ou selecione apenas evidência favorável para a justificar.
- Para todas as menções, preencha evidenceSupport: «Sustentada» quando os critérios da escala estiverem claramente demonstrados; «Parcialmente sustentada» quando houver base relevante, mas subsistirem lacunas materiais; «Não sustentada» quando a menção contrariar o padrão probatório ou exceder o que as evidências permitem concluir.
- Em supportWarning, explique de modo conciso a lacuna ou contradição quando a sustentação não for plena. Se for «Sustentada», devolva uma cadeia vazia.
- Se uma menção fixada não estiver sustentada, mantenha-a como decisão da equipa, mas não produza uma fundamentação fictícia. A rationale deve distinguir a decisão assumida da limitação probatória e indicar objetivamente o que impede a sua validação plena.
- Pontos fortes e áreas de melhoria são juízos avaliativos concisos, autónomos e coerentes com o texto do relatório; não são listas de atividades nem transcrições de evidências.
- Formule apenas o que esteja sustentado pelas narrativas fornecidas. Não invente práticas, inovação, resultados, impacto ou generalização.
- Reanalise cada domínio de raiz. Não use uma proposta anterior como âncora e não presuma que a menção deve descer ou subir.
- Todos os quatro domínios foram incluídos integralmente. Nunca afirme que as narrativas ou o perfil probatório não contêm informação quando o campo apresenta count superior a zero ou uma narrativa não vazia. Nessa situação, analise expressamente a informação fornecida e identifique apenas a limitação concreta que subsista.
- Percorra todos os campos de cada domínio antes de formular a menção. A fundamentação deve refletir o padrão global do domínio e não uma única reserva ou um único campo.
- Leia integralmente evidenceInventory. Este inventário contém todas as evidências validadas, sem a seleção representativa aplicada aos restantes perfis, e prevalece sobre qualquer síntese abreviada quando esta omita uma prática, resultado, impacto, reserva ou contradição relevante.
- Percorra também todos os indicatorProfiles de cada campo, incluindo os que apresentem evidência positiva robusta. A seleção da menção deve resultar do conjunto dos indicadores aplicáveis; é proibido ignorar um indicador coberto apenas porque não foi referido na narrativa sintética.
- Cruze os indicatorProfiles com os sourceProfiles. Estes últimos asseguram que evidências documentais, quantitativas e testemunhais, incluindo entrevistas, são consideradas mesmo quando ainda não foram associadas manualmente a um indicador.
- A ausência de associação de algumas evidências a um indicador é uma questão de organização da matriz, não um sinal negativo sobre o domínio. Considere unlinkedEvidence pelo seu conteúdo, sem a transformar automaticamente em área de melhoria.
- Pondere a totalidade das evidências concretas incluídas no perfil probatório: convergência, independência das fontes, robustez, abrangência dos campos, generalização das práticas e demonstração de resultados ou impacto.
- Distinga ausência de evidência de evidência negativa. A falta de uma meta quantificada, de um dado de impacto ou de uma fonte adicional é uma limitação com alcance próprio; não deve, isoladamente, anular práticas consolidadas, resultados comprovados ou o predomínio de evidências positivas noutros referentes.
- Uma frase que apresente simultaneamente uma prática positiva e uma reserva deve ser ponderada nas duas componentes. Não classifique toda a frase como negativa apenas por conter «mas», «ausência», «limita», «carece» ou expressão equivalente.
- Uma área de melhoria localizada não determina automaticamente «Suficiente». Verifique se é estrutural, transversal e materialmente capaz de equilibrar ou superar os pontos fortes do domínio.
- «Suficiente» só é coerente quando os pontos fortes e as fragilidades apresentam peso global comparável, ou quando a evidência de efeitos positivos permanece verdadeiramente indefinida na maioria dos campos. Se os perfis mostrarem predomínio claro de evidência positiva, forte, triangulada e abrangente, escolha «Bom» ou «Muito bom» conforme a generalização e os resultados demonstrados; não use uma reserva localizada para baixar artificialmente a menção.
- Antes de propor a menção, faça um teste de coerência: a fundamentação deve explicar por que razão a evidência positiva e as limitações conduzem precisamente àquela menção, sem contradizer os pontos fortes e áreas de melhoria listados.
- Faça internamente uma apreciação campo a campo antes da classificação global: predomínio positivo/negativo, força, triangulação, generalização e resultados. Só depois agregue o domínio. Não exponha cálculos, mas assegure que nenhum campo ou tipo de fonte fica por ler.
- Use evaluativeBalance apenas como controlo auxiliar do sentido global das evidências, confirmando sempre o conteúdo das afirmações. Quando o balanço positivo for claramente predominante, não trate registos neutros ou meramente descritivos como fragilidades.
- Se propuser «Suficiente», identifique na fundamentação quais são as fragilidades de peso comparável aos pontos fortes e em que campos ocorrem. Uma fundamentação que apenas invoque falta de metas, dados de impacto ou uma reserva metodológica localizada é incompatível com «Suficiente» quando as práticas e resultados positivos são generalizados.
- Um ponto forte deve evidenciar relevância, abrangência e efeito positivo; uma área de melhoria deve identificar com clareza o processo ou resultado a aperfeiçoar, sem prescrever soluções.
- Não repita o mesmo conteúdo como ponto forte e área de melhoria.
- Não cite ficheiros, páginas, quantidades de fontes ou mecanismos internos da plataforma.
- Se a cobertura ou robustez forem insuficientes, use «Por definir» e explique objetivamente o que impede a classificação.
- «Excelente» exige evidência expressa de inovação, resultados notáveis generalizados e sustentados e ausência de melhorias significativas. «Muito bom» exige predomínio em todos os campos e resultados notáveis generalizados.
- A fundamentação deve explicar em duas ou três frases a relação entre o padrão dos juízos e a menção proposta, mencionando substantivamente os campos abrangidos.
- Na primeira utilização de qualquer sigla, escreva primeiro a designação por extenso, em minúsculas, e depois a sigla em maiúsculas entre parênteses.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_CONCLUSIONS_MODEL?.trim() || "gpt-5-mini",
        store: false,
        input: prompt,
        reasoning: { effort: "medium" },
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
    const conclusions = enforceRatingConsistency((Array.isArray(result?.conclusions) ? result.conclusions : []).map((item: any) => {
      const sourceDomain = domains.find((domain: any) => String(domain?.domain) === String(item?.domain));
      return {
      ...item,
      rating: sourceDomain?.assessorRating || item?.rating,
      ratingLocked: Boolean(sourceDomain?.assessorRating),
      evidenceSupport: item?.evidenceSupport,
      supportWarning: String(item?.supportWarning || ""),
      strengths: (Array.isArray(item?.strengths) ? item.strengths : []).map((value: any) => normalizeAcronyms(String(value))),
      improvements: (Array.isArray(item?.improvements) ? item.improvements : []).map((value: any) => normalizeAcronyms(String(value))),
      rationale: normalizeAcronyms(String(item?.rationale || "")),
    }; }), domains);
    return NextResponse.json({ ok: true, conclusions });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na síntese conclusiva." }, { status: 500 });
  }
}
