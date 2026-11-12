import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import sharp from "sharp";

type Audience = "alunos" | "familias";
type ReportContent = {
  introducao?: string;
  pontosFortes?: Record<string, string[]>;
  areasMelhoria?: Record<string, string[]>;
  projetosInteressantes?: string[];
  papelFamilias?: string[];
  classificacoes?: Array<{ dominio: string; classificacao: string }>;
};

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
  });
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

function insertPageBreakBefore(block: string) {
  return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>${block}`;
}



type ParagraphInfo = { index: number; block: string; text: string; normalized: string };

function paragraphs(xml: string): ParagraphInfo[] {
  let index = 0;
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((match) => {
    const text = paragraphText(match[0]);
    return { index: index++, block: match[0], text, normalized: normalize(text) };
  });
}

function patchDocumentXml(xml: string, audience: Audience, school: string, content: ReportContent) {
  const items = paragraphs(xml);
  const replacements = new Map<number, string>();
  const custom = new Map<number, (block: string) => string>();
  const find = (text: string, after = -1) => items.find((item) => item.index > after && item.normalized === normalize(text))?.index ?? -1;
  const findIncludes = (text: string, after = -1) => items.find((item) => item.index > after && item.normalized.includes(normalize(text)))?.index ?? -1;
  const nonEmptyBetween = (start: number, end: number) => items.filter((item) => item.index > start && item.index < end && item.text.trim());
  const fillRange = (start: number, end: number, values: string[]) => {
    const targets = nonEmptyBetween(start, end);
    const clean = values.map((value) => String(value || "").replace(/^\s*[•·▪-]\s*/, "").trim()).filter(Boolean);
    targets.forEach((target, index) => {
      replacements.set(target.index, index < clean.length ? clean[index] : "");
      if (index >= clean.length) custom.set(target.index, clearListMarker);
    });
    if (clean.length > targets.length && targets.length) replacements.set(targets.at(-1)!.index, clean.slice(targets.length - 1).join(" • "));
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
      const next = headings.slice(index + 1).find((candidate) => candidate.index > heading.index && candidate.index < end)?.index ?? end;
      fillRange(heading.index, next, domainValues(source, heading.domain));
    });
  };

  // Capa: conserva todos os objetos gráficos e altera apenas os campos variáveis.
  items.filter((item) => item.normalized === normalize("AGRUPAMENTO DE ESCOLAS DE CRISTELO PAREDES")).forEach((item) => custom.set(item.index, (block) => replaceCoverSchool(block, school)));
  items.filter((item) => item.normalized === normalize("RELATÓRIO para pais")).forEach((item) => replacements.set(item.index, "RELATÓRIO"));

  const greeting = audience === "alunos" ? find("Caros alunos") : find("Caros Pais e Encarregados de Educação");
  const strengthIntro = audience === "alunos" ? findIncludes("A equipa de avaliação identificou os seguintes aspetos", greeting) : findIncludes("A equipa de avaliação identificou os seguintes pontos fortes", greeting);
  if (greeting >= 0 && strengthIntro > greeting) fillRange(greeting, strengthIntro, String(content.introducao || "").split(/\n\s*\n/));

  patchDomains(audience === "alunos" ? "O que está a correr bem?" : "Pontos fortes", audience === "alunos" ? "Os avaliadores identificaram também" : "Foram identificadas as seguintes áreas", content.pontosFortes);
  patchDomains(audience === "alunos" ? "O que pode melhorar?" : "Áreas de melhoria", audience === "alunos" ? "O Agrupamento dinamiza diversos projetos" : "O Agrupamento dinamiza uma variedade", content.areasMelhoria);

  const questionnaireIntro = audience === "alunos" ? findIncludes("Através dos questionários respondidos pelos alunos") : findIncludes("Através dos questionários aplicados aos pais");
  if (questionnaireIntro >= 0) custom.set(questionnaireIntro, insertPageBreakBefore);
  if (audience === "alunos") {
    const chartParagraphs = items.filter((item) => /<c:chart\b/.test(item.block));
    if (chartParagraphs[1]) custom.set(chartParagraphs[1].index, insertPageBreakBefore);
  }

  const projectsHeading = find(audience === "alunos" ? "Projetos interessantes" : "Projetos");
  const projectsEnd = audience === "alunos" ? findIncludes("Através dos questionários respondidos pelos alunos", projectsHeading) : findIncludes("O Agrupamento reconhece e valoriza", projectsHeading);
  if (projectsHeading >= 0 && projectsEnd > projectsHeading) fillRange(projectsHeading, projectsEnd, content.projetosInteressantes || []);
  if (audience === "familias") {
    const familyHeading = find("Valorização do papel dos pais na vida escolar");
    const familyEnd = findIncludes("Através dos questionários aplicados aos pais", familyHeading);
    if (familyHeading >= 0 && familyEnd > familyHeading) fillRange(familyHeading, familyEnd, content.papelFamilias || []);
  }

  const ratingIntro = findIncludes("Considerando uma escala de avaliação de cinco níveis");
  if (ratingIntro >= 0 && audience === "alunos") custom.set(ratingIntro, insertPageBreakBefore);
  if (ratingIntro >= 0) {
    for (const rating of content.classificacoes || []) {
      const domainIndex = findAfterAny([rating.dominio, rating.dominio.replace("Gestão", "gestão").replace("Serviço", "serviço")], ratingIntro);
      const valueTarget = items.find((item) => item.index > domainIndex && item.text.trim());
      if (domainIndex >= 0 && valueTarget) replacements.set(valueTarget.index, rating.classificacao);
    }
  }

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
  return xml
    .replace(/(<c:cat>[\s\S]*?<c:strCache>)[\s\S]*?(<\/c:strCache>[\s\S]*?<\/c:cat>)/, `$1${categories}$2`)
    .replace(/(<c:val>[\s\S]*?<c:numCache>)[\s\S]*?(<\/c:numCache>[\s\S]*?<\/c:val>)/, `$1${values}$2`);
}

async function coverCollage(file: File) {
  const source = Buffer.from(await file.arrayBuffer());
  const orange = { r: 247, g: 150, b: 31, alpha: 1 };
  const lightOrange = { r: 250, g: 177, b: 75, alpha: 1 };
  const photo = async (width: number, height: number, position: "north" | "centre" | "south" | "attention" = "attention") => sharp(source).resize(width, height, { fit: "cover", position }).jpeg({ quality: 92 }).toBuffer();
  return sharp({ create: { width: 720, height: 720, channels: 3, background: "white" } }).composite([
    { input: await photo(480, 240, "north"), left: 0, top: 0 },
    { input: await sharp({ create: { width: 240, height: 240, channels: 4, background: lightOrange } }).png().toBuffer(), left: 480, top: 0 },
    { input: await sharp({ create: { width: 240, height: 240, channels: 4, background: orange } }).png().toBuffer(), left: 0, top: 240 },
    { input: await photo(480, 240, "centre"), left: 240, top: 240 },
    { input: await photo(480, 240, "south"), left: 0, top: 480 },
    { input: await sharp({ create: { width: 240, height: 240, channels: 4, background: lightOrange } }).png().toBuffer(), left: 480, top: 480 },
  ]).jpeg({ quality: 92 }).toBuffer();
}

function groupCode(value: string) {
  return value.match(/\bQ\s*([1256])\b/i)?.[1] ? `Q${value.match(/\bQ\s*([1256])\b/i)?.[1]}` : "";
}

export async function buildTemplateReport(args: { audience: Audience; school: string; content: ReportContent; analysis: any; cover?: File | null }) {
  const template = path.join(process.cwd(), "templates", args.audience === "alunos" ? "relatorio-alunos.docx" : "relatorio-familias.docx");
  const zip = await JSZip.loadAsync(await fs.readFile(template));
  const documentPath = "word/document.xml";
  const documentXml = await zip.file(documentPath)!.async("string");
  zip.file(documentPath, patchDocumentXml(documentXml, args.audience, args.school, args.content));
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
    if (chart && Array.isArray(group?.[field])) zip.file(chartPath, patchChartXml(await chart.async("string"), group[field]));
  }

  if (args.cover && /^image\/(?:png|jpeg)$/.test(args.cover.type)) {
    const collage = await coverCollage(args.cover);
    if (args.audience === "alunos") {
      zip.file("word/media/image2.jpeg", collage);
      zip.file("word/media/image3.jpeg", collage);
    } else {
      zip.file("word/media/dynamic-cover.jpeg", collage);
      const relPath = "word/_rels/document.xml.rels";
      const rels = await zip.file(relPath)!.async("string");
      zip.file(relPath, rels.replace(/Target="media\/(?:image2|image20)\.emf"/g, 'Target="media/dynamic-cover.jpeg"'));
      const typesPath = "[Content_Types].xml";
      const types = await zip.file(typesPath)!.async("string");
      if (!/Extension="jpeg"/i.test(types)) zip.file(typesPath, types.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>'));
    }
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 7 } });
}
