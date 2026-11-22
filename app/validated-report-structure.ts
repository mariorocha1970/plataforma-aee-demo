export const SIMPLIFIED_DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"] as const;

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
