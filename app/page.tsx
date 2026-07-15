"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type View = "visao" | "documentos" | "analise" | "estatistica" | "evidencias" | "entrevistas" | "triangulacao" | "relatorio";
type EvidenceStatus = "Confirmada" | "Por triangular" | "Contraditória" | "Ausente";
type Strength = "Forte" | "Moderada" | "Insuficiente";

type Field = {
  id: string;
  section: string;
  domain: string;
  name: string;
  referents: string[];
};

type Evidence = {
  id: number;
  fieldId: string;
  claim: string;
  source: string;
  sourceType: "Documental" | "Quantitativa" | "Testemunhal" | "Normativa";
  location: string;
  status: EvidenceStatus;
  strength: Strength;
  validated: boolean;
};

type CandidateEvidence = Evidence & {
  matchedTerms: string[];
  analysis: string;
};

type Interview = {
  id: number;
  panel: string;
  fieldId: string;
  summary: string;
};

type FileAnalysis = {
  status: "A aguardar" | "A ler" | "Lido" | "OCR necessário" | "Erro";
  extractedChars: number;
  candidates: number;
  detail: string;
};

type TextChunk = { text: string; location: string };

type StatisticalRecord = {
  id: number;
  fieldId: string;
  indicator: string;
  value: string;
  context: string;
  source: string;
  location: string;
};

type StatisticalTreatment = {
  id: string;
  fieldId: string;
  indicator: string;
  unit: "%" | "valor";
  summary: string;
  recordIds: number[];
  sources: string[];
  points: Array<{ label: string; value: number; source: string }>;
  minimum: number | null;
  maximum: number | null;
  average: number | null;
  respondentGroup?: "Alunos" | "Encarregados de educação" | "Docentes" | "Não docentes";
  strengths: string[];
  improvements: string[];
};

type QuestionnaireComment = {
  id: number;
  group: "Alunos" | "Encarregados de educação" | "Docentes" | "Não docentes";
  text: string;
  source: string;
};

const fields: Field[] = [
  { id: "auto-dev", section: "5.1.1", domain: "Autoavaliação", name: "Desenvolvimento", referents: ["Organização e sustentabilidade da autoavaliação", "Planeamento estratégico da autoavaliação"] },
  { id: "auto-impacto", section: "5.1.2", domain: "Autoavaliação", name: "Consistência e impacto", referents: ["Consistência das práticas de autoavaliação", "Impacto das práticas de autoavaliação"] },
  { id: "lider-visao", section: "5.2.1", domain: "Liderança e gestão", name: "Visão e estratégia", referents: ["Visão estratégica orientada para a qualidade das aprendizagens", "Documentos orientadores da escola"] },
  { id: "lider-lideranca", section: "5.2.2", domain: "Liderança e gestão", name: "Liderança", referents: ["Mobilização da comunidade educativa", "Desenvolvimento de projetos, parcerias e soluções que promovam a qualidade das aprendizagens"] },
  { id: "lider-gestao", section: "5.2.3", domain: "Liderança e gestão", name: "Gestão", referents: ["Práticas de gestão e organização das crianças e dos alunos", "Ambiente escolar", "Organização, afetação e formação dos recursos humanos", "Organização e afetação dos recursos materiais", "Comunicação interna e externa"] },
  { id: "serv-bemestar", section: "5.3.1", domain: "Prestação do serviço educativo", name: "Desenvolvimento pessoal e bem-estar das crianças e dos alunos", referents: ["Desenvolvimento pessoal e emocional das crianças e dos alunos", "Apoio ao bem-estar das crianças e alunos"] },
  { id: "serv-oferta", section: "5.3.2", domain: "Prestação do serviço educativo", name: "Oferta educativa e gestão curricular", referents: ["Oferta educativa", "Inovação curricular e pedagógica", "Articulação curricular"] },
  { id: "serv-ensino", section: "5.3.3", domain: "Prestação do serviço educativo", name: "Ensino, aprendizagem e avaliação", referents: ["Estratégias de ensino e aprendizagem orientadas para o sucesso", "Promoção da equidade e inclusão de todas as crianças e de todos os alunos", "Avaliação para e das aprendizagens", "Recursos educativos", "Envolvimento das famílias na vida escolar"] },
  { id: "serv-plan", section: "5.3.4", domain: "Prestação do serviço educativo", name: "Planificação e acompanhamento das práticas educativa e letiva", referents: ["Mecanismos de autorregulação", "Mecanismos de regulação por pares e trabalho colaborativo", "Mecanismos de regulação pelas lideranças"] },
  { id: "res-acad", section: "5.4.1", domain: "Resultados", name: "Resultados académicos", referents: ["Resultados do ensino básico geral", "Resultados do ensino secundário", "Resultados de outras ofertas formativas", "Resultados para a equidade, inclusão e excelência"] },
  { id: "res-sociais", section: "5.4.2", domain: "Resultados", name: "Resultados sociais", referents: ["Participação na vida da escola e assunção de responsabilidades", "Cumprimento das regras e disciplina", "Solidariedade e cidadania", "Impacto da escolaridade no percurso dos alunos"] },
  { id: "res-recon", section: "5.4.3", domain: "Resultados", name: "Reconhecimento da comunidade", referents: ["Grau de satisfação da comunidade educativa", "Valorização dos sucessos dos alunos", "Contributo da escola para o desenvolvimento da comunidade envolvente"] },
];

const domainOrder = ["Autoavaliação", "Liderança e gestão", "Prestação do serviço educativo", "Resultados"];

const initialEvidence: Evidence[] = [
  { id: 1, fieldId: "auto-dev", claim: "A equipa recolhe dados académicos e perceções da comunidade segundo um calendário anual.", source: "Relatório de autoavaliação", sourceType: "Documental", location: "p. 18", status: "Confirmada", strength: "Moderada", validated: true },
  { id: 2, fieldId: "auto-impacto", claim: "As ações de melhoria são acompanhadas, mas parte dos indicadores não dispõe de metas mensuráveis.", source: "Plano de melhoria", sourceType: "Documental", location: "pp. 7–10", status: "Por triangular", strength: "Moderada", validated: false },
  { id: 3, fieldId: "lider-visao", claim: "O projeto educativo apresenta prioridades coerentes, reconhecidas pelas lideranças intermédias.", source: "Projeto educativo", sourceType: "Documental", location: "p. 6", status: "Por triangular", strength: "Moderada", validated: false },
  { id: 4, fieldId: "lider-gestao", claim: "A distribuição de serviço explicita critérios pedagógicos e necessidades dos alunos.", source: "Critérios de distribuição", sourceType: "Normativa", location: "p. 3", status: "Confirmada", strength: "Forte", validated: true },
  { id: 5, fieldId: "serv-oferta", claim: "A articulação curricular vertical é referida nos departamentos, sem evidência uniforme da sua monitorização.", source: "Atas de departamento", sourceType: "Documental", location: "amostra, p. 9", status: "Contraditória", strength: "Insuficiente", validated: false },
  { id: 6, fieldId: "serv-ensino", claim: "Os planos de turma registam medidas de diferenciação pedagógica e de suporte à aprendizagem.", source: "Planos de turma", sourceType: "Documental", location: "amostra", status: "Confirmada", strength: "Moderada", validated: true },
  { id: 7, fieldId: "serv-plan", claim: "Existem momentos de trabalho colaborativo, mas a observação de aulas não é uma prática generalizada.", source: "Atas e plano de formação", sourceType: "Documental", location: "pp. 12 e 21", status: "Por triangular", strength: "Moderada", validated: false },
  { id: 8, fieldId: "res-acad", claim: "A taxa de percursos diretos no 3.º ciclo ficou abaixo do valor de comparação em dois dos três anos.", source: "Dados de resultados", sourceType: "Quantitativa", location: "2021–2024", status: "Confirmada", strength: "Forte", validated: true },
  { id: 9, fieldId: "res-sociais", claim: "Os alunos revelam elevado sentimento de segurança, com diferenças entre espaços escolares.", source: "Questionários", sourceType: "Quantitativa", location: "itens 20–23", status: "Por triangular", strength: "Moderada", validated: false },
  { id: 10, fieldId: "res-recon", claim: "Encarregados de educação valorizam a disponibilidade dos diretores de turma.", source: "Questionários", sourceType: "Quantitativa", location: "item 14", status: "Por triangular", strength: "Moderada", validated: false },
];

const initialInterviews: Interview[] = [
  { id: 1, panel: "Docentes", fieldId: "serv-oferta", summary: "A articulação existe, mas varia entre departamentos e não é monitorizada de forma uniforme." },
  { id: 2, panel: "Alunos", fieldId: "res-sociais", summary: "Os alunos sentem-se seguros, embora identifiquem comportamentos inadequados em alguns espaços." },
];

