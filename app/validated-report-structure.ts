export const SIMPLIFIED_DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"] as const;
export const SIMPLIFIED_REPORT_VERSION = "2026.11.23-v37";

export function extractReportSchool(report: string, tableValues: string[] = []) {
  const unit = /^(?:Agrupamento de Escolas|Escola)\s+\p{L}/iu;
  const prose = report.replace(/\s+/g, " ");
  const named = prose.match(/resultados da avaliação externa d[oa]\s+((?:Agrupamento de Escolas|Escola)\s+.+?)(?=,|[.;]|\s+realizad[ao]\b|$)/iu)?.[1];
  const base = named?.trim() || tableValues.find((value) => unit.test(value.trim()))?.trim() || "";
  if (!base) return "";
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const withMunicipality = new RegExp(`^\\s*${escaped}\\s+[–—-]\\s+[\\p{L}][\\p{L} .’'()-]{0,65}$`, "iu");
  return [...tableValues, ...report.split(/\r?\n/)].map((line) => line.trim().replace(/[ \t]+/g, " "))
    .find((line) => withMunicipality.test(line)) || base;
}

export function extractVisitedSchools(report: string, school: string) {
  const prose = report.replace(/\s+/g, " ");
  const named = prose.match(/A equipa de avaliação externa visitou\s+(.+?),\s+tendo realizado/iu)?.[1];
  if (named) return named.replace(/^(?:a|o|as|os)\s+/iu, "").split(/(?:,\s*|\s+e\s+)(?:a\s+|o\s+)?(?=(?:EB|Escola|Jardim)\b)/iu).map((value) => value.trim()).filter(Boolean);
  if (/^Escola\s/iu.test(school)) {
    const visit = prose.match(/A equipa de avaliação externa visitou\s+([^.!?]+)/iu)?.[1];
    const base = school.split(/\s+[–—-]\s+/u)[0];
    if (visit?.toLocaleLowerCase("pt-PT").includes(base.toLocaleLowerCase("pt-PT"))) return [base];
  }
  return [];
}

type PdfWord = { str: string; transform: number[]; width: number };

// Read the ruled cells geometrically: PDF storage order can differ from the
// visual order when the domain label is centred across multiple bullets.
export function parseValidatedReportPdf(pages: { words: PdfWord[]; rules: number[][] }[]) {
  const tables: string[][][] = [];
  const headings = ["", "", "Classificação", "Pontos fortes", "Áreas de melhoria"];
  const readingOrder = (a: PdfWord, b: PdfWord) => Math.abs(a.transform[5] - b.transform[5]) < 1.5 ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5];
  const join = (words: PdfWord[]) => words.map((word, i) => {
    const previous = words[i - 1];
    const gap = previous && Math.abs(previous.transform[5] - word.transform[5]) < 1.5 ? word.transform[4] - previous.transform[4] - previous.width : Infinity;
    return (i && gap > 0.65 ? " " : "") + word.str.trim();
  }).join("");
  for (const { words, rules } of pages) {
    const titles = words.filter((word) => /^[2-5][.)]\s*(?:Quadro resumo|Pontos fortes|Áreas de melhoria|Juízos avaliativos)/iu.test(word.str.trim())).sort(readingOrder);
    for (let i = 0; i < titles.length; i++) {
      const section = Number(titles[i].str.trim()[0]);
      if (section === 5) break;
      const top = titles[i].transform[5];
      const end = titles[i + 1]?.transform[5] ?? 0;
      const pairs = rules.flatMap((left) => rules.filter((right) => Math.abs(right[1] - left[1]) < 0.25 && right[0] >= left[2] && right[0] - left[2] < 3).map((right) => ({ y: left[1], split: right[0] })))
        .filter((rule) => rule.y < top && rule.y > end).sort((a, b) => b.y - a.y);
      if (pairs.length !== 5 || pairs.some((rule) => Math.abs(rule.split - pairs[0].split) > 2)) continue;
      const table = [["Domínio", headings[section]]];
      for (let j = 0; j < 4; j++) {
        const band = words.filter((word) => word.str.trim() && word.transform[5] < pairs[j].y && word.transform[5] > pairs[j + 1].y).sort(readingOrder);
        const domain = canonicalReportDomain(join(band.filter((word) => word.transform[4] < pairs[j].split)));
        const right = join(band.filter((word) => word.transform[4] >= pairs[j].split));
        if (!domain) continue;
        if (section === 2 && /^(?:Excelente|Muito bom|Bom|Suficiente|Insuficiente)$/iu.test(right)) table.push([domain, right]);
        if (section > 2 && /^[▪•●■‣]/u.test(right)) table.push([domain, ...right.split(/[▪•●■‣]/u).map((item) => item.trim().replace(/(\p{L}-)\s+(?=\p{Ll})/gu, "$1")).filter(Boolean)]);
      }
      if (table.length === 5 && new Set(table.slice(1).map(([domain]) => domain)).size === 4) tables[section - 2] = table;
    }
  }
  return parseValidatedReportTables(tables.filter(Boolean));
}

