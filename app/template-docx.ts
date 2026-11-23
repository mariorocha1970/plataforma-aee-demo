import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

const SIMPLIFIED_REPORT_VERSION = "2026.11.23-v38.5";

type Audience = "alunos" | "familias";
type ReportContent = {
  introducao?: string;
  pontosFortes?: Record<string, string[]>;
  areasMelhoria?: Record<string, string[]>;
  projetosInteressantes?: string[];
  papelFamilias?: string[];
  classificacoes?: Array<{ dominio: string; classificacao: string }>;
};

type SchoolMeta = {
  dates: string;
  schools: string[];
};

type ValidatedMeta = { school?: string; observationDates?: string; visitDates?: string; schools?: string[] };

const DOMAINS = ["Autoavaliação", "Liderança e gestão", "Prestação do serviço educativo", "Resultados"];

function decodeXml(value: string) {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[‑–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
}

function paragraphText(block: string) {
  return decodeXml([...block.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(""));
}

function replaceParagraphText(block: string, value: string) {
  let first = true;
  return block.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (tag) => {
    if (!first) return tag.replace(/>[^<]*<\/w:t>$/, "></w:t>");
    first = false;
    return tag.replace(/>[^<]*<\/w:t>$/, ` xml:space="preserve">${escapeXml(value)}</w:t>`).replace(/<w:t([^>]*)\s+xml:space="preserve"([^>]*)\s+xml:space="preserve">/, '<w:t$1 xml:space="preserve"$2>');
  })
    .replace(/<w:(?:noBreakHyphen|softHyphen|tab)\s*\/>/g, "")
    .replace(/<w:ptab\b[^>]*\/>/g, "");
}

function paragraphWithFragments(block: string, fragments: Array<{ text: string; color?: string }>) {
  const pPr = block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const firstRPr = block.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || "<w:rPr/>";
  const run = (text: string, color?: string) => {
    let rPr = firstRPr;
    if (color) {
      rPr = /<w:color\b[^>]*\/>/.test(rPr)
        ? rPr.replace(/<w:color\b[^>]*\/>/, `<w:color w:val="${color}"/>`)
        : rPr.replace(/<\/w:rPr>/, `<w:color w:val="${color}"/></w:rPr>`).replace("<w:rPr/>", `<w:rPr><w:color w:val="${color}"/></w:rPr>`);
    } else {
      rPr = rPr.replace(/<w:color\b[^>]*\/>/g, "");
    }
    return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  };
  return block.replace(/(<w:p(?:\s[^>]*)?>)[\s\S]*?(<\/w:p>)/, `$1${pPr}${fragments.map((fragment) => run(fragment.text, fragment.color)).join("")}$2`);
}

function paragraphWithIgecLink(block: string, relationshipId: string) {
  const pPr = block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  const firstRPr = block.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] || "<w:rPr/>";
  const staticRPr = firstRPr.replace(/<w:color\b[^>]*\/>/g, "");
  const staticText = "Recolhemos evidências para nos permitir avaliar o trabalho do Agrupamento utilizando o quadro de referência da Avaliação Externa das Escolas que se organiza em quatro domínios e doze campos de análise, cada um deles explicitado por um conjunto de referentes e estes por indicadores. Consulte a ";
  const staticRun = `<w:r>${staticRPr}<w:t xml:space="preserve">${escapeXml(staticText)}</w:t></w:r>`;
  const linkRPr = firstRPr.replace(/<w:color\b[^>]*\/>/g, "").replace(/<\/w:rPr>/, '<w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>').replace("<w:rPr/>", '<w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>');
  const hyperlink = `<w:hyperlink r:id="${relationshipId}" w:history="1"><w:r>${linkRPr}<w:t>página da IGEC</w:t></w:r></w:hyperlink>`;
  const period = `<w:r>${staticRPr}<w:t>.</w:t></w:r>`;
  return block.replace(/(<w:p(?:\s[^>]*)?>)[\s\S]*?(<\/w:p>)/, `$1${pPr}${staticRun}${hyperlink}${period}$2`);
}