const fieldKeywords: Record<string, string[]> = {
  "auto-dev": ["autoavaliação", "equipa de autoavaliação", "auscultação", "planeamento estratégico", "comunidade educativa"],
  "auto-impacto": ["ação de melhoria", "ações de melhoria", "monitorização", "impacto da autoavaliação", "recolha de dados"],
  "lider-visao": ["visão estratégica", "projeto educativo", "documentos orientadores", "perfil dos alunos", "objetivos e metas"],
  "lider-lideranca": ["liderança", "lideranças intermédias", "parceria", "projeto inovador", "mobilização da comunidade"],
  "lider-gestao": ["gestão de recursos", "recursos humanos", "comunicação interna", "distribuição de serviço", "ambiente escolar"],
  "serv-bemestar": ["bem-estar", "desenvolvimento pessoal", "resiliência", "comportamentos de risco", "orientação escolar"],
  "serv-oferta": ["oferta educativa", "gestão curricular", "articulação curricular", "inovação curricular", "educação para a cidadania"],
  "serv-ensino": ["ensino e aprendizagem", "avaliação formativa", "diferenciação pedagógica", "medidas de suporte", "envolvimento das famílias"],
  "serv-plan": ["trabalho colaborativo", "regulação por pares", "observação de aulas", "prática letiva", "planificação"],
  "res-acad": ["resultados académicos", "taxa de conclusão", "taxa de transição", "percursos diretos", "retenção", "sucesso escolar"],
  "res-sociais": ["resultados sociais", "disciplina", "participação dos alunos", "cidadania", "assiduidade", "medidas disciplinares"],
  "res-recon": ["satisfação da comunidade", "reconhecimento da comunidade", "valorização dos sucessos", "comunidade envolvente", "encarregados de educação"],
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function candidateEvidence(fileName: string, chunks: TextChunk[]): CandidateEvidence[] {
  const found: CandidateEvidence[] = [];
  const perField = new Map<string, number>();
  for (const chunk of chunks) {
    const sentences = chunk.text.split(/(?<=[.!?])\s+|\n+/).map((item) => item.replace(/\s+/g, " ").trim()).filter((item) => item.length >= 45 && item.length <= 650);
    for (const sentence of sentences) {
      const normalized = normalizeText(sentence);
      let bestField = "";
      let bestScore = 0;
      let bestTerms: string[] = [];
      Object.entries(fieldKeywords).forEach(([fieldId, keywords]) => {
        const terms = keywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
        const score = terms.length;
        if (score > bestScore) { bestScore = score; bestField = fieldId; bestTerms = terms; }
      });
      if (!bestField || bestScore === 0 || (perField.get(bestField) ?? 0) >= 2) continue;
      perField.set(bestField, (perField.get(bestField) ?? 0) + 1);
      found.push({
        id: Date.now() + found.length,
        fieldId: bestField,
        claim: sentence,
        source: fileName,
        sourceType: "Documental",
        location: chunk.location,
        status: "Por triangular",
        strength: "Insuficiente",
        validated: false,
        matchedTerms: bestTerms,
        analysis: "",
      });
      if (found.length >= 18) return found;
    }
  }
  return found;
}

function inferStatisticalField(text: string) {
  const normalized = normalizeText(text);
  let bestField = "res-acad";
  let bestScore = 0;
  Object.entries(fieldKeywords).forEach(([fieldId, keywords]) => {
    const score = keywords.filter((keyword) => normalized.includes(normalizeText(keyword))).length;
    if (score > bestScore) { bestField = fieldId; bestScore = score; }
  });
  return bestField;
}

function questionnaireAudience(text: string, source: string) {
  const normalized = normalizeText(`${text} ${source}`);
  if (/\bq[ _-]?4\b/.test(normalized)) return "Não docentes";
  if (/\bq[ _-]?[56]\b/.test(normalized)) return "Encarregados de educação";
  if (/\bq[ _-]?3\b/.test(normalized)) return "Docentes";
  if (/\bq[ _-]?[12]\b/.test(normalized)) return "Alunos";
  if (/encarregados de educacao|pais e encarregados|questionario aos pais/.test(normalized)) return "Encarregados de educação";
  if (/nao docentes|pessoal nao docente|assistentes operacionais|assistentes tecnicos/.test(normalized)) return "Não docentes";
  if (/docentes|professores/.test(normalized)) return "Docentes";
  return "Alunos";
}

function extractQuestionnaireRates(source: string, chunk: TextChunk, startId: number) {
  const records: StatisticalRecord[] = [];
  const audience = questionnaireAudience(`${chunk.text.slice(0, 300)} ${source}`, source);
  const rowPattern = /\b(\d{2})[.]?\s+(.{10,520}?)\s+((?:\d+\s+\d{1,3}(?:[.,]\d+)?\s+){5}\d+\s+\d{1,3}(?:[.,]\d+)?)(?=\s+\d{2}[.]?\s+|$)/g;
  const matches = [...chunk.text.matchAll(rowPattern)];
  matches.forEach((match, itemIndex) => {
    const questionText = match[2].replace(/\s+/g, " ").trim();
    const pairs = [...match[3].matchAll(/(\d+)\s+(\d{1,3}(?:[.,]\d+)?)/g)];
    const percentages = pairs.slice(0, 6).map((item) => Number.parseFloat(item[2].replace(",", ".")));
    if (percentages.length !== 6 || percentages.some((value) => !Number.isFinite(value) || value > 100)) return;
    const agreement = percentages[0] + percentages[1];
    const disagreement = percentages[2] + percentages[3];
    const residual = percentages[4] + percentages[5];
    const itemLabel = `${chunk.location} · item ${match[1] || itemIndex + 1}`;
    const questionKey = questionText || itemLabel;
    const baseId = startId + records.length;
    records.push(
      { id: baseId, fieldId: "res-recon", indicator: `Concordo — ${audience}`, value: `${agreement.toFixed(1).replace(".", ",")}%`, context: `question=${questionKey}; category=Concordo; ${itemLabel}`, source, location: itemLabel },
      { id: baseId + 1, fieldId: "res-recon", indicator: `Não concordo — ${audience}`, value: `${disagreement.toFixed(1).replace(".", ",")}%`, context: `question=${questionKey}; category=Não concordo; ${itemLabel}`, source, location: itemLabel },
      { id: baseId + 2, fieldId: "res-recon", indicator: `Não sei — ${audience}`, value: `${residual.toFixed(1).replace(".", ",")}%`, context: `question=${questionKey}; category=Não sei; ${itemLabel}`, source, location: itemLabel },
    );
  });
  return records;
}

function extractStatisticalRecords(source: string, chunks: TextChunk[]) {
  const records: StatisticalRecord[] = [];
  chunks.forEach((chunk) => {
    const questionnaireRates = extractQuestionnaireRates(source, chunk, Date.now() * 1000 + records.length);
    if (questionnaireRates.length) {
      records.push(...questionnaireRates);
      return;
    }
    const rawLines = chunk.text.split(/\n+|(?<=[.!?])\s+/).map((line) => line.replace(/[•●▪◦*]+/g, " ").replace(/\s+/g, " ").trim());
    const lines = rawLines.flatMap((line) => {
      if (line.length <= 520) return [line];
      const windows: string[] = [];
      for (const match of line.matchAll(/\b\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?\b/g)) {
        const index = match.index ?? 0;
        windows.push(line.slice(Math.max(0, index - 120), Math.min(line.length, index + 260)).trim());
        if (windows.length >= 20) break;
      }
      return windows;
    });
    lines.forEach((line) => {
      if (line.length < 12 || line.length > 520) return;
      const valueMatch = line.match(/\b\d+(?:[.,]\d+)?\s*%|\b\d+(?:[.,]\d+)?\b/);
      if (!valueMatch) return;
      const statisticalLanguage = /%|taxa|média|media|valor|número|numero|índice|indice|percentagem|alunos?|resultados?|participação|participacao|transição|transicao|conclusão|conclusao|retenção|retencao/i.test(line);
      if (!statisticalLanguage || (/^(?:19|20)\d{2}$/.test(valueMatch[0]) && !/%/.test(line))) return;
      const value = valueMatch[0].trim();
      const indicator = line.replace(valueMatch[0], " ").replace(/^[\s:;,.–—-]+|[\s:;,.–—-]+$/g, "").slice(0, 220) || "Indicador estatístico";
      records.push({ id: Date.now() * 1000 + records.length, fieldId: inferStatisticalField(line), indicator, value, context: line, source, location: chunk.location });
    });
  });
  return records.slice(0, 60);
}

function parseStatisticalValue(value: string) {
  const parsed = Number.parseFloat(value.replace("%", "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function treatmentIndicatorKey(record: StatisticalRecord) {
  return normalizeText(record.indicator)
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140) || "indicador";
}

function treatmentPointLabel(record: StatisticalRecord, index: number) {
  const period = record.context.match(/\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b/);
  return period?.[0] ?? `${record.source.slice(0, 18)} ${index + 1}`;
}

function buildStatisticalTreatments(records: StatisticalRecord[]) {
  const grouped = new Map<string, StatisticalRecord[]>();
  records.forEach((record) => {
    const unit = record.value.includes("%") ? "%" : "valor";
    const respondentGroup = record.indicator.match(/—\s*(Alunos|Encarregados de educação|Docentes|Não docentes)$/i)?.[1];
    const key = respondentGroup ? `questionnaire|${respondentGroup}` : `${record.fieldId}|${unit}|${treatmentIndicatorKey(record)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  });
  return [...grouped.entries()].map(([id, items]): StatisticalTreatment => {
    const respondentGroup = id.startsWith("questionnaire|") ? id.split("|")[1] as StatisticalTreatment["respondentGroup"] : undefined;
    if (respondentGroup) {
      const categories = ["Concordo", "Não concordo", "Não sei"];
      const uniqueQuestions = new Set<string>();
      const points = categories.map((category) => {
        const seen = new Set<string>();
        const values = items.filter((item) => item.indicator.startsWith(`${category} —`)).filter((item) => {
          const question = item.context.match(/question=([^;]+)/)?.[1] ?? item.location;
          const key = normalizeText(question);
          if (seen.has(key)) return false;
          seen.add(key);
          uniqueQuestions.add(key);
          return true;
        }).map((item) => parseStatisticalValue(item.value)).filter((value): value is number => value !== null);
        return { label: category, value: values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0, source: `${values.length} questões únicas` };
      });
      const agreement = points[0].value;
      const disagreement = points[1].value;
      const unknown = points[2].value;
      const seenAgreement = new Set<string>();
      const leastFavourable = items.filter((item) => item.indicator.startsWith("Concordo —")).filter((item) => {
        const question = normalizeText(item.context.match(/question=([^;]+)/)?.[1] ?? item.location);
        if (seenAgreement.has(question)) return false;
        seenAgreement.add(question);
        return true;
      }).map((item) => ({ question: item.context.match(/question=([^;]+)/)?.[1]?.trim() ?? item.location, value: parseStatisticalValue(item.value) ?? 0, source: item.source })).sort((a, b) => a.value - b.value).slice(0, 3);
      const strengths = agreement >= 75 ? [`Predomínio de respostas de concordância (${agreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%).`] : [];
      const improvements = [
        ...(agreement < 60 ? [`Concordância global inferior a 60% (${agreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%).`] : []),
        ...(disagreement >= 15 ? [`Não concordância igual ou superior a 15% (${disagreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%).`] : []),
        ...(unknown >= 10 ? [`Respostas “Não sei/sem resposta” iguais ou superiores a 10% (${unknown.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%).`] : []),
        ...leastFavourable.map((item) => `Aspeto relativamente menos favorável: «${item.question}» (${item.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de concordância; ${item.source}).`),
      ];
      const strengthText = strengths.length ? strengths.join(" ") : "Não emerge uma taxa de concordância suficientemente elevada para assinalar um ponto forte global.";
      const improvementText = improvements.length ? improvements.join(" ") : "Não foi possível identificar itens comparáveis para aprofundamento.";
      return {
        id,
        fieldId: "res-recon",
        indicator: `Tendência global — ${respondentGroup}`,
        unit: "%",
        respondentGroup,
        summary: `A análise agregada das respostas de ${respondentGroup.toLocaleLowerCase("pt-PT")}, após deduplicação de ${uniqueQuestions.size} questão(ões), evidencia ${agreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de concordância, ${disagreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de não concordância e ${unknown.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de respostas “Não sei/sem resposta”. ${strengthText} ${improvementText} Estes resultados traduzem tendências globais de perceção e não permitem, isoladamente, demonstrar impacto.`,
        recordIds: items.map((item) => item.id),
        sources: [...new Set(items.map((item) => item.source))],
        points,
        minimum: null,
        maximum: null,
        average: null,
        strengths,
        improvements,
      };
    }
    const fieldId = items[0].fieldId;
    const unit = items[0].value.includes("%") ? "%" : "valor";
    const points = items.map((item, index) => ({ label: treatmentPointLabel(item, index), value: parseStatisticalValue(item.value), source: item.source })).filter((point): point is { label: string; value: number; source: string } => point.value !== null).sort((a, b) => a.label.localeCompare(b.label, "pt-PT", { numeric: true }));
    const values = points.map((point) => point.value);
    const minimum = values.length ? Math.min(...values) : null;
    const maximum = values.length ? Math.max(...values) : null;
    const average = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const field = getField(fieldId);
    const indicator = items[0].indicator;
    const suffix = unit === "%" ? "%" : "";
    const questionnaireSeries = /taxa (?:global|residual)/i.test(indicator);
    const evolution = questionnaireSeries
      ? `Nas ${points.length} questões tratadas, a taxa média é de ${average?.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix}.`
      : points.length > 1
      ? `A série evolui de ${points[0].value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix} para ${points.at(-1)?.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix}, correspondendo a uma variação de ${((points.at(-1)?.value ?? points[0].value) - points[0].value).toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${unit === "%" ? " pontos percentuais" : " unidades"}.`
      : `O valor observado é ${points[0]?.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "não apurado"}${suffix}.`;
    const quantitativeReading = values.length
      ? `${evolution} Os valores situam-se entre ${minimum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix} e ${maximum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix}, com média simples de ${average?.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${suffix}.`
      : "Não foi possível converter os valores da série para formato numérico.";
    return {
      id,
      fieldId,
      indicator,
      unit,
      summary: `No campo ${field.name.toLocaleLowerCase("pt-PT")}, o indicador «${indicator}» é analisado em ${points.length} observação(ões) comparável(eis). ${quantitativeReading} A leitura é descritiva e deve atender ao universo, ao período e à definição do indicador, não permitindo, por si só, estabelecer relações causais.`,
      recordIds: items.map((item) => item.id),
      sources: [...new Set(items.map((item) => item.source))],
      points,
      minimum,
      maximum,
      average,
      strengths: [],
      improvements: [],
    };
  });
}

function questionnaireSourceRows(records: StatisticalRecord[]) {
  const groups = new Map<string, StatisticalRecord[]>();
  records.filter((record) => record.indicator.startsWith("Concordo —")).forEach((record) => {
    const audience = record.indicator.split("—").at(-1)?.trim() ?? "Comunidade educativa";
    const key = `${record.source}|${audience}`;
    groups.set(key, [...(groups.get(key) ?? []), record]);
  });
  return [...groups.entries()].map(([key, items]) => {
    const [source, audience] = key.split("|");
    const seen = new Set<string>();
    const values = items.filter((item) => {
      const question = normalizeText(item.context.match(/question=([^;]+)/)?.[1] ?? item.location);
      if (seen.has(question)) return false;
      seen.add(question);
      return true;
    }).map((item) => parseStatisticalValue(item.value)).filter((value): value is number => value !== null);
    return { source, audience, questions: values.length, agreement: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 };
  }).sort((a, b) => a.source.localeCompare(b.source, "pt-PT", { numeric: true }));
}

const commentThemes = [
  { name: "Ensino, apoio e relação pedagógica", words: ["professor", "ensino", "aprendiz", "apoio", "aula", "educador"] },
  { name: "Ambiente, inclusão, disciplina e segurança", words: ["ambiente", "inclus", "bullying", "racismo", "disciplina", "seguran", "civismo", "respeito"] },
  { name: "Infraestruturas e bem-estar", words: ["obra", "espaço", "recreio", "ruído", "instala", "equipamento", "bem-estar"] },
  { name: "Gestão, comunicação e valorização profissional", words: ["gestão", "comunica", "opinião", "valoriza", "burocra", "meta", "teip", "lider"] },
];

function themeForComment(text: string) {
  const normalized = normalizeText(text);
  return commentThemes.find((theme) => theme.words.some((word) => normalized.includes(normalizeText(word))))?.name ?? "Outras perceções registadas";
}

function buildQuestionnaireReport(schoolName: string, records: StatisticalRecord[], treatments: StatisticalTreatment[], comments: QuestionnaireComment[]) {
  const questionnaireTreatments = treatments.filter((item) => item.respondentGroup);
  const rows = questionnaireSourceRows(records);
  if (!questionnaireTreatments.length) return "Trate primeiro os dados dos questionários para produzir o relatório analítico.";
  const overall = questionnaireTreatments.reduce((sum, item) => sum + (item.points.find((point) => point.label === "Concordo")?.value ?? 0), 0) / questionnaireTreatments.length;
  const quantitative = questionnaireTreatments.map((item) => {
    const agreement = item.points.find((point) => point.label === "Concordo")?.value ?? 0;
    const disagreement = item.points.find((point) => point.label === "Não concordo")?.value ?? 0;
    const unknown = item.points.find((point) => point.label === "Não sei")?.value ?? 0;
    return `Entre ${item.respondentGroup?.toLocaleLowerCase("pt-PT")}, observa-se ${agreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de concordância, ${disagreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de não concordância e ${unknown.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% de respostas «Não sei/sem resposta».`;
  }).join(" ");
  const thematic = new Map<string, QuestionnaireComment[]>();
  comments.forEach((comment) => { const theme = themeForComment(comment.text); thematic.set(theme, [...(thematic.get(theme) ?? []), comment]); });
  const thematicText = [...thematic.entries()].map(([theme, items]) => `${theme}. Os relatos de ${[...new Set(items.map((item) => item.group.toLocaleLowerCase("pt-PT")))].join(" e ")} assinalam ${items.map((item) => item.text.replace(/^[-•\s]+/, "").replace(/[.!?]+$/, "")).join("; ")}. Esta leitura qualitativa contextualiza as tendências estatísticas, sem permitir generalização para além dos testemunhos recolhidos.`).join("\n\n");
  const strengths = questionnaireTreatments.flatMap((item) => item.strengths.map((strength) => `${item.respondentGroup}: ${strength}`));
  const improvements = questionnaireTreatments.flatMap((item) => item.improvements.map((improvement) => `${item.respondentGroup}: ${improvement}`));
  return [
    "RELATÓRIO ANALÍTICO DOS QUESTIONÁRIOS",
    schoolName,
    "",
    "1. Enquadramento e metodologia do diagnóstico",
    `O presente relatório sistematiza a análise dos questionários aplicados à comunidade educativa de ${schoolName}. A leitura combina o tratamento quantitativo das respostas fechadas com a análise temática dos relatos escritos introduzidos na plataforma. As taxas de concordância resultam da agregação de «Concordo totalmente» e «Concordo»; a não concordância agrega «Discordo» e «Discordo totalmente»; «Não sei» inclui também as não respostas. As questões repetidas são deduplicadas antes do cálculo das médias simples.`,
    "",
    "2. Análise quantitativa global por público-alvo",
    `A concordância média entre os públicos analisados situa-se em ${overall.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%. ${quantitative}`,
    "",
    "Fonte | Público-alvo | Questões válidas | Taxa global de concordância",
    ...rows.map((row) => `${row.source} | ${row.audience} | ${row.questions} | ${row.agreement.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%`),
    "",
    "3. Leitura qualitativa e articulação com os resultados",
    thematicText || "Não foram ainda introduzidos relatos escritos. A interpretação disponível restringe-se, por isso, às tendências quantitativas globais.",
    "",
    "4. Pontos fortes sinalizados",
    strengths.length ? strengths.map((item) => `• ${item}`).join("\n") : "Não emerge um ponto forte global segundo o limiar de concordância definido.",
    "",
    "5. Áreas de melhoria sinalizadas",
    improvements.length ? improvements.map((item) => `• ${item}`).join("\n") : "Não emerge uma área de melhoria global segundo os limiares definidos.",
    "",
    "6. Síntese conclusiva",
    `Os resultados caracterizam perceções da comunidade e devem ser triangulados com evidência documental, observação e entrevistas. A convergência entre taxas globais e relatos escritos reforça a consistência interpretativa; divergências entre públicos constituem matéria de aprofundamento, não uma conclusão causal.`,
  ].join("\n");
}

function TreatmentChart({ treatment }: { treatment: StatisticalTreatment }) {
  const width = 720;
  const height = 260;
  const left = 54;
  const bottom = 44;
  const chartHeight = height - bottom - 18;
  const maximum = Math.max(...treatment.points.map((point) => point.value), 1);
  const slot = (width - left - 20) / Math.max(treatment.points.length, 1);
  const barWidth = Math.min(64, slot * 0.62);
  return <svg className="treatment-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfico do indicador ${treatment.indicator}`}>
    <line x1={left} x2={width - 12} y1={height - bottom} y2={height - bottom} className="chart-axis" />
    {treatment.points.map((point, index) => {
      const barHeight = Math.max(2, (point.value / maximum) * chartHeight);
      const x = left + index * slot + (slot - barWidth) / 2;
      const y = height - bottom - barHeight;
      return <g key={`${point.label}-${index}`}><rect x={x} y={y} width={barWidth} height={barHeight} rx="4" className="chart-bar" /><text x={x + barWidth / 2} y={Math.max(12, y - 6)} textAnchor="middle" className="chart-value">{point.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}{treatment.unit === "%" ? "%" : ""}</text><text x={x + barWidth / 2} y={height - 20} textAnchor="middle" className="chart-label">{point.label.slice(0, 18)}</text></g>;
    })}
  </svg>;
}

function QuestionnaireOverviewChart({ treatments }: { treatments: StatisticalTreatment[] }) {
  const width = 820;
  const height = 330;
  const left = 55;
  const bottom = 62;
  const chartHeight = height - bottom - 34;
  const groupSlot = (width - left - 20) / Math.max(treatments.length, 1);
  const colors = ["#5f8b70", "#b66d58", "#b8a563"];
  return <div className="overview-chart-wrap"><div className="chart-legend"><span><i style={{ background: colors[0] }} />Concordo</span><span><i style={{ background: colors[1] }} />Não concordo</span><span><i style={{ background: colors[2] }} />Não sei</span></div><svg className="treatment-chart overview-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico geral das respostas por grupo">
    <line x1={left} x2={width - 12} y1={height - bottom} y2={height - bottom} className="chart-axis" />
    {treatments.map((treatment, groupIndex) => {
      const barWidth = Math.min(34, groupSlot / 4.5);
      const startX = left + groupIndex * groupSlot + (groupSlot - barWidth * 3 - 8) / 2;
      return <g key={treatment.id}>{treatment.points.map((point, pointIndex) => {
        const barHeight = (point.value / 100) * chartHeight;
        const x = startX + pointIndex * (barWidth + 4);
        const y = height - bottom - barHeight;
        return <g key={point.label}><rect x={x} y={y} width={barWidth} height={barHeight} rx="3" fill={colors[pointIndex]} /><text x={x + barWidth / 2} y={Math.max(14, y - 5)} textAnchor="middle" className="chart-value">{point.value.toLocaleString("pt-PT", { maximumFractionDigits: 0 })}%</text></g>;
      })}<text x={left + groupIndex * groupSlot + groupSlot / 2} y={height - 28} textAnchor="middle" className="chart-label">{treatment.respondentGroup}</text></g>;
    })}
  </svg></div>;
}

async function extractFile(file: File): Promise<TextChunk[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const chunks: TextChunk[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim();
      if (text) chunks.push({ text, location: `p. ${pageNumber}` });
    }
    return chunks;
  }
  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.trim() ? [{ text: result.value, location: "texto extraído · sem paginação estável" }] : [];
  }
  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return workbook.SheetNames.map((name) => ({ text: XLSX.utils.sheet_to_csv(workbook.Sheets[name]), location: `folha “${name}”` })).filter((chunk) => chunk.text.trim());
  }
  if (extension === "csv" || extension === "txt") {
    const text = await file.text();
    return text.trim() ? [{ text, location: "ficheiro de texto" }] : [];
  }
  throw new Error("Formato não suportado para leitura local");
}

function getField(id: string) {
  return fields.find((field) => field.id === id) ?? fields[0];
}

function strengthFor(records: Evidence[]): Strength {
  const sources = new Set(records.map((record) => record.source));
  const sourceTypes = new Set(records.map((record) => record.sourceType));
  if (records.some((record) => record.status === "Contraditória")) return "Insuficiente";
  if (records.length >= 3 && sources.size >= 2 && sourceTypes.size >= 2) return "Forte";
  if (records.length >= 2 && sources.size >= 2) return "Moderada";
  return "Insuficiente";
}

function reportHeading(domain: string) {
  const index = domainOrder.indexOf(domain);
  return [`5.1 — Autoavaliação`, `5.2 — Liderança e gestão`, `5.3 — Prestação do serviço educativo`, `5.4 — Resultados`][index];
}

function completeSentence(value: string) {
  const sentence = value.trim().replace(/\s+/g, " ");
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function lowerInitial(value: string) {
  return value ? `${value.charAt(0).toLocaleLowerCase("pt-PT")}${value.slice(1)}` : value;
}

function cleanEvidenceClaim(value: string) {
  let text = value
    .replace(/[\u2022●▪◦*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^No campo [^,]+,\s*/i, "")
    .replace(/^\d+\s*[A-Z]?\s*[-–—:]\s*(?:dados|resultados|realização|prestação|liderança|autoavaliação)[^–—:]{0,90}[-–—:]?\s*/i, "")
    .replace(/^(?:dados de realização|evidência documental|constatação)\s*[-–—:]\s*/i, "");

  const structuralLabel = /\b(?:público[- ]alvo|destinatários?|metas? específicas?|objetivos? específicos?|calendarização|recursos necessários|indicadores? de avaliação|responsáveis? pela ação)\b/i;
  const labelIndex = text.search(structuralLabel);
  if (labelIndex === 0) return "";
  if (labelIndex > 0) text = text.slice(0, labelIndex).trim();

  const normalized = normalizeText(text);
  if (/total de questionarios|concordo totalmente.*discordo|n\.?[oº]\s*%.*n\.?[oº]\s*%/.test(normalized)) return "";
  const numericTokens = text.match(/\b\d+(?:[.,]\d+)?%?\b/g)?.length ?? 0;
  const hasAnalyticalVerb = /\b(?:apresenta|regista|situa|evolui|aumenta|diminui|mantém|evidencia|indicia|permite|varia|corresponde)\b/i.test(text);
  if (numericTokens >= 3 && !hasAnalyticalVerb) return "";

  const percentage = text.match(/^(\d+(?:[.,]\d+)?\s*%)\s+(.{12,})$/);
  if (percentage) {
    const indicator = percentage[2].replace(/[.;:,\s]+$/, "");
    return `O indicador «${indicator}» apresenta o valor de ${percentage[1]}.`;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (text.length < 35 || words.length < 6) return "";
  return completeSentence(text.slice(0, 420));
}

function composeImpactNarrative(records: Array<Evidence & { narrativeClaim: string }>) {
  const corpus = normalizeText(records.map((record) => record.narrativeClaim).join(" "));
  const sentences: string[] = [];
  const monitorsPlanning = /monitoriza|monitorizacao|projeto educativo|plano anual de atividades|\bpaa\b|plano de acao|\bteip\b|estruturas e servicos/.test(corpus);
  const usesIndicators = /indicadores? de eficiencia|indicadores? de eficacia|dados recolhidos.*indicadores|monitorizacao e avaliacao/.test(corpus);
  const followsStudents = /monitorizacao continua dos alunos|apoio educativo mais intensivo|integracao plena na sala/.test(corpus);
  const targetsSuccess = /promover o sucesso|prevenir o abandono|absentismo|oferta extracurricular/.test(corpus);
  if (monitorsPlanning) sentences.push("A informação validada evidencia um sistema de acompanhamento que abrange os principais instrumentos de planeamento, as estruturas e os serviços do Agrupamento, procurando articular a execução das ações com a respetiva monitorização.");
  if (usesIndicators) sentences.push("A recolha de dados é enquadrada em indicadores de eficiência e eficácia, o que favorece uma leitura mais sistemática da concretização das medidas e da sua evolução.");
  if (followsStudents) sentences.push("No apoio educativo, o acompanhamento assume caráter contínuo e ajustável, partindo de uma intervenção mais intensiva e evoluindo para uma integração progressiva dos alunos na sala de aula.");
  if (targetsSuccess) sentences.push("Esta orientação mostra-se coerente com os objetivos de promoção do sucesso, prevenção do abandono e do absentismo e diversificação das oportunidades educativas.");
  if (!sentences.length) {
    const ideas = records.slice(0, 3).map((record) => record.narrativeClaim.replace(/[.!?]+$/, ""));
    sentences.push(`A informação disponível aponta para práticas de acompanhamento e avaliação relacionadas com ${ideas.map(lowerInitial).join("; ")}.`);
  }
  sentences.push("Em termos interpretativos, estas práticas revelam uma preocupação com a regulação dos processos e com o ajustamento das respostas às necessidades identificadas. Contudo, a evidência apresentada sustenta sobretudo a existência e a organização dos mecanismos de monitorização; a demonstração do seu impacto exige resultados comparáveis que permitam relacionar as medidas adotadas com as mudanças efetivamente alcançadas.");
  return sentences.join(" ");
}

function composeGenericAnalyticalNarrative(field: Field, records: Array<Evidence & { narrativeClaim: string }>) {
  const ideas = records.slice(0, 3).map((record) => record.narrativeClaim.replace(/[.!?]+$/, ""));
  const distinct = ideas.filter((idea, index) => ideas.findIndex((candidate) => normalizeText(candidate) === normalizeText(idea)) === index);
  if (!distinct.length) return `A evidência validada ainda não permite construir uma caracterização interpretativa segura do campo ${field.name.toLocaleLowerCase("pt-PT")}.`;
  const synthesis = distinct.length === 1
    ? lowerInitial(distinct[0])
    : `${distinct.slice(0, -1).map(lowerInitial).join("; ")}; e ${lowerInitial(distinct.at(-1) ?? "")}`;
  return `No campo ${field.name.toLocaleLowerCase("pt-PT")}, a informação validada permite identificar como elementos centrais ${synthesis}. Consideradas em conjunto, estas evidências caracterizam práticas e opções organizacionais coerentes com os referentes do campo, mas não demonstram, por si só, a amplitude, a regularidade ou o impacto dos processos descritos. A formulação do juízo deve, por isso, atender à representatividade das fontes e aos resultados observáveis associados a estas práticas.`;
}

function composeFieldNarrative(field: Field, records: Evidence[]) {
  if (!records.length) return "Não existe ainda evidência validada suficiente para caracterizar este campo de análise ou formular um juízo avaliativo sustentado.";

  const confirmed = records.filter((record) => record.status === "Confirmada");
  const contradictory = records.filter((record) => record.status === "Contraditória");
  const provisional = records.filter((record) => record.status === "Por triangular");
  const ordered = [...confirmed, ...provisional, ...contradictory]
    .map((record) => ({ ...record, narrativeClaim: cleanEvidenceClaim(record.claim) }))
    .filter((record) => record.narrativeClaim);
  const strength = strengthFor(ordered);
  if (!ordered.length) return `No campo ${field.name.toLocaleLowerCase("pt-PT")}, os registos validados correspondem sobretudo a fragmentos de tabelas ou listas e não permitem, sem reformulação, construir uma caracterização sintaticamente segura.`;

  const paragraphs: string[] = [field.id === "auto-impacto" ? composeImpactNarrative(ordered) : composeGenericAnalyticalNarrative(field, ordered)];

  if (contradictory.length) {
    paragraphs.push("A existência de informação contraditória impede, nesta fase, uma conclusão estável e requer esclarecimento através de fonte independente ou dos painéis de entrevista.");
  } else if (strength === "Forte") paragraphs.push("A diversidade e independência das fontes conferem robustez à interpretação, sem dispensar a validação do respetivo alcance pela equipa de avaliação.");
  else if (strength === "Insuficiente") paragraphs.push("A base probatória disponível é ainda limitada, pelo que esta interpretação deve ser aprofundada através de evidência independente adicional.");

  return paragraphs.join(" ");
}

function buildNarratives(evidence: Evidence[]) {
  return Object.fromEntries(fields.map((field) => [field.id, composeFieldNarrative(field, evidence.filter((record) => record.fieldId === field.id && record.validated))]));
}

function preserveReviewedNarratives(evidence: Evidence[], narratives: Record<string, string>) {
  const completed = buildNarratives(evidence);
  Object.entries(narratives).forEach(([fieldId, narrative]) => {
    const normalized = normalizeText(narrative);
    const containsStructuralFragments = /[•●▪◦*]|publico[- ]alvo|metas? especificas?|objetivos? especificos?|calendarizacao|recursos necessarios|total de questionarios|concordo totalmente.*discordo|n\.?[oº]\s*%.*n\.?[oº]\s*%/.test(normalized);
    const legacyConcatenation = /evidencia validada permite reconhecer que|em convergencia|acresce que|convergencia observada sustenta uma leitura/.test(normalized);
    if (narrative.trim() && !containsStructuralFragments && !legacyConcatenation) completed[fieldId] = narrative.trim();
  });
  return completed;
}

function buildReport(evidence: Evidence[], narratives: Record<string, string> = {}) {
  const lines: string[] = [
    "MINUTA DE TRABALHO — SUJEITA A VALIDAÇÃO HUMANA",
    "",
    "Esta minuta foi organizada segundo o quadro de referência fornecido. Os juízos permanecem provisórios até à validação da equipa de avaliação.",
    "",
  ];

  domainOrder.forEach((domain) => {
    lines.push(reportHeading(domain), "");
    fields.filter((field) => field.domain === domain).forEach((field) => {
      const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
      const narrative = narratives[field.id]?.trim() || composeFieldNarrative(field, records);
      lines.push(`${field.section}. ${field.name}`, "", completeSentence(narrative), "");
    });
  });
  lines.push("NOTA DE CONTROLO", "A redação distingue evidência, inferência e juízo. A validação final, a seleção dos pontos fortes e das áreas de melhoria pertencem à equipa de avaliação.");
  return lines.join("\n");
}

export default function Home() {
  const [view, setView] = useState<View>("visao");
  const [schoolName, setSchoolName] = useState("Agrupamento do Vale");
  const [evidence, setEvidence] = useState<Evidence[]>(initialEvidence);
  const [documentCandidates, setDocumentCandidates] = useState<CandidateEvidence[]>([]);
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [statisticalRecords, setStatisticalRecords] = useState<StatisticalRecord[]>([]);
  const [selectedStatisticalIds, setSelectedStatisticalIds] = useState<number[]>([]);
  const [statisticalTreatments, setStatisticalTreatments] = useState<StatisticalTreatment[]>([]);
  const [selectedTreatmentIds, setSelectedTreatmentIds] = useState<string[]>([]);
  const [statisticalUrl, setStatisticalUrl] = useState("");
  const [statisticalStatus, setStatisticalStatus] = useState("");
  const [questionnaireComments, setQuestionnaireComments] = useState<QuestionnaireComment[]>([]);
  const [commentGroup, setCommentGroup] = useState<QuestionnaireComment["group"]>("Alunos");
  const [commentSource, setCommentSource] = useState("Relato escrito");
  const [commentText, setCommentText] = useState("");
  const [questionnaireReport, setQuestionnaireReport] = useState("");
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [files, setFiles] = useState<string[]>(["Projeto educativo — demonstração.pdf", "Relatório de autoavaliação — demonstração.docx", "Resultados académicos — demonstração.xlsx"]);
  const [fileAnalysis, setFileAnalysis] = useState<Record<string, FileAnalysis>>({});
  const [filterDomain, setFilterDomain] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [interviewPanel, setInterviewPanel] = useState("Docentes");
  const [interviewField, setInterviewField] = useState(fields[0].id);
  const [interviewText, setInterviewText] = useState("");
  const [report, setReport] = useState("");
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [changesPending, setChangesPending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("aee-piloto-v2");
    if (!stored) return;
    const timer = window.setTimeout(() => {
      try {
        const data = JSON.parse(stored);
        if (Array.isArray(data.evidence)) {
          const analysedSources = Object.keys(data.fileAnalysis ?? {});
          const legacyCandidates = data.documentCandidates ? [] : data.evidence.filter((item: Evidence) => analysedSources.includes(item.source) && item.sourceType === "Documental" && !item.validated && item.status === "Por triangular");
          setEvidence(data.evidence.filter((item: Evidence) => !legacyCandidates.some((candidate: Evidence) => candidate.id === item.id)));
          if (Array.isArray(data.documentCandidates)) setDocumentCandidates(data.documentCandidates.map((item: CandidateEvidence) => ({ ...item, matchedTerms: item.matchedTerms ?? [], analysis: item.analysis ?? "" })));
          else if (legacyCandidates.length) setDocumentCandidates(legacyCandidates.map((item: Evidence) => ({ ...item, matchedTerms: [], analysis: "" })));
        }
        if (Array.isArray(data.interviews)) setInterviews(data.interviews);
        if (Array.isArray(data.statisticalRecords)) setStatisticalRecords(data.statisticalRecords);
        if (Array.isArray(data.statisticalTreatments)) setStatisticalTreatments(data.statisticalTreatments.filter((item: StatisticalTreatment) => Array.isArray(item.points) && Array.isArray(item.strengths) && Array.isArray(item.improvements)));
        if (Array.isArray(data.questionnaireComments)) setQuestionnaireComments(data.questionnaireComments);
        if (typeof data.questionnaireReport === "string") setQuestionnaireReport(data.questionnaireReport);
        if (Array.isArray(data.files)) setFiles(data.files);
        if (data.fileAnalysis && typeof data.fileAnalysis === "object") setFileAnalysis(data.fileAnalysis);
        if (typeof data.report === "string") setReport(data.report);
        if (data.narratives && typeof data.narratives === "object") setNarratives(data.narratives);
        if (typeof data.lastUpdated === "string") setLastUpdated(data.lastUpdated);
        if (typeof data.schoolName === "string") setSchoolName(data.schoolName);
      } catch {
        window.localStorage.removeItem("aee-piloto-v2");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visibleEvidence = useMemo(() => evidence.filter((record) => {
    const field = getField(record.fieldId);
    return (filterDomain === "Todos" || field.domain === filterDomain) && (filterStatus === "Todos" || record.status === filterStatus);
  }), [evidence, filterDomain, filterStatus]);

  const coveredFields = new Set(evidence.filter((record) => record.validated).map((record) => record.fieldId)).size;
  const validatedCount = evidence.filter((record) => record.validated).length;
  const pendingCount = evidence.filter((record) => !record.validated).length + documentCandidates.length + statisticalRecords.length;
  const allCandidatesSelected = documentCandidates.length > 0 && documentCandidates.every((candidate) => selectedCandidates.includes(candidate.id));
  const allStatisticalSelected = statisticalRecords.length > 0 && statisticalRecords.every((record) => selectedStatisticalIds.includes(record.id));
  const allTreatmentsSelected = statisticalTreatments.length > 0 && statisticalTreatments.every((treatment) => selectedTreatmentIds.includes(treatment.id));

  function saveLocal() {
    window.localStorage.setItem("aee-piloto-v2", JSON.stringify({ schoolName, evidence, documentCandidates, statisticalRecords, statisticalTreatments, questionnaireComments, questionnaireReport, interviews, files, fileAnalysis, narratives, report, lastUpdated }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function updateAnalysis() {
    setUpdating(true);
    const refreshedNarratives = preserveReviewedNarratives(evidence, narratives);
    const refreshedReport = report ? buildReport(evidence, refreshedNarratives) : report;
    const timestamp = new Intl.DateTimeFormat("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    setReport(refreshedReport);
    setNarratives(refreshedNarratives);
    setLastUpdated(timestamp);
    setChangesPending(false);
    window.localStorage.setItem("aee-piloto-v2", JSON.stringify({ schoolName, evidence, documentCandidates, statisticalRecords, statisticalTreatments, questionnaireComments, questionnaireReport, interviews, files, fileAnalysis, narratives: refreshedNarratives, report: refreshedReport, lastUpdated: timestamp }));
    window.setTimeout(() => setUpdating(false), 650);
  }

  function resetProcess() {
    const emptyProcess = {
      schoolName: "Nova escola",
      evidence: [] as Evidence[],
      documentCandidates: [] as CandidateEvidence[],
      statisticalRecords: [] as StatisticalRecord[],
      statisticalTreatments: [] as StatisticalTreatment[],
      questionnaireComments: [] as QuestionnaireComment[],
      questionnaireReport: "",
      interviews: [] as Interview[],
      files: [] as string[],
      fileAnalysis: {} as Record<string, FileAnalysis>,
      report: "",
      narratives: {} as Record<string, string>,
      lastUpdated: "",
    };
    setSchoolName(emptyProcess.schoolName);
    setEvidence(emptyProcess.evidence);
    setDocumentCandidates(emptyProcess.documentCandidates);
    setSelectedCandidates([]);
    setStatisticalRecords(emptyProcess.statisticalRecords);
    setSelectedStatisticalIds([]);
    setStatisticalTreatments(emptyProcess.statisticalTreatments);
    setSelectedTreatmentIds([]);
    setQuestionnaireComments([]);
    setQuestionnaireReport("");
    setInterviews(emptyProcess.interviews);
    setFiles(emptyProcess.files);
    setFileAnalysis(emptyProcess.fileAnalysis);
    setReport(emptyProcess.report);
    setNarratives(emptyProcess.narratives);
    setLastUpdated(emptyProcess.lastUpdated);
    setChangesPending(false);
    setFilterDomain("Todos");
    setFilterStatus("Todos");
    setView("visao");
    setShowResetConfirm(false);
    window.localStorage.setItem("aee-piloto-v2", JSON.stringify(emptyProcess));
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    const selected = selectedFiles.map((file) => file.name);
    setFiles((current) => [...current, ...selected.filter((name) => !current.includes(name))]);
    if (selected.length) setChangesPending(true);
    event.target.value = "";
    for (const file of selectedFiles) {
      setFileAnalysis((current) => ({ ...current, [file.name]: { status: "A ler", extractedChars: 0, candidates: 0, detail: "Extração local em curso…" } }));
      try {
        const chunks = await extractFile(file);
        const extractedChars = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
        if (extractedChars < 30) {
          setFileAnalysis((current) => ({ ...current, [file.name]: { status: file.name.toLowerCase().endsWith(".pdf") ? "OCR necessário" : "Lido", extractedChars, candidates: 0, detail: file.name.toLowerCase().endsWith(".pdf") ? "O PDF não contém texto pesquisável." : "Não foi encontrado texto utilizável." } }));
          continue;
        }
        const candidates = candidateEvidence(file.name, chunks);
        setDocumentCandidates((current) => [...current.filter((item) => item.source !== file.name), ...candidates]);
        setFileAnalysis((current) => ({ ...current, [file.name]: { status: "Lido", extractedChars, candidates: candidates.length, detail: candidates.length ? `${candidates.length} excertos aguardam análise documental.` : "Texto extraído, mas sem correspondências suficientes com o referencial." } }));
      } catch (error) {
        setFileAnalysis((current) => ({ ...current, [file.name]: { status: "Erro", extractedChars: 0, candidates: 0, detail: error instanceof Error ? error.message : "Não foi possível ler o ficheiro." } }));
      }
    }
  }

  function toggleCandidate(id: number) {
    setSelectedCandidates((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllCandidates() {
    setSelectedCandidates(allCandidatesSelected ? [] : documentCandidates.map((candidate) => candidate.id));
  }

  function updateCandidateField(id: number, fieldId: string) {
    setDocumentCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, fieldId } : candidate));
  }

  function updateCandidateAnalysis(id: number, analysis: string) {
    setDocumentCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, analysis } : candidate));
    setChangesPending(true);
  }

  function discardCandidate(id: number) {
    setDocumentCandidates((current) => current.filter((candidate) => candidate.id !== id));
    setSelectedCandidates((current) => current.filter((item) => item !== id));
  }

  function promoteCandidates() {
    const selected = documentCandidates.filter((candidate) => selectedCandidates.includes(candidate.id));
    if (!selected.length) return;
    const promoted: Evidence[] = selected.map((candidate) => ({
      id: candidate.id,
      fieldId: candidate.fieldId,
      claim: candidate.analysis.trim() || candidate.claim,
      source: candidate.source,
      sourceType: candidate.sourceType,
      location: candidate.location,
      status: "Confirmada",
      strength: "Insuficiente",
      validated: true,
    }));
    setEvidence((current) => [...current.filter((item) => !promoted.some((candidate) => candidate.id === item.id)), ...promoted]);
    setDocumentCandidates((current) => current.filter((candidate) => !selectedCandidates.includes(candidate.id)));
    setSelectedCandidates([]);
    setChangesPending(true);
    setView("evidencias");
  }

  function addStatisticalRecords(source: string, chunks: TextChunk[]) {
    const extracted = extractStatisticalRecords(source, chunks);
    setStatisticalRecords((current) => [...current.filter((record) => record.source !== source), ...extracted]);
    setChangesPending(true);
    return extracted.length;
  }

  async function handleStatisticalFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    setStatisticalStatus(selectedFiles.length ? "A tratar os ficheiros…" : "");
    let total = 0;
    for (const file of selectedFiles) {
      try {
        total += addStatisticalRecords(file.name, await extractFile(file));
      } catch (error) {
        setStatisticalStatus(error instanceof Error ? error.message : "Não foi possível tratar um dos ficheiros.");
      }
    }
    if (selectedFiles.length) setStatisticalStatus(`${total} registos estatísticos identificados em ${selectedFiles.length} ficheiro(s).`);
  }

  async function loadStatisticalUrl() {
    const value = statisticalUrl.trim();
    if (!value) return;
    setStatisticalStatus("A carregar o endereço público…");
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Utilize um endereço público HTTP ou HTTPS.");
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`O endereço devolveu o estado ${response.status}.`);
      const contentType = response.headers.get("content-type") ?? "";
      const fileName = decodeURIComponent(url.pathname.split("/").pop() || "InfoEscolas-online");
      let chunks: TextChunk[];
      if (/pdf|spreadsheet|excel|csv/.test(contentType) || /\.(pdf|xlsx?|csv)$/i.test(fileName)) {
        chunks = await extractFile(new File([await response.blob()], fileName, { type: contentType }));
      } else {
        const html = await response.text();
        const text = contentType.includes("html") ? new DOMParser().parseFromString(html, "text/html").body.textContent ?? "" : html;
        chunks = [{ text, location: url.toString() }];
      }
      const count = addStatisticalRecords(url.hostname, chunks);
      setStatisticalStatus(`${count} registos identificados no endereço indicado.`);
    } catch (error) {
      setStatisticalStatus(`${error instanceof Error ? error.message : "Não foi possível carregar o endereço."} Se o portal bloquear a leitura direta, descarregue o ficheiro e carregue-o nesta página.`);
    }
  }

  function updateStatisticalRecord(id: number, changes: Partial<StatisticalRecord>) {
    setStatisticalRecords((current) => current.map((record) => record.id === id ? { ...record, ...changes } : record));
    setChangesPending(true);
  }

  function toggleStatisticalRecord(id: number) {
    setSelectedStatisticalIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllStatisticalRecords() {
    setSelectedStatisticalIds(allStatisticalSelected ? [] : statisticalRecords.map((record) => record.id));
  }

  function treatStatisticalData() {
    const base = selectedStatisticalIds.length ? statisticalRecords.filter((record) => selectedStatisticalIds.includes(record.id)) : statisticalRecords;
    const treatments = buildStatisticalTreatments(base);
    setStatisticalTreatments(treatments);
    setSelectedTreatmentIds(treatments.map((treatment) => treatment.id));
    setStatisticalStatus(`${treatments.length} síntese(s) de tratamento produzida(s) a partir de ${base.length} registo(s).`);
    setChangesPending(true);
  }

  function updateStatisticalTreatment(id: string, summary: string) {
    setStatisticalTreatments((current) => current.map((treatment) => treatment.id === id ? { ...treatment, summary } : treatment));
    setChangesPending(true);
  }

  function toggleTreatment(id: string) {
    setSelectedTreatmentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllTreatments() {
    setSelectedTreatmentIds(allTreatmentsSelected ? [] : statisticalTreatments.map((treatment) => treatment.id));
  }

  function promoteStatisticalTreatments() {
    const selected = statisticalTreatments.filter((treatment) => selectedTreatmentIds.includes(treatment.id));
    if (!selected.length) return;
    const promoted: Evidence[] = selected.map((treatment, index) => ({
      id: Date.now() + index,
      fieldId: treatment.fieldId,
      claim: treatment.summary,
      source: `Tratamento estatístico — ${getField(treatment.fieldId).name}`,
      sourceType: "Quantitativa",
      location: `${treatment.recordIds.length} registos · ${treatment.sources.join("; ")}`,
      status: "Confirmada",
      strength: "Insuficiente",
      validated: true,
    }));
    setEvidence((current) => [...current.filter((item) => !promoted.some((record) => record.source === item.source)), ...promoted]);
    setChangesPending(true);
    setView("evidencias");
  }

  function addQuestionnaireComment() {
    const text = commentText.trim();
    if (!text) return;
    setQuestionnaireComments((current) => [...current, { id: Date.now(), group: commentGroup, text, source: commentSource.trim() || "Relato escrito" }]);
    setCommentText("");
    setChangesPending(true);
  }

  function generateQuestionnaireAnalysis() {
    const value = buildQuestionnaireReport(schoolName, statisticalRecords, statisticalTreatments, questionnaireComments);
    setQuestionnaireReport(value);
    setStatisticalStatus("Relatório analítico produzido. Reveja e edite a narrativa antes de a exportar ou enviar para as evidências.");
    setChangesPending(true);
  }

  function promoteQuestionnaireAnalysis() {
    const questionnaireTreatments = statisticalTreatments.filter((item) => item.respondentGroup);
    if (!questionnaireTreatments.length) return;
    const groupReadings = questionnaireTreatments.map((item) => item.summary.replace(/ Estes resultados traduzem[\s\S]*$/, "")).join(" ");
    const strengths = questionnaireTreatments.flatMap((item) => item.strengths.map((value) => `${item.respondentGroup}: ${value}`));
    const improvements = questionnaireTreatments.flatMap((item) => item.improvements.map((value) => `${item.respondentGroup}: ${value}`));
    const claim = `${groupReadings} ${strengths.length ? `Como tendências positivas, assinalam-se ${strengths.join(" ")}` : "Não foi sinalizado um ponto forte global pelos limiares definidos."} ${improvements.length ? `Requerem aprofundamento ${improvements.join(" ")}` : "Não foi sinalizada uma área de melhoria global pelos limiares definidos."} A leitura caracteriza perceções agregadas e carece de triangulação com outras fontes.`;
    const promoted: Evidence = { id: Date.now(), fieldId: "res-recon", claim, source: "Síntese analítica dos questionários", sourceType: "Quantitativa", location: `${questionnaireSourceRows(statisticalRecords).length} questionários/fontes`, status: "Confirmada", strength: "Moderada", validated: true };
    setEvidence((current) => [...current.filter((item) => item.source !== promoted.source), promoted]);
    setChangesPending(true);
    setView("evidencias");
  }

  function addInterview() {
    const summary = interviewText.trim();
    if (!summary) return;
    const id = Date.now();
    setInterviews((current) => [...current, { id, panel: interviewPanel, fieldId: interviewField, summary }]);
    setEvidence((current) => [...current, {
      id,
      fieldId: interviewField,
      claim: summary,
      source: `Painel — ${interviewPanel}`,
      sourceType: "Testemunhal",
      location: "registo de entrevista",
      status: "Por triangular",
      strength: "Insuficiente",
      validated: false,
    }]);
    setInterviewText("");
    setChangesPending(true);
  }

  function generateReport() {
    const completedNarratives = preserveReviewedNarratives(evidence, narratives);
    setNarratives(completedNarratives);
    setReport(buildReport(evidence, completedNarratives));
    setView("relatorio");
  }

  function refreshNarratives() {
    setNarratives(buildNarratives(evidence));
    setChangesPending(true);
  }

  function openExportCenter(content: string, filename: string, format: "docx" | "txt", setStatus: (value: string) => void) {
    if (!content.trim()) return;
    try {
      window.localStorage.setItem("aee-export-pending", JSON.stringify({ content, filename, format, createdAt: Date.now() }));
      setStatus("A abrir o Centro de exportação…");
      window.location.assign("/exportar");
    } catch {
      setStatus("Não foi possível preparar a exportação. O navegador poderá estar a bloquear o armazenamento local necessário.");
    }
  }

  function exportStatisticalServer() {
    const treatments = selectedTreatmentIds.length ? statisticalTreatments.filter((item) => selectedTreatmentIds.includes(item.id)) : statisticalTreatments;
    const detail = treatments.map((item) => `${getField(item.fieldId).section}. ${item.indicator}\n${item.points.map((point) => `${point.label}: ${point.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}${item.unit === "%" ? "%" : ""}`).join("\n")}\n${item.summary}\nFontes: ${item.sources.join("; ")}`).join("\n\n");
    const content = [questionnaireReport.trim(), detail].filter(Boolean).join("\n\nANEXO — DETALHE DO TRATAMENTO\n\n");
    openExportCenter(content, "relatorio-tratamento-estatistico-aee", "docx", setStatisticalStatus);
  }

  function downloadReport() {
    if (!report) return;
    openExportCenter(report, "minuta-relatorio-aee", "docx", setExportStatus);
  }

  function downloadReportText() {
    if (!report) return;
    openExportCenter(report, "minuta-relatorio-aee", "txt", setExportStatus);
  }

  const nav: { id: View; label: string; step: string }[] = [
    { id: "visao", label: "Visão geral", step: "00" },
    { id: "documentos", label: "Documentos", step: "01" },
    { id: "analise", label: "Análise documental", step: "02" },
    { id: "estatistica", label: "Análise estatística", step: "03" },
    { id: "evidencias", label: "Evidências", step: "04" },
    { id: "entrevistas", label: "Entrevistas", step: "05" },
    { id: "triangulacao", label: "Triangulação", step: "06" },
    { id: "relatorio", label: "Relatório", step: "07" },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AEE</span>
          <div><strong>Plataforma de análise</strong><small>Demonstração protegida · dados fictícios</small></div>
        </div>
        <nav aria-label="Fluxo de trabalho">
          {nav.map((item) => (
            <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => setView(item.id)}>
              <span>{item.step}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="privacy-card">
          <span className="privacy-dot" />
          <strong>Modo local</strong>
          <p>Os ficheiros são lidos neste navegador. Excertos só entram na matriz depois de análise e promoção explícita.</p>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Processo de demonstração</p>
            <div className="process-title-row">
              <input className="process-name" value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setChangesPending(true); }} aria-label="Nome da escola ou agrupamento" />
              <span>· Avaliação externa</span>
            </div>
          </div>
          <div className="top-actions">
            <span className="badge safe">Privado</span>
            <div className={changesPending ? "update-state pending" : "update-state"}>
              <small>{changesPending ? "Triangulação automática" : "Última atualização"}</small>
              <strong>{changesPending ? "Minuta por atualizar" : lastUpdated || "Ainda não efetuada"}</strong>
            </div>
            <button className="button update-button" onClick={updateAnalysis} aria-live="polite">{updating ? "A atualizar…" : "Atualizar análise"}</button>
            <button className="button secondary" onClick={saveLocal}>{saved ? "Guardado" : "Guardar localmente"}</button>
            <button className="button danger-ghost" onClick={() => setShowResetConfirm(true)}>Novo processo</button>
          </div>
        </header>

        {showResetConfirm && <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-title">
            <p className="eyebrow">Novo processo</p>
            <h2 id="reset-title">Apagar os dados da escola atual?</h2>
            <p>Serão eliminados deste navegador os documentos inventariados, evidências, entrevistas, triangulação e minuta. Esta ação não pode ser anulada.</p>
            <div className="action-row"><button className="button secondary" onClick={() => setShowResetConfirm(false)}>Cancelar</button><button className="button danger" onClick={resetProcess}>Apagar e começar de novo</button></div>
          </section>
        </div>}

        {view === "visao" && <section className="view">
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Quadro de referência carregado</p>
              <h2>Da fonte ao juízo, com rastreabilidade.</h2>
              <p>A plataforma organiza o trabalho pelos quatro domínios e doze campos de análise do referencial fornecido, mantendo separadas evidência, inferência e avaliação.</p>
              <div className="action-row"><button className="button primary" onClick={() => setView(documentCandidates.length ? "analise" : "evidencias")}>{documentCandidates.length ? "Rever análise documental" : "Abrir matriz de evidências"}</button><button className="button ghost" onClick={generateReport}>Gerar minuta</button></div>
            </div>
            <div className="progress-panel">
              <span className="progress-value">{Math.round((coveredFields / fields.length) * 100)}%</span>
              <strong>Cobertura do referencial</strong>
              <div className="progress-track"><span style={{ width: `${(coveredFields / fields.length) * 100}%` }} /></div>
              <small>{coveredFields} de {fields.length} campos com pelo menos uma evidência</small>
            </div>
          </div>

          <div className="metrics">
            <article><span>Fontes</span><strong>{files.length}</strong><small>inventariadas</small></article>
            <article><span>Evidências</span><strong>{evidence.length}</strong><small>{validatedCount} validadas · {documentCandidates.length} candidatas</small></article>
            <article><span>Painéis</span><strong>{new Set(interviews.map((item) => item.panel)).size}</strong><small>{interviews.length} registos</small></article>
            <article className="warning"><span>A rever</span><strong>{pendingCount}</strong><small>juízos ou contradições</small></article>
          </div>

          <div className="section-heading"><div><p className="eyebrow">Estrutura oficial</p><h3>Cobertura por domínio</h3></div><span className="source-note">Referencial AEE · 3.º ciclo</span></div>
          <div className="domain-grid">
            {domainOrder.map((domain, index) => {
              const domainFields = fields.filter((field) => field.domain === domain);
              const covered = domainFields.filter((field) => evidence.some((record) => record.fieldId === field.id && record.validated)).length;
              return <article key={domain} className={`domain-card tone-${index + 1}`}>
                <span className="domain-number">0{index + 1}</span>
                <h4>{domain}</h4>
                <p>{covered}/{domainFields.length} campos cobertos</p>
                <div className="mini-track"><span style={{ width: `${(covered / domainFields.length) * 100}%` }} /></div>
                <ul>{domainFields.map((field) => <li key={field.id}>{field.section} · {field.name}</li>)}</ul>
              </article>;
            })}
          </div>
          <div className="section-heading field-coverage-heading"><div><p className="eyebrow">Leitura detalhada</p><h3>Cobertura por campo de análise</h3><p>Cada barra representa a diversidade de evidência validada disponível: documental, quantitativa, testemunhal e normativa.</p></div><span className="source-note">4 tipos de evidência · máximo 100%</span></div>
          <div className="field-coverage-grid">
            {fields.map((field) => {
              const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
              const sourceTypes = new Set(records.map((record) => record.sourceType));
              const coverage = (sourceTypes.size / 4) * 100;
              return <article className="field-coverage-card" key={field.id}>
                <div className="field-coverage-top"><span>{field.section}</span><strong>{Math.round(coverage)}%</strong></div>
                <h4>{field.name}</h4>
                <small>{field.domain}</small>
                <div className="field-track" aria-label={`${Math.round(coverage)}% de cobertura`}><span style={{ width: `${coverage}%` }} /></div>
                <div className="field-coverage-meta"><span>{records.length} evidência{records.length === 1 ? "" : "s"} validada{records.length === 1 ? "" : "s"}</span><span>{sourceTypes.size}/4 tipos</span></div>
              </article>;
            })}
          </div>
        </section>}

        {view === "documentos" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 1 · Diagnóstico</p><h2>Mapa de fontes</h2><p>Os ficheiros são lidos no navegador e originam excertos candidatos para o agente de análise documental.</p></div><label className="button primary file-button">Ler documentos localmente<input type="file" multiple accept=".pdf,.docx,.xls,.xlsx,.csv,.txt" onChange={handleFiles} /></label></div>
          <section className="limitation-panel" aria-labelledby="limitation-title">
            <div className="limitation-header">
              <div>
                <p className="eyebrow">Limite desta versão</p>
                <h3 id="limitation-title">Como ultrapassar esta limitação?</h3>
                <p>A leitura de PDF com texto, DOCX, Excel e CSV é feita localmente. As correspondências automáticas são apenas excertos candidatos e não entram diretamente nas evidências.</p>
              </div>
              <span className="security-label">Extração local · validar sempre as evidências</span>
            </div>

            <div className="solution-grid">
              <article>
                <span className="solution-step">01</span>
                <h4>Ambiente protegido</h4>
                <p>Instalar a aplicação num computador dedicado ou num servidor institucional privado, com acesso reservado à equipa autorizada.</p>
                <ul><li>Autenticação individual</li><li>Perfis e permissões</li><li>Ligação cifrada</li></ul>
              </article>
              <article>
                <span className="solution-step">02</span>
                <h4>Ficheiros e rastreabilidade</h4>
                <p>Guardar os documentos cifrados e processá-los sem os tornar públicos, mantendo a ligação entre cada evidência e a página de origem.</p>
                <ul><li>Armazenamento cifrado</li><li>OCR e extração de texto</li><li>Página, tabela e versão da fonte</li></ul>
              </article>
              <article>
                <span className="solution-step">03</span>
                <h4>Análise assistida</h4>
                <p>Enviar apenas o conteúdo necessário para um serviço de IA aprovado, com regras de retenção, auditoria e validação humana.</p>
                <ul><li>Matriz automática de evidências</li><li>Triangulação por campo</li><li>Minuta no modelo oficial</li></ul>
              </article>
            </div>

            <div className="recommendation-bar">
              <div><strong>Recomendação para começar</strong><span>Piloto local, para um único utilizador, com documentos de teste ou anonimizados.</span></div>
              <div><strong>Para processos identificáveis</strong><span>Servidor institucional, controlo de acessos, cifragem, auditoria e política de eliminação.</span></div>
            </div>
            <div className="current-behaviour"><strong>O que acontece agora?</strong><span>O texto é extraído e classificado provisoriamente. Na “Análise documental”, pode validar cada excerto através da seleção simples ou selecionar todos; a reformulação permanece disponível como opção de edição.</span></div>
          </section>
          <div className="source-list">
            {files.map((file, index) => { const analysis = fileAnalysis[file]; return <article key={`${file}-${index}`}><span className="file-icon">{file.split(".").pop()?.toUpperCase()}</span><div><strong>{file}</strong><small>{analysis ? analysis.detail : index < 3 ? "Fonte fictícia de demonstração" : "A aguardar leitura"}</small>{analysis && <span className="file-meta">{analysis.extractedChars.toLocaleString("pt-PT")} caracteres · {analysis.candidates} candidatas</span>}</div><span className={`badge file-status ${analysis?.status.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "inventariado"}`}>{analysis?.status ?? "Demonstração"}</span></article>; })}
          </div>
        </section>}

        {view === "analise" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 2 · Análise documental</p><h2>Seleção e validação das evidências</h2><p>Selecione os excertos pertinentes para os validar. A formulação analítica pode ser editada quando pretender precisar a interpretação, mas deixou de ser obrigatória.</p></div><div className="analysis-actions"><span className="badge">{documentCandidates.length} candidatas</span><button className="button secondary" disabled={!documentCandidates.length} onClick={toggleAllCandidates}>{allCandidatesSelected ? "Desmarcar todos" : "Selecionar todos"}</button><button className="button primary" disabled={!selectedCandidates.length} onClick={promoteCandidates}>Validar {selectedCandidates.length || ""} e promover</button></div></div>
          <div className="quality-gate"><strong>Validação simplificada</strong><span>Selecionar confirma a pertinência do excerto. Ao promover, o registo entra na matriz como evidência validada; se existir uma formulação editada, esta substitui o excerto na análise posterior.</span></div>
          {documentCandidates.length === 0 ? <div className="empty-analysis"><strong>Não existem excertos para rever.</strong><p>Leia documentos na etapa anterior ou descarte os resultados que não tenham valor probatório.</p><button className="button secondary" onClick={() => setView("documentos")}>Voltar aos documentos</button></div> : <div className="candidate-list">
            {documentCandidates.map((candidate) => { const field = getField(candidate.fieldId); return <article className={selectedCandidates.includes(candidate.id) ? "candidate-card selected" : "candidate-card"} key={candidate.id}>
              <label className="candidate-check"><input type="checkbox" checked={selectedCandidates.includes(candidate.id)} onChange={() => toggleCandidate(candidate.id)} /><span>Validar</span></label>
              <div className="candidate-main"><div className="original-excerpt"><strong>Excerto identificado</strong><p>{candidate.claim}</p><div className="candidate-source"><span>{candidate.source} · {candidate.location}</span></div></div>{candidate.matchedTerms.length > 0 && <div className="matched-terms">{candidate.matchedTerms.map((term) => <span key={term}>{term}</span>)}</div>}<label className="analysis-editor">Formulação analítica — opcional<textarea value={candidate.analysis} onChange={(event) => updateCandidateAnalysis(candidate.id, event.target.value)} placeholder="Se necessário, reformule ou clarifique a interpretação deste excerto antes de o validar." /><small className={candidate.analysis.trim() ? "analysis-ready" : "analysis-neutral"}>{candidate.analysis.trim() ? "Será usada a formulação editada" : "Será usado o excerto selecionado"}</small></label></div>
              <div className="candidate-classification"><label>Campo proposto<select value={candidate.fieldId} onChange={(event) => updateCandidateField(candidate.id, event.target.value)}>{fields.map((option) => <option value={option.id} key={option.id}>{option.section} · {option.name}</option>)}</select></label><small>{field.domain}</small><button className="text-button danger-text" onClick={() => discardCandidate(candidate.id)}>Descartar</button></div>
            </article>; })}
          </div>}
        </section>}

        {view === "estatistica" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 3 · Análise estatística</p><h2>Tratamento de dados quantitativos</h2><p>Selecione os dados-base, produza o tratamento por campo de análise e reveja a síntese antes de a exportar ou enviar para a matriz.</p></div><div className="analysis-actions"><span className="badge">{statisticalRecords.length} registos</span><button className="button secondary" disabled={!statisticalRecords.length} onClick={toggleAllStatisticalRecords}>{allStatisticalSelected ? "Desmarcar todos" : "Selecionar todos"}</button><button className="button primary" disabled={!statisticalRecords.length} onClick={treatStatisticalData}>Tratar {selectedStatisticalIds.length || "todos os"} dados</button></div></div>
          <div className="statistics-import">
            <div className="statistics-upload"><strong>Ficheiros locais</strong><p>Formatos aceites: XLS, XLSX, CSV, PDF e TXT.</p><label className="button primary file-button">Carregar dados<input type="file" multiple accept=".pdf,.xls,.xlsx,.csv,.txt" onChange={handleStatisticalFiles} /></label></div>
            <div className="statistics-online"><strong>InfoEscolas ou outro endereço público</strong><p>Cole o endereço da página ou do ficheiro disponibilizado publicamente.</p><div><input type="url" value={statisticalUrl} onChange={(event) => setStatisticalUrl(event.target.value)} placeholder="https://infoescolas.medu.pt/…" /><button className="button secondary" onClick={loadStatisticalUrl}>Carregar endereço</button></div><small>A leitura direta depende das permissões do portal. Se for bloqueada, descarregue o ficheiro e carregue-o localmente.</small></div>
          </div>
          {statisticalStatus && <div className="statistics-status" role="status">{statisticalStatus}</div>}
          {statisticalRecords.length === 0 ? <div className="empty-analysis"><strong>Ainda não existem dados estatísticos para rever.</strong><p>Carregue um ficheiro ou indique um endereço público. Os dados só entram nas evidências depois da sua seleção.</p></div> : <div className="statistics-list">
            {statisticalRecords.map((record) => <article className={selectedStatisticalIds.includes(record.id) ? "statistics-card selected" : "statistics-card"} key={record.id}>
              <label className="candidate-check"><input type="checkbox" checked={selectedStatisticalIds.includes(record.id)} onChange={() => toggleStatisticalRecord(record.id)} /><span>Incluir</span></label>
              <div className="statistics-fields"><label>Indicador<input value={record.indicator} onChange={(event) => updateStatisticalRecord(record.id, { indicator: event.target.value })} /></label><label>Valor<input value={record.value} onChange={(event) => updateStatisticalRecord(record.id, { value: event.target.value })} /></label><div className="statistics-context"><strong>Contexto extraído</strong><span>{record.context}</span><small>{record.source} · {record.location}</small></div></div>
              <div className="candidate-classification"><label>Campo de análise<select value={record.fieldId} onChange={(event) => updateStatisticalRecord(record.id, { fieldId: event.target.value })}>{fields.map((field) => <option value={field.id} key={field.id}>{field.section} · {field.name}</option>)}</select></label><button className="text-button danger-text" onClick={() => { setStatisticalRecords((current) => current.filter((item) => item.id !== record.id)); setSelectedStatisticalIds((current) => current.filter((id) => id !== record.id)); }}>Descartar</button></div>
            </article>)}
          </div>}
          {statisticalTreatments.length > 0 && <section className="treatment-panel">
            <div className="section-heading"><div><p className="eyebrow">Resultado intermédio</p><h3>Apresentação do tratamento por indicador</h3><p>Nos questionários, os dados são agregados por grupo e questões repetidas são deduplicadas. Critérios de sinalização: concordância ≥75% para ponto forte; não concordância ≥15%, “Não sei” ≥10% ou concordância &lt;60% para área de melhoria.</p></div><div className="action-row"><button className="button secondary" onClick={toggleAllTreatments}>{allTreatmentsSelected ? "Desmarcar tratamentos" : "Selecionar tratamentos"}</button><button className="button secondary" onClick={exportStatisticalServer}>Guardar Word (.docx)</button><button className="button primary" disabled={!selectedTreatmentIds.length} onClick={promoteStatisticalTreatments}>Enviar análise descritiva ({selectedTreatmentIds.length || ""})</button></div></div>
            {statisticalTreatments.some((treatment) => treatment.respondentGroup) && <QuestionnaireOverviewChart treatments={statisticalTreatments.filter((treatment) => treatment.respondentGroup)} />}
            <div className="treatment-grid">{statisticalTreatments.map((treatment) => { const field = getField(treatment.fieldId); return <article className={selectedTreatmentIds.includes(treatment.id) ? "treatment-card selected" : "treatment-card"} key={treatment.id}>
              <div className="treatment-top"><label className="check"><input type="checkbox" checked={selectedTreatmentIds.includes(treatment.id)} onChange={() => toggleTreatment(treatment.id)} />Usar tratamento</label><span className="badge">{field.section} · {treatment.recordIds.length} registos</span></div>
              <h4>{treatment.indicator}</h4><small className="treatment-field">{field.name}</small>
              <TreatmentChart treatment={treatment} />
              {treatment.respondentGroup ? <div className="treatment-metrics questionnaire-metrics">{treatment.points.map((point) => <span key={point.label}><strong>{point.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%</strong>{point.label}</span>)}</div> : <div className="treatment-metrics"><span><strong>{treatment.points.length}</strong> observações</span><span><strong>{treatment.minimum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> mínimo</span><span><strong>{treatment.maximum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> máximo</span><span><strong>{treatment.average?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> média</span></div>}
              {treatment.respondentGroup && <div className="findings-grid"><div><strong>Pontos fortes</strong>{treatment.strengths.length ? <ul>{treatment.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Sem ponto forte global sinalizado pelo limiar de 75%.</p>}</div><div><strong>Áreas de melhoria</strong>{treatment.improvements.length ? <ul>{treatment.improvements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Sem área global sinalizada pelos limiares definidos.</p>}</div></div>}
              <label>Análise descritiva para eventual utilização como evidência<textarea value={treatment.summary} onChange={(event) => updateStatisticalTreatment(treatment.id, event.target.value)} /></label>
              <small>Fontes de base: {treatment.sources.join("; ")}</small>
            </article>; })}</div>
            {statisticalTreatments.some((treatment) => treatment.respondentGroup) && <section className="questionnaire-report-panel">
              <div className="section-heading"><div><p className="eyebrow">Relatos escritos e interpretação</p><h3>Relatório analítico dos questionários</h3><p>Introduza comentários abertos por público. A classificação temática é automática e editável; só são redigidos temas sustentados pelos relatos inseridos.</p></div></div>
              <div className="comment-entry"><label>Público-alvo<select value={commentGroup} onChange={(event) => setCommentGroup(event.target.value as QuestionnaireComment["group"])}><option>Alunos</option><option>Docentes</option><option>Não docentes</option><option>Encarregados de educação</option></select></label><label>Fonte<input value={commentSource} onChange={(event) => setCommentSource(event.target.value)} placeholder="Q2 · comentários abertos" /></label><label className="comment-text">Relato ou conjunto de relatos<textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Cole aqui o comentário relevante, sem identificação nominal…" /></label><button className="button secondary" onClick={addQuestionnaireComment}>Adicionar relato</button></div>
              {questionnaireComments.length > 0 && <div className="comment-list">{questionnaireComments.map((comment) => <article key={comment.id}><div><span className="badge">{comment.group}</span><small>{themeForComment(comment.text)} · {comment.source}</small></div><p>{comment.text}</p><button className="text-button danger-text" onClick={() => setQuestionnaireComments((current) => current.filter((item) => item.id !== comment.id))}>Remover</button></article>)}</div>}
              <div className="action-row"><button className="button primary" onClick={generateQuestionnaireAnalysis}>Produzir relatório analítico</button><button className="button secondary" disabled={!questionnaireReport} onClick={exportStatisticalServer}>Guardar Word (.docx)</button><button className="button secondary" disabled={!questionnaireReport} onClick={promoteQuestionnaireAnalysis}>Enviar síntese limpa para evidências</button></div>
              {questionnaireReport && <label className="analytic-report-editor">Narrativa analítica — editável<textarea value={questionnaireReport} onChange={(event) => { setQuestionnaireReport(event.target.value); setChangesPending(true); }} /></label>}
            </section>}
          </section>}
        </section>}

        {view === "evidencias" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 4 · Matriz probatória</p><h2>Matriz de evidências</h2><p>Aqui convergem evidências documentais, quantitativas e testemunhais, mantendo a respetiva fonte e localização.</p></div><span className="badge">{visibleEvidence.length} registos · {validatedCount} validados</span></div>
          <div className="filters">
            <label>Domínio<select value={filterDomain} onChange={(event) => setFilterDomain(event.target.value)}><option>Todos</option>{domainOrder.map((domain) => <option key={domain}>{domain}</option>)}</select></label>
            <label>Estado<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option>Todos</option><option>Confirmada</option><option>Por triangular</option><option>Contraditória</option><option>Ausente</option></select></label>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Formulação analítica</th><th>Campo</th><th>Fonte / localização</th><th>Estado</th><th>Validação</th></tr></thead><tbody>
            {visibleEvidence.map((record) => { const field = getField(record.fieldId); return <tr key={record.id}><td><textarea className="evidence-editor" value={record.claim} onChange={(event) => { const claim = event.target.value; setEvidence((current) => current.map((item) => item.id === record.id ? { ...item, claim } : item)); setChangesPending(true); }} aria-label={`Formulação analítica — ${field.name}`} /><small>{record.sourceType} · robustez {record.strength.toLowerCase()} · edite para interpretar, não transcrever</small></td><td><strong>{field.section}</strong><small>{field.domain}<br />{field.name}</small></td><td>{record.source}<small>{record.location}</small></td><td><span className={`status ${record.status.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{record.status}</span></td><td><label className="check"><input type="checkbox" checked={record.validated} onChange={() => { setEvidence((current) => current.map((item) => item.id === record.id ? { ...item, validated: !item.validated } : item)); setChangesPending(true); }} />{record.validated ? "Validada" : "Pendente"}</label></td></tr>; })}
          </tbody></table></div>
        </section>}

        {view === "entrevistas" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 5 · Painéis</p><h2>Relatos das entrevistas</h2><p>Registe sínteses objetivas e associe cada excerto ao campo de análise relevante.</p></div></div>
          <div className="split-layout">
            <div className="form-card">
              <label>Painel<select value={interviewPanel} onChange={(event) => setInterviewPanel(event.target.value)}><option>Direção</option><option>Conselho Geral</option><option>Elementos do Conselho Pedagógico</option><option>Equipa de Autoavaliação</option><option>Diretores de Turma</option><option>Docentes</option><option>Alunos</option><option>Encarregados de educação</option><option>Pessoal não docente</option><option>Parceiros</option></select></label>
              <label>Campo de análise<select value={interviewField} onChange={(event) => setInterviewField(event.target.value)}>{fields.map((field) => <option value={field.id} key={field.id}>{field.section} · {field.name}</option>)}</select></label>
              <label>Síntese do relato<textarea value={interviewText} onChange={(event) => setInterviewText(event.target.value)} placeholder="Registe a ideia essencial, sem identificação nominal…" /></label>
              <button className="button primary" onClick={addInterview}>Adicionar à matriz</button>
            </div>
            <div className="interview-list">
              {interviews.map((item) => { const field = getField(item.fieldId); return <article key={item.id}><div><span className="badge">{item.panel}</span><small>{field.section} · {field.name}</small></div><p>{item.summary}</p></article>; })}
            </div>
          </div>
        </section>}

        {view === "triangulacao" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 6 · Cruzamento de fontes</p><h2>Triangulação e narrativa avaliativa</h2><p>A robustez considera apenas evidências validadas. Cada síntese articula constatação, dados quantitativos, interpretação, limites e proposta de juízo.</p></div><div className="action-row"><span className="badge auto-badge">Só evidência validada</span><button className="button primary" onClick={refreshNarratives}>Atualizar narrativas</button></div></div>
          <div className="narrative-guidance"><strong>Do dado ao juízo</strong><span>As narrativas são propostas de trabalho editáveis. Reveja o alcance, confirme as referências e não transforme previsão, atividade ou testemunho isolado em impacto demonstrado.</span></div>
          <div className="triangulation-grid narrative-grid">
            {fields.map((field) => {
              const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
              const waiting = evidence.filter((record) => record.fieldId === field.id && !record.validated).length;
              const strength = strengthFor(records);
              const types = new Set(records.map((record) => record.sourceType));
              const narrative = narratives[field.id] ?? composeFieldNarrative(field, records);
              return <article key={field.id}>
                <div className="tri-top"><span>{field.section}</span><span className={`strength ${strength.toLowerCase()}`}>{strength}</span></div>
                <h3>{field.name}</h3><small>{field.domain}</small>
                <div className="tri-stats"><span><strong>{records.length}</strong> validadas</span><span><strong>{types.size}</strong> tipos de fonte</span><span><strong>{waiting}</strong> pendentes</span></div>
                <label className="narrative-editor">Síntese avaliativa<textarea value={narrative} onChange={(event) => { setNarratives((current) => ({ ...current, [field.id]: event.target.value })); setChangesPending(true); }} /></label>
                <div className="source-evidence"><strong>Base probatória</strong>{records.length ? <ul>{records.map((record) => <li key={record.id}>{record.source} · {record.location} · {record.status}</li>)}</ul> : <span>Lacuna documental: preparar pedido de evidência e questões para os painéis.</span>}</div>
              </article>;
            })}
          </div>
        </section>}

        {view === "relatorio" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 7 · Redação avaliativa</p><h2>Minuta do relatório</h2><p>Cada campo de análise recebe um texto contínuo construído diretamente a partir da interpretação revista na triangulação.</p></div><div className="action-row"><button className="button primary" onClick={generateReport}>Gerar narrativa</button><button className="button secondary" disabled={!report} onClick={downloadReport}>Guardar Word (.docx)</button><button className="button secondary" disabled={!report} onClick={downloadReportText}>Guardar texto (.txt)</button></div></div>
          {exportStatus && <div className="export-status" role="status">{exportStatus}</div>}
          <div className="report-layout">
            <aside><strong>Controlo de qualidade</strong><ul><li>Estrutura 5.1–5.4 preservada</li><li>Texto contínuo em cada campo</li><li>Interpretação revista na triangulação preservada</li><li>Sem nomes de documentos ou páginas no corpo</li><li>Distinção entre prática, resultado e impacto</li><li>Validação humana obrigatória</li></ul></aside>
            <textarea value={report} onChange={(event) => setReport(event.target.value)} placeholder="Selecione “Gerar minuta” para produzir um texto organizado a partir das evidências atuais." aria-label="Minuta do relatório" />
          </div>
        </section>}
      </section>
    </main>
  );
}
