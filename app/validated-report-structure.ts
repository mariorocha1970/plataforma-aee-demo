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

export function extractVisitScope(report: string) {
  return report.replace(/\s+/g, " ")
    .match(/\b(?:a\s+)?equipa de avaliação(?: externa)? visitou\s+(.+?)(?=,?\s+tendo realizado\b|[!?]|\.(?=\s+(?:[A-ZÀ-Ü]|$)|$)|$)/iu)?.[1]?.trim() || "";
}

export function extractVisitedSchools(report: string, school: string) {
  const named = extractVisitScope(report);
  const entries = named.replace(/^(?:a|o|as|os)\s+/iu, "").split(/(?:,\s*|\s+e\s+)(?:a\s+|o\s+)?(?=(?:EB|Escola|Jardim)\b)/iu).map((value) => value.trim());
  if (entries.every((value) => /^(?:EB|Escola|Jardim de Infância)\s+\p{L}/iu.test(value) && !/(?:^|\s)X+(?=\s|$)|\btod[oa]s?\b/iu.test(value))) return entries;
  if (/^Escola\s/iu.test(school)) {
    const base = school.split(/\s+[–—-]\s+/u)[0];
    if (named.toLocaleLowerCase("pt-PT").includes(base.toLocaleLowerCase("pt-PT"))) return [base];
  }
  return [];
}

export function extractObservedSchools(report: string) {
  const prose = report.replace(/\s+/g, " ");
  const scope = prose.match(/\b(?:realizou(?:-se)?\s+a\s+observação\s+d[ae]\s+prática(?:\s+educativa)?(?:\s+e)?\s+letiva|(?:foram\s+)?observad[ao]s?\s+(?:aulas|atividades|a prática letiva))\s+(?:em|n[oa]s?)\s+(.+?)(?=[.!?](?:\s|$)|$)/iu)?.[1];
  if (!scope) return [];
  const sharedPrefix = scope.match(/^escolas\s+(básicas|secundárias)\s+de\s+/iu)?.[1];
  const expanded = sharedPrefix
    ? scope.replace(/^escolas\s+(?:básicas|secundárias)\s+de\s+/iu, "").split(/,\s*|\s+e\s+(?=de\s+)|\s+e\s+(?!.*\s+e\s+)/iu)
        .map((part) => `Escola ${/^b/iu.test(sharedPrefix) ? "Básica" : "Secundária"} de ${part.replace(/^de\s+/iu, "")}`).join(", ")
    : scope;
  const entries = expanded.split(/(?:,\s*|\s+e\s+)(?:(?:na|no|a|o)\s+)?(?=(?:Escola|Jardim)\b)/iu);
  return entries.map((entry) => entry.trim()).filter((entry) => /^(?:Escola|Jardim de Infância)\s+\p{L}/iu.test(entry) && !/(?:^|\s)X+(?=\s|$)/u.test(entry));
}

type PdfWord = { str: string; transform: number[]; width: number };

