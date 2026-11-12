export type QuestionnaireItem = {
  numero: string;
  item: string;
  concordoTotalmente: number;
  concordo: number;
  discordo: number;
  discordoTotalmente: number;
  total: number;
};

export type QuestionnaireGroup = {
  grupo: string;
  maiorConcordancia: QuestionnaireItem[];
  menorConcordancia: QuestionnaireItem[];
  totalQuestionarios?: number;
  itensProcessados: number;
  avisos: string[];
};

function decimal(value: string) {
  return Number.parseFloat(value.replace(",", "."));
}

function questionnaireCode(value: string) {
  return value.match(/\bQ\s*([1256])\b/i)?.[1] ? `Q${value.match(/\bQ\s*([1256])\b/i)?.[1]}` : "";
}

function roundedSum(...values: number[]) {
  return Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10;
}

function parseSection(section: string): QuestionnaireGroup | null {
  const code = questionnaireCode(section);
  if (!code) return null;
  const title = [...section.matchAll(new RegExp(`(${code}\\s*-?[^\\n]+)`, "gi"))].map((match) => match[1].trim()).find((value) => /questionário/i.test(value)) || code;
  const starts = [...section.matchAll(/(?:^|\n)\s*(\d{1,2})\.?\s+/g)];
  const parsed: QuestionnaireItem[] = [];
  const warnings: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const match = starts[index];
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < starts.length ? starts[index + 1].index ?? section.length : (() => {
      const totalIndex = section.indexOf("Total de questionários", start);
      return totalIndex >= 0 ? totalIndex : section.length;
    })();
    const row = section.slice(start, end > start ? end : section.length).trim();
    const tokens = [...row.matchAll(/\b\d+(?:[,.]\d+)?\b/g)];
    if (tokens.length < 12) continue;
    const values = tokens.slice(-12).map((token) => decimal(token[0]));
    const itemEnd = tokens.at(-12)?.index ?? 0;
    const item = row.slice(0, itemEnd).replace(/\s+/g, " ").trim().replace(/[.;]?$/, ".");
    if (!item || values.some((value) => !Number.isFinite(value))) continue;
    const [ctCount, ct, cCount, c, dCount, d, dtCount, dt, nsCount, ns, nrCount, nr] = values;
    const responseCount = ctCount + cCount + dCount + dtCount + nsCount + nrCount;
    const percentageSum = roundedSum(ct, c, d, dt, ns, nr);
    if (percentageSum < 98.5 || percentageSum > 101.5) warnings.push(`${code} item ${match[1]}: as percentagens totalizam ${percentageSum}%.`);
    if (!responseCount) warnings.push(`${code} item ${match[1]}: sem respostas contabilizadas.`);
    parsed.push({ numero: match[1].padStart(2, "0"), item, concordoTotalmente: ct, concordo: c, discordo: d, discordoTotalmente: dt, total: roundedSum(ct, c) });
  }
  if (parsed.length < 5) throw new Error(`${code}: só foi possível reconstituir ${parsed.length} item(ns). Confirme se o PDF contém texto selecionável.`);
  const positive = [...parsed]
    .map((item) => ({ ...item, total: roundedSum(item.concordoTotalmente, item.concordo) }))
    .sort((a, b) => b.total - a.total || Number(a.numero) - Number(b.numero))
    .slice(0, 5);
  const negative = [...parsed]
    .map((item) => ({ ...item, total: roundedSum(item.discordo, item.discordoTotalmente) }))
    .sort((a, b) => b.total - a.total || Number(a.numero) - Number(b.numero))
    .slice(0, 3)
    .sort((a, b) => a.total - b.total || Number(a.numero) - Number(b.numero));
  const totalQuestionarios = Number(section.match(/Total de questionários\s+(\d+)/i)?.[1] || 0) || undefined;
  return { grupo: `${code} - ${title.replace(/^Q\s*[1256]\s*-?\s*/i, "")}`, maiorConcordancia: positive, menorConcordancia: negative, totalQuestionarios, itensProcessados: parsed.length, avisos: [...new Set(warnings)] };
}

export function parseQuestionnaires(text: string) {
  const sections = text.split(/(?=FICHEIRO:\s*)/i).filter((section) => questionnaireCode(section));
  const groups = sections.map(parseSection).filter((group): group is QuestionnaireGroup => Boolean(group));
  const byCode = new Map(groups.map((group) => [questionnaireCode(group.grupo), group]));
  const ordered = ["Q1", "Q2", "Q5", "Q6"].flatMap((code) => byCode.get(code) ? [byCode.get(code)!] : []);
  if (!ordered.length) throw new Error("Não foram reconhecidos questionários Q1, Q2, Q5 ou Q6.");
  return { grupos: ordered };
}