function extractSchoolMeta(sourceReport: string): SchoolMeta {
  const source = sourceReport.slice(0, 30_000).replace(/\s+/g, " ");
  const datePattern = /(?:entre os dias\s+)?(\d{1,2})\s+e\s+(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(20\d{2})/gi;
  const dates = [...source.matchAll(datePattern)];
  const lastDate = dates.at(-1);
  const formattedDates = lastDate ? `${lastDate[1]} e ${lastDate[2]} de ${lastDate[3].toLowerCase()} de ${lastDate[4]}` : "[datas da visita]";

  const intro = source.split(/Escala de avaliação|2\.\s*Quadro resumo/i)[0];
  const observationMatches = [...intro.matchAll(/(?:realizou|realizada|efetuada)[^.]{0,120}observa(?:ção|da)[^.]*?\b(?:na|no|nas|nos)\s+([^.]+)/gi)];
  const observedList = observationMatches.at(-1)?.[1] || "";
  const observedSchools = observedList
    .split(/\s*(?:,\s*|\s+e\s+)(?:na|no|nas|nos)\s+/i)
    .map((value) => value.trim().replace(/\s+/g, " "))
    .filter((value) => /^(?:Escola|Jardim de Infância)\b/i.test(value));
  const candidates = (observedSchools.length ? observedSchools : [...intro.matchAll(/\b(?:Escola|Jardim de Infância)\s+(?:Básica(?:\s+e\s+Secundária)?|Secundária)?\s*(?:de|do|da|dos|das)?\s*[^,.;:]+/gi)].map((match) => match[0]))
    .map((value) => String(value).trim().replace(/\s+/g, " "))
    .filter((value) => !/^Escolas\b/i.test(value) && !/Agrupamento/i.test(value));
  const unique = candidates.filter((value, index) => candidates.findIndex((candidate) => normalize(candidate) === normalize(value)) === index);
  return { dates: formattedDates, schools: unique.slice(-8) };
}

function naturalList(values: string[]) {
  if (values.length <= 1) return values[0] || "[estabelecimentos visitados]";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function fixedIntroduction(audience: Audience, school: string, sourceReport: string, validatedMeta?: ValidatedMeta) {
  const extracted = extractSchoolMeta(sourceReport);
  const meta = {
    visitDates: validatedMeta?.visitDates || extracted.dates,
    observationDates: validatedMeta?.observationDates || "",
    schools: validatedMeta?.schools?.length ? validatedMeta.schools : extracted.schools,
  };
  const establishments = naturalList(meta.schools);
  const count = meta.schools.length;
  if (audience === "alunos") {
    return [
      [
        { text: "Entre os dias " }, { text: meta.visitDates, color: "42AFB6" },
        { text: ", uma equipa coordenada pela Inspeção‑Geral da Educação e Ciência visitou o " }, { text: school, color: "42AFB6" },
        { text: " para realizar a avaliação externa do " }, { text: "Agrupamento", color: "42AFB6" }, { text: "." },
      ],
      [
        { text: "Durante a visita, os avaliadores falaram com vários membros da comunidade educativa, incluindo alunos e encarregados de educação, e estiveram nas " },
        { text: `${count || "várias"} escolas do Agrupamento: ${establishments}`, color: "42AFB6" },
        { text: meta.observationDates ? `. Nos dias ${meta.observationDates}, também assistiram a algumas aulas e atividades, para conhecer melhor a forma como se trabalha e aprende nas escolas observadas.` : ". Também assistiram a algumas aulas e atividades, para conhecer melhor a forma como se trabalha e aprende nas escolas observadas." },
      ],
    ];
  }
  return [[
    { text: "Entre os dias " }, { text: meta.visitDates, color: "31849B" },
    { text: ", uma equipa coordenada pela Inspeção-Geral da Educação e Ciência visitou o " }, { text: school, color: "31849B" },
    { text: ", com o objetivo de proceder à respetiva avaliação externa. Durante a visita, conversámos com representantes da comunidade educativa, incluindo encarregados de educação e alunos e estivemos nas " },
    { text: establishments, color: "31849B" },
    { text: meta.observationDates ? `. Nos dias ${meta.observationDates}, também observámos algumas atividades e aulas para conhecer melhor a dinâmica educativa nas escolas observadas.` : ". Também observámos algumas atividades e aulas para conhecer melhor a dinâmica educativa nas escolas observadas." },
  ], [
    { text: "A avaliação do Agrupamento incidiu em quatro grandes áreas: Autoavaliação (o que é que a escola faz para melhorar), Liderança e gestão (como é liderado e gerido o Agrupamento), Prestação do serviço educativo (como se ensina, aprende e avalia) e Resultados (que resultados académicos e outros têm os alunos)." },
  ]];
}

function replaceCoverSchool(block: string, school: string) {
  const parts = school.split(/\s*[,–-]\s*/).map((value) => value.trim()).filter(Boolean);
  const organisation = (parts.shift() || school).toUpperCase();
  const locality = parts.join(" - ").toUpperCase();
  let index = 0;
  const values = [organisation, " ", locality];
  const resized = block.replace(/<w:sz(Cs)? w:val="48"\/>/g, '<w:sz$1 w:val="40"/>');
  return resized.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g, (tag) => tag.replace(/>[^<]*<\/w:t>$/, ` xml:space="preserve">${escapeXml(values[index++] || "")}</w:t>`).replace(/<w:t([^>]*)\s+xml:space="preserve"([^>]*)\s+xml:space="preserve">/, '<w:t$1 xml:space="preserve"$2>'));
}

function clearListMarker(block: string) {
  return block.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, "");
}