// Read the ruled cells geometrically: PDF storage order can differ from the
// visual order when the domain label is centred across multiple bullets.
export function parseValidatedReportPdf(pages: { words: PdfWord[]; rules: number[][] }[]) {
  const tables: string[][][] = [];
  const openRows = new Set<number>();
  const headings = ["", "", "Classificação", "Pontos fortes", "Áreas de melhoria"];
  const readingOrder = (a: PdfWord, b: PdfWord) => Math.abs(a.transform[5] - b.transform[5]) < 1.5 ? a.transform[4] - b.transform[4] : b.transform[5] - a.transform[5];
  const join = (words: PdfWord[]) => words.map((word, i) => {
    const previous = words[i - 1];
    const gap = previous && Math.abs(previous.transform[5] - word.transform[5]) < 1.5 ? word.transform[4] - previous.transform[4] - previous.width : Infinity;
    return (i && gap > 0.65 ? " " : "") + word.str.trim();
  }).join("");
  for (const [pageIndex, { words, rules }] of pages.entries()) {
    const titles = words.filter((word) => /^[2-5][.)]\s*(?:Quadro resumo|Pontos fortes|Áreas de melhoria|Juízos avaliativos)/iu.test(word.str.trim())).sort(readingOrder);
    const nextSection = titles.length ? Number(titles[0].str.trim()[0]) : 0;
    const pending = [4, 3].find((section) => tables[section - 2]?.length > 1 && (tables[section - 2].length < 5 || openRows.has(section)) && (!nextSection || nextSection === section + 1));
    for (let i = pending ? -1 : 0; i < titles.length; i++) {
      const section = i < 0 ? pending! : Number(titles[i].str.trim()[0]);
      if (section === 5) break;
      const top = titles[i]?.transform[5] ?? Infinity;
      const end = titles[i + 1]?.transform[5] ?? 0;
      const pairs = rules.flatMap((left) => rules.filter((right) => Math.abs(right[1] - left[1]) < 0.25 && right[0] >= left[2] && right[0] - left[2] < 3).map((right) => ({ y: left[1], split: right[0], left: left[0], right: right[2] })))
        .filter((rule) => rule.y < top && rule.y > end).sort((a, b) => b.y - a.y);
      const continuation = i < 0;
      const table = continuation ? tables[section - 2].map((row) => [...row]) : [["Domínio", headings[section]]];
      // A table can end the page inside a row, without a closing border.
      const lastRule = pairs.at(-1);
      let openRow = false;
      if (section > 2 && end === 0 && lastRule && pageIndex + 1 < pages.length && pairs.length < 5) {
        const trailing = words.filter((word) => word.str.trim() && word.transform[5] < lastRule.y && word.transform[4] >= lastRule.left && word.transform[4] < lastRule.right).sort(readingOrder);
        const chunk: PdfWord[] = [];
        for (const word of trailing) {
          const previous = chunk.at(-1);
          if (previous && previous.transform[5] - word.transform[5] > 30) break;
          chunk.push(word);
        }
        const left = join(chunk.filter((word) => word.transform[4] < lastRule.split));
        const right = join(chunk.filter((word) => word.transform[4] >= lastRule.split));
        if (canonicalReportDomain(left) && /^[▪•●■‣]/u.test(right)) {
          pairs.push({ ...lastRule, y: Math.min(...chunk.map((word) => word.transform[5])) - 0.01 });
          openRow = true;
        }
      }
      if (pairs.length < 2 || pairs.length > 5 || (section === 2 && pairs.length !== 5) || pairs.some((rule) => Math.abs(rule.split - pairs[0].split) > 2)) continue;
      let valid = true;
      for (let j = 0; j < pairs.length - 1; j++) {
        const band = words.filter((word) => word.str.trim() && word.transform[5] < pairs[j].y && word.transform[5] > pairs[j + 1].y).sort(readingOrder);
        const left = join(band.filter((word) => word.transform[4] < pairs[j].split));
        const domain = canonicalReportDomain(left);
        const right = join(band.filter((word) => word.transform[4] >= pairs[j].split));
        const items = right.split(/[▪•●■‣]/u).map((item) => item.trim().replace(/(\p{L}-)\s+(?=\p{Ll})/gu, "$1")).filter(Boolean);
        if (continuation && j === 0 && !left && right && items.length) {
          const previousRow = table.at(-1)!;
          if (!/^[▪•●■‣]/u.test(right)) {
            if (previousRow.length < 2 || isEmptyImprovement(previousRow.at(-1)!)) { valid = false; break; }
            previousRow[previousRow.length - 1] += " " + items.shift();
          }
          previousRow.push(...items);
          continue;
        }
        if (!domain || table.some(([label]) => label === domain)) { valid = false; break; }
        if (section === 2 && /^(?:Excelente|Muito bom|Bom|Suficiente|Insuficiente)$/iu.test(right)) table.push([domain, right]);
        else if (section === 4 && isEmptyImprovement(right)) table.push([domain, right]);
        else if (section > 2 && /^[▪•●■‣]/u.test(right) && items.length) table.push([domain, ...items]);
        else { valid = false; break; }
      }
      if (valid && (table.length === 5 || (section > 2 && table.length > 1 && table.length < 5))) {
        tables[section - 2] = table;
        if (openRow) openRows.add(section);
        else openRows.delete(section);
      }
    }
  }
  return parseValidatedReportTables(tables.filter((table, index) => table?.length === 5 && !openRows.has(index + 2)));
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
  return values.map((item) => item.replace(/^[\s•·▪‣◦–—-]+/, "").replace(/\s+/g, " ").trim()).filter((item) => item.length > 8 && /\p{L}/u.test(item));
}

function isEmptyImprovement(value: string) {
  const key = normalized(value.replace(/^[\s▪•●■‣]+/u, ""));
  return /^[\s_–—-]*$/u.test(key) || /^(?:nao foram identificadas areas de melhoria(?: especificas)?(?: (?:para este|neste) dominio)?|sem areas de melhoria)\.?$/u.test(key);
}

export function parseValidatedReportTables(tables: string[][][]): ValidatedReportStructure {
  const pontosFortes = Object.fromEntries(SIMPLIFIED_DOMAINS.map((domain) => [domain, [] as string[]]));
  const areasMelhoria = Object.fromEntries(SIMPLIFIED_DOMAINS.map((domain) => [domain, [] as string[]]));
  const ratings = new Map<string, string>();
  const explicitEmptyImprovements = new Set<string>();

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
        const empty = kind === "improvement" && isEmptyImprovement(row.slice(1).join(" "));
        const items = empty ? [] : cleanItems(row.slice(1));
        if (empty) explicitEmptyImprovements.add(domain);
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
    if (!areasMelhoria[domain].length && !explicitEmptyImprovements.has(domain)) warnings.push(`Não foram encontradas áreas de melhoria de ${domain}.`);
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