export type ValidatedReportStructure = {
  classificacoes: Array<{ dominio: string; classificacao: string }>;
  pontosFortes: Record<string, string[]>;
  areasMelhoria: Record<string, string[]>;
  complete: boolean;
  warnings: string[];
  metadata?: { school: string; observationDates: string; visitDates: string; schools: string[] };
};

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function canonicalReportDomain(value: string): string | null {
  const key = normalized(value);
  if (key === "autoavaliacao") return "Autoavaliação";
  if (key === "lideranca e gestao") return "Liderança e Gestão";
  if (key === "prestacao do servico educativo") return "Prestação do Serviço Educativo";
  if (key === "resultados") return "Resultados";
  return null;
}

function cleanItems(values: string[]) {
  return values.map((item) => item.replace(/^[\s•·▪‣◦–—-]+/, "").replace(/\s+/g, " ").trim()).filter((item) => item.length > 8);
}

export function parseValidatedReportTables(tables: string[][][]): ValidatedReportStructure {
  const pontosFortes = Object.fromEntries(SIMPLIFIED_DOMAINS.map((domain) => [domain, [] as string[]]));
  const areasMelhoria = Object.fromEntries(SIMPLIFIED_DOMAINS.map((domain) => [domain, [] as string[]]));
  const ratings = new Map<string, string>();

  for (const table of tables) {
    const heading = normalized((table[0] || []).join(" | "));
    const kind = heading.includes("classificacao") ? "rating" : heading.includes("pontos fortes") ? "strength" : heading.includes("areas de melhoria") ? "improvement" : null;
    if (!kind) continue;
    for (const row of table.slice(1)) {
      const domain = canonicalReportDomain(row[0] || "");
      if (!domain) continue;
      if (kind === "rating") {
        const value = (row[1] || "").replace(/\s+/g, " ").trim();
        if (value) {
          const canonicalRatings: Record<string, string> = { excelente: "Excelente", "muito bom": "Muito bom", bom: "Bom", suficiente: "Suficiente", insuficiente: "Insuficiente" };
          ratings.set(domain, canonicalRatings[normalized(value)] || value);
        }
      } else {
        const items = cleanItems(row.slice(1));
        const target = kind === "strength" ? pontosFortes[domain] : areasMelhoria[domain];
        for (const item of items) if (!target.some((existing) => normalized(existing) === normalized(item))) target.push(item);
      }
    }
  }

  const classificacoes = SIMPLIFIED_DOMAINS.map((dominio) => ({ dominio, classificacao: ratings.get(dominio) || "" }));
  const warnings: string[] = [];
  for (const domain of SIMPLIFIED_DOMAINS) {
    if (!ratings.get(domain)) warnings.push(`Falta a classificação de ${domain}.`);
    if (!pontosFortes[domain].length) warnings.push(`Não foram encontrados pontos fortes de ${domain}.`);
    if (!areasMelhoria[domain].length) warnings.push(`Não foram encontradas áreas de melhoria de ${domain}.`);
  }
  return { classificacoes, pontosFortes, areasMelhoria, complete: warnings.length === 0, warnings };
}

export function validateGeneratedReport(content: any, structure: ValidatedReportStructure) {
  const errors: string[] = [];
  for (const domain of SIMPLIFIED_DOMAINS) {
    const expectedStrengths = structure.pontosFortes[domain]?.length || 0;
    const expectedImprovements = structure.areasMelhoria[domain]?.length || 0;
    if (!Array.isArray(content?.pontosFortes?.[domain]) || content.pontosFortes[domain].length !== expectedStrengths) errors.push(`${domain}: esperavam-se ${expectedStrengths} pontos fortes.`);
    if (!Array.isArray(content?.areasMelhoria?.[domain]) || content.areasMelhoria[domain].length !== expectedImprovements) errors.push(`${domain}: esperavam-se ${expectedImprovements} áreas de melhoria.`);
  }
  return errors;
}