function alignListParagraph(block: string) {
  const indentation = '<w:ind w:left="540" w:hanging="300"/>';
  if (/<w:pPr>/.test(block)) {
    return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => `<w:pPr>${/<w:ind\b[^>]*\/>/.test(inner) ? inner.replace(/<w:ind\b[^>]*\/>/, indentation) : `${inner}${indentation}`}</w:pPr>`);
  }
  return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr>${indentation}</w:pPr>`);
}

function setListSpacing(block: string, after: number) {
  const spacing = `<w:spacing w:before="0" w:after="${after}" w:line="276" w:lineRule="auto"/>`;
  if (/<w:pPr>/.test(block)) return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => {
    const clean = inner
      .replace(/<w:pStyle\b[^>]*\/>/g, "")
      .replace(/<w:spacing\b[^>]*\/>/g, "")
      .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/g, "")
      .replace(/<w:(?:contextualSpacing|pageBreakBefore|keepLines|keepNext)\b[^>]*\/>/g, "");
    return `<w:pPr>${clean}${spacing}</w:pPr>`;
  });
  return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr>${spacing}</w:pPr>`);
}

function setContentSpacing(block: string, before = 0, after = 120) {
  const spacing = `<w:spacing w:before="${before}" w:after="${after}" w:line="276" w:lineRule="auto"/>`;
  const pageBreakOverride = '<w:pageBreakBefore w:val="0"/>';
  if (/<w:pPr>/.test(block)) return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => {
    const withoutAutomaticSpacing = inner
      .replace(/<w:spacing\b[^>]*\/>/g, "")
      .replace(/<w:pageBreakBefore\b[^>]*\/>/g, "")
      .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/g, "")
      .replace(/<w:contextualSpacing\b[^>]*\/>/g, "");
    return `<w:pPr>${withoutAutomaticSpacing}${spacing}${pageBreakOverride}</w:pPr>`;
  });
  return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr>${spacing}${pageBreakOverride}</w:pPr>`);
}

function setPageBreakBefore(block: string) {
  const marker = '<w:pageBreakBefore/>';
  if (/<w:pPr>/.test(block)) return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => `<w:pPr>${inner.replace(/<w:pageBreakBefore\b[^>]*\/>/g, "")}${marker}</w:pPr>`);
  return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr>${marker}</w:pPr>`);
}

function setDomainHeadingSpacing(block: string) {
  // O estilo Título 2 dos templates inclui "quebra de página antes".
  // Retira-se a associação ao estilo e preserva-se a formatação direta do
  // próprio parágrafo, evitando que o primeiro domínio salte para outra página.
  return setContentSpacing(block, 160, 80)
    .replace(/<w:pStyle\b[^>]*\/>/g, "")
    .replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => `<w:pPr>${inner}<w:keepNext/></w:pPr>`);
}

function isStructurallyEmptyParagraph(block: string) {
  return !paragraphText(block).trim()
    && !/<(?:w:drawing|w:pict|w:object|c:chart|v:shape|wp:anchor|wp:inline)\b/.test(block);
}

function explicitBulletParagraph(block: string, value: string, spacingAfter: number) {
  return setListSpacing(alignListParagraph(clearListMarker(replaceParagraphText(block, `• ${value}`))), spacingAfter);
}

function insertPageBreakBefore(block: string) {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${block}`;
}

function compactStudentSecondChartPage(block: string) {
  const compacted = block.replace(/(<(?:wp|a):extent\b[^>]*\bcy=")(\d+)(")/g, (_match, start, value, end) => `${start}${Math.round(Number(value) * 0.78)}${end}`);
  return insertPageBreakBefore(compacted);
}

function addSpacingBefore(block: string, twips: number) {
  if (/<w:pPr>/.test(block)) {
    return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => {
      const spacing = /<w:spacing\b[^>]*\/>/.test(inner)
        ? inner.replace(/<w:spacing\b([^>]*)\/>/, (_spacing: string, attributes: string) => `<w:spacing${attributes.replace(/\s+w:before="[^"]*"/g, "")} w:before="${twips}"/>`)
        : `${inner}<w:spacing w:before="${twips}"/>`;
      return `<w:pPr>${spacing}</w:pPr>`;
    });
  }
  return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr><w:spacing w:before="${twips}"/></w:pPr>`);
}

function separateTextAndCharts(block: string) {
  if (!/<c:chart\b/.test(block) || !paragraphText(block).trim()) return block;
  const withoutCharts = block.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => /<c:chart\b/.test(run) ? "" : run);
  const chartOnly = block.replace(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g, (run) => /<c:chart\b/.test(run) ? run : "");
  return `${withoutCharts}${chartOnly}`;
}

function separateMultipleCharts(block: string) {
  const chartRuns = [...block.matchAll(/<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g)]
    .map((match) => match[0])
    .filter((run) => /<c:chart\b/.test(run));
  if (chartRuns.length < 2) return block;
  const pPr = block.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || "";
  return chartRuns.map((run) => `<w:p>${pPr}${run}</w:p>`).join("");
}

function chartsInDocumentFlow(xml: string, audience: Audience) {
  // Os templates antigos podiam guardar texto e gráficos no mesmo parágrafo,
  // usando coordenadas para os mostrar por outra ordem. Separe-os antes de
  // normalizar o fluxo, para que o texto introdutório fique sempre primeiro.
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, separateTextAndCharts);
  // Cada gráfico ocupa o seu próprio parágrafo. Isto cria uma separação real
  // entre figuras e impede que duas delas fiquem visualmente coladas.
  xml = xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, separateMultipleCharts);
  const inlineAnchor = (anchor: string) => {
    if (!/<c:chart\b/.test(anchor)) return anchor;
    // Preserve integralmente o desenho e a relação do gráfico. Alterar apenas
    // o contentor evita perder o <a:graphic> quando o Word acrescenta atributos
    // ou namespaces próprios ao template.
    return anchor
      .replace(/^<wp:anchor\b[^>]*>/, '<wp:inline distT="0" distB="0" distL="0" distR="0">')
      .replace(/<wp:simplePos\b[^>]*\/>/g, "")
      .replace(/<wp:positionH\b[\s\S]*?<\/wp:positionH>/g, "")
      .replace(/<wp:positionV\b[\s\S]*?<\/wp:positionV>/g, "")
      .replace(/<wp:wrap(?:None|Square|Tight|Through|TopAndBottom)\b[^>]*\/>/g, "")
      .replace(/<wp:wrap(?:Square|Tight|Through|TopAndBottom)\b[\s\S]*?<\/wp:wrap(?:Square|Tight|Through|TopAndBottom)>/g, "")
      .replace(/<wp:relativeHeight\b[^>]*\/>/g, "")
      .replace(/<wp:behindDoc\b[^>]*\/>/g, "")
      .replace(/<wp:layoutInCell\b[^>]*\/>/g, "")
      .replace(/<wp:allowOverlap\b[^>]*\/>/g, "")
      .replace(/<wp:lockedCanvas\b[^>]*\/>/g, "")
      .replace(/<\/wp:anchor>$/, "</wp:inline>");
  };
  let converted = xml.replace(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g, inlineAnchor);
  // No template dos alunos, o texto explicativo estava visualmente colocado
  // antes dos gráficos através de coordenadas flutuantes, apesar de surgir
  // depois deles na ordem XML. Em fluxo normal, a ordem tem de ser explícita.
  if (audience === "alunos") {
    const blocks = converted.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
    const introIndex = blocks.findIndex((block) => normalize(paragraphText(block)).includes(normalize("Através dos questionários respondidos pelos alunos")));
    const firstChartIndex = blocks.findIndex((block) => /<c:chart\b/.test(block));
    if (introIndex > firstChartIndex && firstChartIndex >= 0) {
      const [intro] = blocks.splice(introIndex, 1);
      blocks.splice(firstChartIndex, 0, intro);
      let cursor = 0;
      converted = converted.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, () => blocks[cursor++]);
    }
  }
  let chartsSeen = 0;
  return converted.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (block) => {
    if (!/<c:chart\b/.test(block)) return block;
    const chartsInBlock = (block.match(/<c:chart\b/g) || []).length;
    const startsSecondChartPage = chartsSeen === 2;
    if (audience === "familias" && chartsSeen >= 2) {
      // Compactação moderada apenas nos dois gráficos finais: preserva a
      // leitura e evita que o quadro de classificações seja dividido.
      block = block.replace(/(<(?:wp|a):extent\b[^>]*\bcy=")(\d+)(")/g, (_match, start, value, end) => `${start}${Math.round(Number(value) * 0.68)}${end}`);
    }
    chartsSeen += chartsInBlock;
    const spacing = `<w:spacing w:before="160" w:after="200" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/>${startsSecondChartPage ? '<w:pageBreakBefore/>' : ''}`;
    if (/<w:pPr>/.test(block)) return block.replace(/<w:pPr>([\s\S]*?)<\/w:pPr>/, (_match, inner) => `<w:pPr>${inner
      .replace(/<w:spacing\b[^>]*\/>/g, "")
      .replace(/<w:tabs>[\s\S]*?<\/w:tabs>/g, "")
      .replace(/<w:jc\b[^>]*\/>/g, "")
      .replace(/<w:(?:pageBreakBefore|keepNext|keepLines|contextualSpacing)\b[^>]*\/>/g, "")}${spacing}</w:pPr>`);
    return block.replace(/(<w:p(?:\s[^>]*)?>)/, `$1<w:pPr>${spacing}</w:pPr>`);
  });
}



type ParagraphInfo = { index: number; block: string; text: string; normalized: string };

function paragraphs(xml: string): ParagraphInfo[] {
  let index = 0;
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => {
    const text = paragraphText(match[0]);
    return { index: index++, block: match[0], text, normalized: normalize(text) };
  });
}

function patchDocumentXml(xml: string, audience: Audience, school: string, content: ReportContent, sourceReport: string, igecRelationshipId: string, validatedMeta?: ValidatedMeta) {
  const items = paragraphs(xml);
  const replacements = new Map<number, string>();
  const custom = new Map<number, (block: string) => string>();
  const find = (text: string, after = -1) => items.find((item) => item.index > after && item.normalized === normalize(text))?.index ?? -1;
  const findIncludes = (text: string, after = -1) => items.find((item) => item.index > after && item.normalized.includes(normalize(text)))?.index ?? -1;
  const nonEmptyBetween = (start: number, end: number) => items.filter((item) => item.index > start && item.index < end && item.text.trim());
  const fillRange = (start: number, end: number, values: string[]) => {
    const targets = nonEmptyBetween(start, end);
    // Os templates contêm parágrafos vazios usados como espaçadores manuais.
    // Depois de preencher listas com dimensão variável, esses parágrafos criam
    // grandes áreas brancas. Eliminam-se apenas os que não contêm desenhos,
    // tabelas, gráficos ou outros objetos.
    items.filter((item) => item.index > start && item.index < end && isStructurallyEmptyParagraph(item.block))
      .forEach((item) => custom.set(item.index, () => ""));
    const clean = values.map((value) => String(value || "").replace(/^\s*[•·▪-]\s*/, "").trim()).filter(Boolean);
    // Um único padrão para todos os itens: 1,15 linhas e 6 pt depois.
    // A paginação deve resultar do fluxo do texto, não de espaçamentos
    // diferentes calculados a partir do tamanho de cada lista.
    const spacingAfter = 120;
    targets.forEach((target, index) => {
      replacements.set(target.index, index < clean.length ? clean[index] : "");
      if (index >= clean.length) custom.set(target.index, clearListMarker);
      else custom.set(target.index, (block) => explicitBulletParagraph(block, clean[index], spacingAfter));
    });
    if (clean.length > targets.length && targets.length) {
      const last = targets.at(-1)!;
      replacements.set(last.index, clean[targets.length - 1]);
      custom.set(last.index, (block) => clean.slice(targets.length - 1).map((value) => explicitBulletParagraph(block, value, spacingAfter)).join(""));
    }
  };
  const findAfterAny = (variants: string[], after: number) => {
    const candidates = variants.map((variant) => find(variant, after)).filter((index) => index >= 0);
    return candidates.length ? Math.min(...candidates) : -1;
  };
  const domainValues = (source: Record<string, string[]> | undefined, domain: string) => Object.entries(source || {}).find(([key]) => normalize(key) === normalize(domain))?.[1] || [];
  const patchDomains = (sectionTitle: string, endMarker: string, source: Record<string, string[]> | undefined) => {
    const section = find(sectionTitle);
    const end = findIncludes(endMarker, section);
    if (section < 0 || end < 0) return;
    const headings = DOMAINS.map((domain, index) => ({ domain, index: findAfterAny(index === 1 ? ["Liderança e gestão", "Liderança e Gestão"] : index === 2 ? ["Prestação do serviço educativo", "Prestação do Serviço Educativo"] : [domain], section) }));
    headings.forEach((heading, index) => {
      if (heading.index < 0 || heading.index >= end) return;
      custom.set(heading.index, setDomainHeadingSpacing);
      const next = headings.slice(index + 1).find((candidate) => candidate.index > heading.index && candidate.index < end)?.index ?? end;
      fillRange(heading.index, next, domainValues(source, heading.domain));
    });
  };

  // Capa: conserva todos os objetos gráficos e altera apenas os campos variáveis.
  items.filter((item) => item.normalized === normalize("AGRUPAMENTO DE ESCOLAS DE CRISTELO PAREDES")).forEach((item) => custom.set(item.index, (block) => replaceCoverSchool(block, school)));
  items.filter((item) => item.normalized === normalize("RELATÓRIO para pais")).forEach((item) => replacements.set(item.index, "RELATÓRIO"));

  const greeting = audience === "alunos" ? find("Caros alunos") : find("Caros Pais e Encarregados de Educação");
  // As formas da capa são flutuantes. Sem uma quebra explícita, o Word pode
  // colocar a saudação por baixo dessas formas na primeira página, sobretudo
  // quando o documento é gerado noutro computador ou aberto noutra versão.
  // O template das famílias já contém a quebra depois da capa. Acrescentar
  // outra cria uma página 2 vazia. O template dos alunos precisa dela.
  if (greeting >= 0) custom.set(greeting, audience === "alunos"
    ? (block) => setPageBreakBefore(setContentSpacing(block, 0, 180))
    : (block) => setContentSpacing(block, 0, 180));
  const brokenStrengthHeading = find("os fortes", greeting);
  if (brokenStrengthHeading >= 0) replacements.set(brokenStrengthHeading, "");
  const strengthIntro = audience === "alunos" ? findIncludes("A equipa de avaliação identificou os seguintes aspetos", greeting) : findIncludes("A equipa de avaliação identificou os seguintes pontos fortes", greeting);
  const introductionTargets = nonEmptyBetween(greeting, strengthIntro);
  const introduction = fixedIntroduction(audience, school, sourceReport, validatedMeta);
  introductionTargets.forEach((target, index) => {
    if (introduction[index]) custom.set(target.index, (block) => setContentSpacing(paragraphWithFragments(block, introduction[index]), 0, 120));
    else replacements.set(target.index, "");
  });
  if (strengthIntro >= 0) custom.set(strengthIntro, (block) => setContentSpacing(block, 0, 120));

  patchDomains(audience === "alunos" ? "O que está a correr bem?" : "Pontos fortes", audience === "alunos" ? "Os avaliadores identificaram também" : "Foram identificadas as seguintes áreas", content.pontosFortes);
  patchDomains(audience === "alunos" ? "O que pode melhorar?" : "Áreas de melhoria", audience === "alunos" ? "O Agrupamento dinamiza diversos projetos" : "O Agrupamento dinamiza uma variedade", content.areasMelhoria);

  const questionnaireIntro = audience === "alunos" ? findIncludes("Através dos questionários respondidos pelos alunos") : findIncludes("Através dos questionários aplicados aos pais");
  if (questionnaireIntro >= 0) custom.set(questionnaireIntro, separateTextAndCharts);

  const projectsHeading = find(audience === "alunos" ? "Projetos interessantes" : "Projetos");
  const projectsEnd = audience === "alunos" ? findIncludes("Através dos questionários respondidos pelos alunos", projectsHeading) : findIncludes("O Agrupamento reconhece e valoriza", projectsHeading);
  if (projectsHeading >= 0 && projectsEnd > projectsHeading) fillRange(projectsHeading, projectsEnd, content.projetosInteressantes || []);
  if (projectsEnd >= 0) custom.set(projectsEnd, (block) => setContentSpacing(block, 160, 120));
  if (audience === "familias") {
    const familyHeading = find("Valorização do papel dos pais na vida escolar");
    const familyEnd = findIncludes("Através dos questionários aplicados aos pais", familyHeading);
    if (familyHeading >= 0 && familyEnd > familyHeading) fillRange(familyHeading, familyEnd, content.papelFamilias || []);
    if (familyEnd >= 0) custom.set(familyEnd, (block) => setContentSpacing(block, 160, 120));
  }

  const ratingIntro = findIncludes("Considerando uma escala de avaliação de cinco níveis");
  if (ratingIntro >= 0) custom.set(ratingIntro, (block) => setContentSpacing(block, 120, 120));
  if (ratingIntro >= 0) {
    for (const rating of content.classificacoes || []) {
      const domainIndex = findAfterAny([rating.dominio, rating.dominio.replace("Gestão", "gestão").replace("Serviço", "serviço")], ratingIntro);
      const valueTarget = items.find((item) => item.index > domainIndex && item.text.trim());
      if (domainIndex >= 0 && valueTarget) replacements.set(valueTarget.index, rating.classificacao);
    }
  }

  const igecReference = items.find((item) => /igec\.mec\.pt\/content_01\.asp/i.test(item.text));
  if (igecReference) custom.set(igecReference.index, (block) => setContentSpacing(paragraphWithIgecLink(block, igecRelationshipId), 160, 0));

  // Referências textuais à escola no fecho e na avaliação.
  items.forEach((item) => {
    if (replacements.has(item.index)) return;
    if (/Agrupamento de Escolas de Cristelo(?:\s*[-–]\s*Paredes)?/i.test(item.text)) replacements.set(item.index, item.text.replace(/Agrupamento de Escolas de Cristelo(?:\s*[-–]\s*Paredes)?/gi, school));
  });

  let paragraphIndex = 0;
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (block) => {
    const index = paragraphIndex++;
    const replacement = replacements.get(index);
    const patched = replacement === undefined ? block : replaceParagraphText(block, replacement);
    return custom.get(index)?.(patched) ?? patched;
  });
}

function patchSchoolReferences(xml: string, school: string) {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, (block) => {
    const text = paragraphText(block);
    if (!/Agrupamento de Escolas de Cristelo(?:\s*[-–]\s*Paredes)?/i.test(text)) return block;
    return replaceParagraphText(block, text.replace(/Agrupamento de Escolas de Cristelo(?:\s*[-–]\s*Paredes)?/gi, school));
  });
}

function cachePoints(values: Array<string | number>, numeric: boolean) {
  return `<c:ptCount val="${values.length}"/>${values.map((value, index) => `<c:pt idx="${index}"><c:v>${numeric ? Number(value) : escapeXml(String(value))}</c:v></c:pt>`).join("")}`;
}

function patchChartXml(xml: string, items: Array<{ item: string; total: number }>) {
  const categories = cachePoints(items.map((item) => item.item), false);
  const values = `<c:formatCode>0.0</c:formatCode>${cachePoints(items.map((item) => item.total), true)}`;
  let patched = xml
    .replace(/(<c:cat>[\s\S]*?<c:strCache>)[\s\S]*?(<\/c:strCache>[\s\S]*?<\/c:cat>)/, `$1${categories}$2`)
    .replace(/(<c:val>[\s\S]*?<c:numCache>)[\s\S]*?(<\/c:numCache>[\s\S]*?<\/c:val>)/, `$1${values}$2`)
    .replace(/<c:f>[\s\S]*?<\/c:f>/g, "")
    .replace(/<c:externalData\b[\s\S]*?<\/c:externalData>/g, "");
  if (/<c:barDir val="bar"\/>/.test(patched)) {
    const maximum = Math.min(100, Math.max(10, Math.ceil(Math.max(...items.map((item) => Number(item.total) || 0)) / 10) * 10));
    patched = patched.replace(/<c:max val="[^"]+"\/>/, `<c:max val="${maximum}"/>`);
    if (!/<c:max val=/.test(patched)) patched = patched.replace(/<c:scaling>/, `<c:scaling><c:max val="${maximum}"/>`);
    if (!/<c:min val=/.test(patched)) patched = patched.replace(/<c:scaling>/, '<c:scaling><c:min val="0"/>');
  }
  return patched;
}

async function exactCoverImage(file: File) {
  const source = Buffer.from(await file.arrayBuffer());
  // Mantém a fotografia original, a sua proporção e todo o enquadramento.
  return sharp(source).rotate().jpeg({ quality: 96 }).toBuffer();
}

function groupCode(value: string) {
  return value.match(/\bQ\s*([1256])\b/i)?.[1] ? `Q${value.match(/\bQ\s*([1256])\b/i)?.[1]}` : "";
}

export async function buildTemplateReport(args: { audience: Audience; school: string; content: ReportContent; analysis: any; cover?: File | null; sourceReport?: string; metadata?: ValidatedMeta }) {
  const template = path.join(process.cwd(), "templates", args.audience === "alunos" ? "relatorio-alunos.docx" : "relatorio-familias.docx");
  const zip = await JSZip.loadAsync(await fs.readFile(template));
  const corePath = "docProps/core.xml";
  const core = zip.file(corePath);
  if (core) {
    let coreXml = await core.async("string");
    const provenance = escapeXml(`Plataforma AEE · Relatórios simplificados · ${SIMPLIFIED_REPORT_VERSION}`);
    if (/<dc:description\b[^>]*>[\s\S]*?<\/dc:description>/i.test(coreXml)) coreXml = coreXml.replace(/<dc:description\b[^>]*>[\s\S]*?<\/dc:description>/i, `<dc:description>${provenance}</dc:description>`);
    else coreXml = coreXml.replace("</cp:coreProperties>", `<dc:description>${provenance}</dc:description></cp:coreProperties>`);
    zip.file(corePath, coreXml);
  }
  const documentPath = "word/document.xml";
  const documentXml = await zip.file(documentPath)!.async("string");
  const relPath = "word/_rels/document.xml.rels";
  const igecRelationshipId = "rIdIgecReference";
  const igecUrl = "https://www.igec.mec.pt/content_01.asp?BtreeID=03/01&treeID=03/01/03/00&auxID=&newsID=2762#content";
  let documentRels = await zip.file(relPath)!.async("string");
  if (!documentRels.includes(`Id="${igecRelationshipId}"`)) {
    documentRels = documentRels.replace("</Relationships>", `<Relationship Id="${igecRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXml(igecUrl)}" TargetMode="External"/></Relationships>`);
    zip.file(relPath, documentRels);
  }
  zip.file(documentPath, chartsInDocumentFlow(patchDocumentXml(documentXml, args.audience, args.school, args.content, args.sourceReport || "", igecRelationshipId, args.metadata), args.audience));
  for (const name of Object.keys(zip.files).filter((value) => /^word\/(?:header|footer)\d+\.xml$/i.test(value))) {
    const file = zip.file(name);
    if (file) zip.file(name, patchSchoolReferences(await file.async("string"), args.school));
  }

  const groups = new Map((Array.isArray(args.analysis?.grupos) ? args.analysis.grupos : []).map((group: any) => [groupCode(String(group.grupo || "")), group]));
  const mapping = args.audience === "alunos"
    ? [[1, "Q1", "menorConcordancia"], [2, "Q1", "maiorConcordancia"], [3, "Q2", "maiorConcordancia"], [4, "Q2", "menorConcordancia"]]
    : [[1, "Q5", "menorConcordancia"], [2, "Q5", "maiorConcordancia"], [3, "Q6", "maiorConcordancia"], [4, "Q6", "menorConcordancia"]];
  for (const [chartNumber, code, field] of mapping as Array<[number, string, string]>) {
    const group: any = groups.get(code);
    const chartPath = `word/charts/chart${chartNumber}.xml`;
    const chart = zip.file(chartPath);
    if (chart && Array.isArray(group?.[field])) {
      zip.file(chartPath, patchChartXml(await chart.async("string"), group[field]));
      const chartRelsPath = `word/charts/_rels/chart${chartNumber}.xml.rels`;
      const chartRels = zip.file(chartRelsPath);
      if (chartRels) {
        const relationships = await chartRels.async("string");
        zip.file(chartRelsPath, relationships.replace(/<Relationship\b(?=[^>]*Type="[^"]*\/oleObject")(?=[^>]*TargetMode="External")[^>]*\/>/g, ""));
      }
    }
  }

  if (args.cover && /^image\/(?:png|jpeg)$/.test(args.cover.type)) {
    const coverImage = await exactCoverImage(args.cover);
    if (args.audience === "alunos") {
      zip.file("word/media/image2.jpeg", coverImage);
      zip.file("word/media/image3.jpeg", coverImage);
    } else {
      zip.file("word/media/dynamic-cover.jpeg", coverImage);
      const rels = await zip.file(relPath)!.async("string");
      zip.file(relPath, rels.replace(/Target="media\/(?:image2|image20)\.emf"/g, 'Target="media/dynamic-cover.jpeg"'));
      const typesPath = "[Content_Types].xml";
      const types = await zip.file(typesPath)!.async("string");
      if (!/Extension="jpeg"/i.test(types)) zip.file(typesPath, types.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>'));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 7 } });
}
