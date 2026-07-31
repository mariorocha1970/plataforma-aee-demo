"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type View = "visao" | "documentos" | "privacidade" | "analise" | "estatistica" | "evidencias" | "entrevistas" | "triangulacao" | "relatorio" | "conclusoes";
type EvidenceStatus = "Confirmada" | "Por triangular" | "Contraditória" | "Ausente";
type Strength = "Forte" | "Moderada" | "Insuficiente";
type TriangulationLevel = "Confirmada" | "Parcial" | "Não realizada" | "Contraditória";
type Rating = "Excelente" | "Muito bom" | "Bom" | "Suficiente" | "Insuficiente" | "Por definir";
type IndicatorApplicability = "Aplicável" | "Por confirmar" | "Não aplicável";
type IndicatorSuggestion = {
  evidenceId: number;
  indicatorId: string;
  justification: string;
  confidence: "Alta" | "Média";
};

type DomainConclusion = {
  domain: string;
  strengths: string[];
  improvements: string[];
  rating: Rating;
  rationale: string;
};

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
  indicatorIds?: string[];
  statisticalTreatmentId?: string;
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

type InterviewCandidate = {
  id: number;
  panel: string;
  fieldId: string;
  synthesis: string;
  location: string;
  nature: "perceção" | "prática relatada" | "resultado referido" | "impacto alegado";
  support: string[];
  reservations: string[];
  questions: string[];
};

type FileAnalysis = {
  status: "A aguardar" | "A ler" | "Privacidade" | "Lido" | "OCR necessário" | "Erro";
  extractedChars: number;
  candidates: number;
  detail: string;
};

type TextChunk = { text: string; location: string };

type PreparedDocument = {
  source: string;
  chunks: TextChunk[];
  status: "Pronto" | "A analisar" | "Concluído" | "Erro";
  message: string;
};

type AnalysisBlock = { text: string; label: string };

type AiFieldAnalysis = {
  campo: string;
  pertinente: boolean;
  sintese: string;
  evidencias: string[];
  pontosFortes: string[];
  areasMelhoria: string[];
  reservas: string[];
  robustez: "sem evidência" | "fraca" | "moderada" | "forte";
};

type PrivacyCategory = "Institucional público" | "Estatístico agregado" | "Interno" | "Contém dados pessoais";
type PrivacyRisk = "Baixo" | "Moderado" | "Elevado";
type PrivacyFinding = {
  id: string;
  kind: "Contacto" | "Identificador" | "Nome possível" | "Informação sensível";
  value: string;
  location: string;
  redacted: boolean;
};
type PrivacyReview = {
  source: string;
  category: PrivacyCategory;
  risk: PrivacyRisk;
  findings: PrivacyFinding[];
  originalChunks: TextChunk[];
  sanitizedChunks: TextChunk[];
};

type StatisticalRecord = {
  id: number;
  fieldId: string;
  indicator: string;
  value: string;
  context: string;
  source: string;
  location: string;
  dataset?: "infoescolas" | "general";
  comparisonKey?: string;
  period?: string;
  seriesRole?: "school" | "national" | "other";
  evidenceUse?: "academic-comparison" | "context-only";
  sourceKey?: string;
  sourceScope?: string;
  sourceScopeCode?: string;
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
  evidenceUse?: "academic-comparison" | "context-only";
  sourceKeys?: string[];
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

const indicatorLabels: Record<string, string[]> = {
  "auto-dev": `Procedimento(s) sistemático(s) de autoavaliação da escola
Articulação da autoavaliação da escola com os restantes processos de avaliação que ocorrem na escola
Auscultação e participação abrangentes da comunidade educativa
Adequação da autoavaliação à realidade da escola
Centralidade do processo de ensino e aprendizagem
Existência de estratégias de comunicação e de reflexão acerca dos resultados da autoavaliação com a comunidade educativa`.split("\n"),
  "auto-impacto": `Abrangência do processo de recolha de dados
Rigor do processo de análise dos dados
Melhoria contínua do processo de autoavaliação
Monitorização e avaliação das ações de melhoria
Evidências da autoavaliação na melhoria organizacional da escola
Evidências da autoavaliação na melhoria do desenvolvimento curricular
Evidências da autoavaliação na melhoria do processo de ensino e de aprendizagem
Evidências da autoavaliação na definição das necessidades de formação contínua e avaliação do seu impacto
Evidências do contributo da autoavaliação para a melhoria da educação inclusiva (implementação das medidas curriculares, afetação de recursos e funcionamento das estruturas de suporte)`.split("\n"),
  "lider-visao": `Definição clara da visão que sustenta a ação da escola com vista à consecução do Perfil dos Alunos à Saída da Escolaridade Obrigatória
Visão partilhada pelos diferentes atores educativos e mobilizadora da sua ação
Clareza e coerência entre os documentos orientadores da ação da escola
Clareza e coerência dos objetivos, metas e estratégias definidos no projeto educativo
Relevância das opções curriculares constantes dos documentos da escola para o desenvolvimento de todas as áreas de competências consideradas no PASEO`.split("\n"),
  "lider-lideranca": `Orientação da ação para o cumprimento das metas e objetivos educacionais
Motivação das pessoas, desenvolvimento profissional e gestão de conflitos
Incentivo à participação na escola dos diferentes atores educativos
Valorização dos diferentes níveis de liderança, nomeadamente as lideranças intermédias
Incentivo ao desenvolvimento de projetos e soluções inovadoras
Avaliação da eficácia dos projetos, parcerias e soluções
Parcerias com outras instituições e agentes da comunidade que mobilizem recursos e promovam, assim, a qualidade das aprendizagens`.split("\n"),
  "lider-gestao": `Existência de critérios pedagógicos na constituição e gestão dos grupos e turmas
Flexibilidade na gestão do trabalho com os grupos e turmas
Existência, consistência e divulgação na comunidade educativa de critérios na aplicação de medidas disciplinares aos alunos
Envolvimento dos alunos na vida da escola
Promoção de um ambiente escolar desafiador da aprendizagem
Promoção de um ambiente escolar seguro, saudável e ecológico
Promoção de um ambiente escolar socialmente acolhedor, inclusivo e cordial
Distribuição e gestão dos recursos humanos de acordo com as necessidades das crianças e alunos
Gestão dos recursos que valorize as pessoas, o seu desenvolvimento profissional e bem-estar
Gestão dos recursos humanos que impulsione a autonomia e a diversidade organizativa
Práticas de formação contínua dos profissionais, por iniciativa da escola, adequadas às necessidades identificadas e às suas prioridades pedagógicas
Opções tomadas com impactos positivos na qualidade das aprendizagens
Opções tomadas tendo em conta as necessidades e expectativas de todas as crianças e alunos
Opções monitorizadas e ajustadas quando necessário
Diversidade e eficácia dos circuitos de comunicação interna e externa
Rigor no reporte de dados às entidades competentes
Adequação da informação ao público-alvo
Acesso à informação da escola pela comunidade educativa
Divulgação da informação respeitando princípios éticos e deontológicos`.split("\n"),
  "serv-bemestar": `Promoção da autonomia e responsabilidade individual
Promoção da participação e envolvimento na comunidade
Promoção de uma atitude de resiliência
Promoção da assiduidade e pontualidade
Atividades de apoio ao bem-estar pessoal e social
Medidas de prevenção e proteção de comportamentos de risco
Reconhecimento e respeito pela diversidade
Medidas de orientação escolar e profissional`.split("\n"),
  "serv-oferta": `Respostas educativas adaptadas às necessidades de formação dos alunos com vista ao desenvolvimento do Perfil dos Alunos à Saída da Escolaridade Obrigatória
Valorização da dimensão lúdica no desenvolvimento das atividades de enriquecimento curricular/atividades de animação e de apoio à família
Adequação da oferta educativa aos interesses dos alunos e às necessidades de formação da comunidade envolvente
Práticas de organização e gestão do currículo e da aprendizagem para uma educação inclusiva
Integração curricular de atividades culturais, científicas, artísticas e desportivas
Iniciativas de inovação curricular
Iniciativas de inovação pedagógica
Definição de medidas de suporte à aprendizagem e à inclusão que promovam a igualdade de oportunidades de acesso ao currículo
Articulação curricular vertical e horizontal a nível da planificação e desenvolvimento curricular
Articulação com as atividades de enriquecimento curricular/atividades de animação e de apoio à família
Projetos transversais no âmbito da estratégia de educação para a cidadania`.split("\n"),
  "serv-ensino": `Estratégias diversificadas de ensino e aprendizagem com vista à melhoria das aprendizagens, incluindo o desenvolvimento do espírito crítico, a resolução de problemas e o trabalho em equipa
Recurso privilegiado à metodologia de projeto e a atividades experimentais
Estratégias para a manutenção de ambientes de sala de aula propícios à aprendizagem
Medidas universais, seletivas e adicionais de inclusão das crianças e dos alunos
Ações para a melhoria dos resultados das crianças e alunos em grupos de risco, como os oriundos de contextos socioeconómicos desfavorecidos
Práticas de promoção da excelência escolar
Medidas de prevenção da retenção, abandono e desistência
Diversidade de práticas e instrumentos de avaliação nas diferentes modalidades
Aferição de critérios e instrumentos de avaliação
Qualidade e regularidade da informação devolvida às crianças, aos alunos e às famílias
Utilização primordial da avaliação com finalidade formativa
Utilização de recursos educativos diversificados (TIC, biblioteca escolar, centro de recursos educativos)
Adequação dos recursos educativos às características das crianças e dos alunos
Rentabilização do centro de apoio à aprendizagem
Diversidade de formas de participação das famílias na escola
Eficácia das medidas adotadas pela escola para envolver os pais e encarregados de educação no acompanhamento do percurso escolar dos seus educandos
Participação dos pais na equipa multidisciplinar de apoio à educação inclusiva`.split("\n"),
  "serv-plan": `Consistência das práticas de autorregulação no desenvolvimento do currículo
Contribuição da autorregulação para a melhoria da prática letiva
Consistência das práticas de regulação por pares
Formas de colaboração sistemática nos diferentes níveis da planificação e desenvolvimento da atividade letiva
Partilha de práticas científico-pedagógicas relevantes
Reflexão sobre a eficácia das diferentes metodologias de ensino e aprendizagem aplicadas
Contribuição da regulação por pares para a melhoria da prática letiva
Consistência das práticas de regulação pelas lideranças
Contribuição da regulação pelas lideranças para a melhoria da prática letiva`.split("\n"),
  "res-acad": `Percentagem dos alunos da escola que conclui o 1.º ciclo até quatro anos após a entrada no 1.º ano
Percentagem dos alunos da escola que conclui o 2.º ciclo até dois anos após a entrada no 5.º ano
Percentagem dos alunos da escola com percursos diretos de sucesso no 3.º ciclo
Percentagem dos alunos da escola com percursos diretos de sucesso no ensino científico-humanístico
Percentagem dos alunos da escola que conclui o ensino secundário profissional até três anos após ingressar na oferta, entre os que vieram diretamente do 3.º ciclo
Percentagem dos alunos da escola que conclui o ensino artístico especializado integrado até três anos após ingressar na oferta, entre os que vieram diretamente do 3.º ciclo
Taxas de conclusão da oferta dentro do número de anos previsto
Percentagem de adultos certificados em cursos de educação e formação de adultos, face aos que iniciaram a oferta
Taxas anuais de transição dos alunos matriculados no ensino secundário recorrente em regime presencial
Resultados dos alunos oriundos de contextos socioeconómicos desfavorecidos, de origem imigrante e de grupos culturalmente diferenciados
Resultados dos alunos com relatório técnico-pedagógico, programa educativo individual e/ou plano individual de transição
Resultados de desenvolvimento e valorização dos alunos de excelência
Assimetrias internas de resultados`.split("\n"),
  "res-sociais": `Atividades desenvolvidas na escola da iniciativa das crianças e dos alunos
Participação das crianças e alunos nas iniciativas da escola para a formação pessoal e cidadania
Participação dos alunos em diferentes estruturas e órgãos da escola
Percentagem de alunos retidos por faltas
Percentagem das ocorrências em que foram aplicadas medidas disciplinares sancionatórias
Normas e código de conduta
Formas de tratamento dos incidentes disciplinares
Trabalho voluntário
Ações de solidariedade
Ações de apoio à inclusão
Ações de participação democrática
Inserção académica dos alunos
Inserção profissional dos alunos
Inserção dos alunos com plano individual de transição na vida pós-escolar`.split("\n"),
  "res-recon": `Perceção dos alunos acerca da escola
Perceção dos encarregados de educação acerca da escola
Perceção de outras entidades da comunidade acerca da escola
Iniciativas destinadas a valorizar os resultados académicos
Iniciativas destinadas a valorizar os resultados sociais
Reconhecimento por parte da sociedade local e nacional
Envolvimento da escola em iniciativas locais
Disponibilização dos espaços e equipamentos da escola para atividades da comunidade
Participação de adultos em ofertas de educação e formação`.split("\n"),
};

function indicatorId(fieldId: string, index: number) {
  return `${fieldId}:${index + 1}`;
}

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

function splitStatisticalRow(line: string) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : line.includes(",") ? "," : "";
  if (!delimiter) return [line.trim()];
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && line[index + 1] === '"' && quoted) { value += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === delimiter && !quoted) { cells.push(value.trim()); value = ""; continue; }
    value += character;
  }
  cells.push(value.trim());
  return cells;
}

function statisticalCellValue(cell: string) {
  const cleaned = cell.trim().replace(/\s+/g, " ");
  if (!/^[-+]?\d+(?:[.,]\d+)?\s*%?$/.test(cleaned)) return null;
  if (/^(?:19|20)\d{2}$/.test(cleaned)) return null;
  return cleaned;
}

function extractTabularStatisticalRecords(source: string, chunk: TextChunk, startId: number) {
  const records: StatisticalRecord[] = [];
  const rows = chunk.text.split(/\r?\n/).map(splitStatisticalRow).filter((cells) => cells.length >= 2);
  let headers: string[] = [];
  rows.forEach((cells, rowIndex) => {
    const numericIndexes = cells.map((cell, index) => statisticalCellValue(cell) !== null ? index : -1).filter((index) => index >= 0);
    if (!numericIndexes.length) {
      if (cells.some((cell) => /(?:19|20)\d{2}|%|valor|total|media|média|taxa/i.test(cell))) headers = cells;
      return;
    }
    const firstNumeric = numericIndexes[0];
    const labelCells = cells.slice(0, firstNumeric).filter(Boolean);
    const indicator = (labelCells.at(-1) || headers[0] || "Indicador estatístico").replace(/^\d+[.)-]?\s*/, "").trim().slice(0, 220);
    if (!isPlausibleStatisticalLabel(indicator)) return;
    numericIndexes.forEach((cellIndex) => {
      const rawValue = statisticalCellValue(cells[cellIndex]);
      if (!rawValue) return;
      const header = headers[cellIndex]?.trim();
      const period = header?.match(/\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b/)?.[0];
      const context = [indicator, header, rawValue].filter(Boolean).join(" | ");
      records.push({
        id: startId + records.length,
        fieldId: inferStatisticalField(`${indicator} ${header || ""}`),
        indicator,
        value: rawValue,
        context,
        source,
        location: `${chunk.location} · linha ${rowIndex + 1}`,
        dataset: "general",
        sourceKey: `local|${normalizeText(source)}`,
        period,
      });
    });
  });
  return records;
}

function deduplicateStatisticalRecords(records: StatisticalRecord[]) {
  const unique = new Map<string, StatisticalRecord>();
  records.forEach((record) => {
    const scope = record.dataset === "infoescolas"
      ? `infoescolas|${normalizeText(record.source.replace(/·[^·]+$/, ""))}|${record.sourceScopeCode || infoEscolasRecordScope(record) || normalizeText(record.sourceScope || "")}`
      : `local|${normalizeText(record.source)}`;
    // No InfoEscolas, uma observação é identificada pela escola/oferta,
    // indicador, período e série. O endereço, o texto de contexto e até o valor
    // podem mudar numa reimportação; a versão mais recente deve substituir a
    // anterior, não surgir como uma nova linha. Nos ficheiros locais conserva-se
    // também a localização para não fundir linhas distintas do mesmo ficheiro.
    const key = record.dataset === "infoescolas"
      ? [scope, record.fieldId, normalizeText(record.comparisonKey || record.indicator), record.period || "", record.seriesRole || ""].join("|")
      : [scope, record.fieldId, normalizeText(record.indicator), record.period || "", normalizeText(record.location), record.value].join("|");
    unique.set(key, record);
  });
  return [...unique.values()];
}

function deduplicateStatisticalTreatments(treatments: StatisticalTreatment[], records?: StatisticalRecord[]) {
  const unique = new Map<string, StatisticalTreatment>();
  const activeRecordIds = records ? new Set(records.map((record) => record.id)) : null;
  treatments.forEach((treatment) => {
    if (activeRecordIds && treatment.recordIds.length && !treatment.recordIds.some((id) => activeRecordIds.has(id))) return;
    unique.set(treatment.id, treatment);
  });
  return [...unique.values()];
}

function statisticalScopeRank(record: StatisticalRecord) {
  if (record.dataset !== "infoescolas") return 100;
  const explicit = Number(record.sourceScopeCode);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 5) return explicit;
  const scope = normalizeText(`${record.sourceScope || ""} ${record.source} ${record.indicator}`);
  if (/1\s*(?:o|º)?\s*ciclo|primeiro ciclo/.test(scope)) return 1;
  if (/2\s*(?:o|º)?\s*ciclo|segundo ciclo/.test(scope)) return 2;
  if (/3\s*(?:o|º)?\s*ciclo|terceiro ciclo/.test(scope)) return 3;
  if (/profissional/.test(scope)) return 5;
  if (/secundario|cientifico humanistico/.test(scope)) return 4;
  return 90;
}

function compareStatisticalRecords(a: StatisticalRecord, b: StatisticalRecord) {
  const rank = statisticalScopeRank(a) - statisticalScopeRank(b);
  if (rank) return rank;
  const source = a.source.localeCompare(b.source, "pt-PT", { numeric: true, sensitivity: "base" });
  if (source) return source;
  const indicator = (a.comparisonKey || a.indicator).localeCompare(b.comparisonKey || b.indicator, "pt-PT", { numeric: true, sensitivity: "base" });
  if (indicator) return indicator;
  return (a.period || "").localeCompare(b.period || "", "pt-PT", { numeric: true });
}

function extractStatisticalRecords(source: string, chunks: TextChunk[]) {
  const records: StatisticalRecord[] = [];
  chunks.forEach((chunk) => {
    const questionnaireRates = extractQuestionnaireRates(source, chunk, Date.now() * 1000 + records.length);
    if (questionnaireRates.length) {
      records.push(...questionnaireRates);
      return;
    }
    const tabularRecords = extractTabularStatisticalRecords(source, chunk, Date.now() * 1000 + records.length);
    if (tabularRecords.length) {
      records.push(...tabularRecords);
      return;
    }
    const rawLines = chunk.text.split(/\n+|(?<=[.!?])\s+/).map((line) => line.replace(/[•●▪◦*]+/g, " ").replace(/[ \t]+/g, " ").trim());
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
      if (looksLikeExecutableCode(line)) return;
      const percentageMatches = [...line.matchAll(/(?<![\d.,])[-+]?\d{1,3}(?:[.,]\d+)?\s*%/g)];
      const explicitValue = !percentageMatches.length
        ? line.match(/(?:^|[|;\t]|\s[-–—:]\s*)\s*([-+]?\d+(?:[.,]\d+)?)\s*(?=$|[|;\t])/)
        : null;
      const valueMatches = percentageMatches.length ? percentageMatches : explicitValue ? [explicitValue] : [];
      if (!valueMatches.length) return;
      const statisticalLanguage = /%|taxa|média|media|valor|número|numero|índice|indice|percentagem|alunos?|resultados?|participação|participacao|transição|transicao|conclusão|conclusao|retenção|retencao/i.test(line);
      if (!statisticalLanguage) return;
      valueMatches.forEach((match) => {
        const rawValue = (percentageMatches.length ? match[0] : match[1]).trim();
        if (!rawValue.includes("%") && /^(?:19|20)\d{2}$/.test(rawValue)) return;
        const matchIndex = match.index ?? line.indexOf(rawValue);
        const before = line.slice(0, matchIndex).replace(/[|;\t]\s*[^|;\t]{0,45}$/, (tail) => tail);
        const localLabel = before.split(/[|;\t]/).at(-1)?.replace(/^[\s:;,.–—-]+|[\s:;,.–—-]+$/g, "").trim() ?? "";
        const generalLabel = line
          .replace(/(?<![\d.,])[-+]?\d{1,3}(?:[.,]\d+)?\s*%/g, " ")
          .replace(/\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b/g, " ")
          .replace(/\s+/g, " ")
          .replace(/^[\s:;,.–—-]+|[\s:;,.–—-]+$/g, "")
          .trim();
        const indicator = (localLabel.length >= 6 ? localLabel : generalLabel).slice(0, 220) || "Indicador estatístico";
        if (!isPlausibleStatisticalLabel(indicator) || indicator.includes("�")) return;
        records.push({ id: Date.now() * 1000 + records.length, fieldId: inferStatisticalField(line), indicator, value: rawValue, context: line, source, location: chunk.location, dataset: "general", sourceKey: `local|${normalizeText(source)}` });
      });
    });
  });
  return deduplicateStatisticalRecords(records).slice(0, 1000);
}

function looksLikeExecutableCode(text: string) {
  const normalized = text.toLowerCase();
  if (/\b(?:function|parseint|parsefloat|isnan|return|document\.|window\.|getelementbyid|queryselector|innerhtml|textcontent|addEventListener)\b/i.test(text)) return true;
  if (/(?:===|!==|=>|\+\+|--|&&|\|\|)|\b(?:var|let|const)\s+[a-z_$][\w$]*\s*=|[{}]\s*(?:else|catch|finally)\b/i.test(text)) return true;
  const codePunctuation = (text.match(/[{}();=]/g) ?? []).length;
  return codePunctuation >= 4 || (normalized.includes("function") && codePunctuation >= 2);
}

function isPlausibleStatisticalLabel(label: string) {
  const cleaned = label.trim();
  if (cleaned.length < 3 || looksLikeExecutableCode(cleaned)) return false;
  const letters = (cleaned.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) ?? []).length;
  const codeSymbols = (cleaned.match(/[{}();=<>]/g) ?? []).length;
  return letters >= 3 && codeSymbols <= 2 && letters / Math.max(cleaned.length, 1) >= 0.25;
}

function validStatisticalRecord(record: StatisticalRecord) {
  // O contexto é apenas rastreabilidade. Em questionários e tabelas reconstruídas
  // contém legitimamente expressões como "question=...; category=...", que o
  // filtro genérico de código confundia com conteúdo executável. A admissão ao
  // tratamento deve depender do indicador e do valor efetivamente tratável.
  return isPlausibleStatisticalLabel(record.indicator) && parseStatisticalValue(record.value) !== null;
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

function infoEscolasRecordScope(record: StatisticalRecord) {
  if (record.sourceScopeCode) return String(record.sourceScopeCode);
  const text = normalizeText(`${record.comparisonKey || ""} ${record.indicator}`);
  if (/concluem.*1 ciclo.*quatro anos|1 ciclo.*ensino geral/.test(text)) return "1";
  if (/concluem.*2 ciclo.*dois anos|2 ciclo.*geral/.test(text)) return "2";
  if (/concluem.*3 ciclo.*tres anos|antes do 3 ciclo|percursos diretos.*3 ciclo/.test(text)) return "3";
  if (/curso profissional|ensino profissional/.test(text)) return "5";
  if (/cientifico.?humanistico|ensino secundario|antes do secundario/.test(text)) return "4";
  return "";
}

function treatmentPointLabel(record: StatisticalRecord, index: number) {
  if (record.period) return record.period;
  const period = record.context.match(/\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b/);
  return period?.[0] ?? `${record.source.slice(0, 18)} ${index + 1}`;
}

function latestThreePeriods(records: StatisticalRecord[]) {
  const periods = [...new Set(records.map((record) => record.period || treatmentPointLabel(record, 0)))];
  return periods.sort((a, b) => a.localeCompare(b, "pt-PT", { numeric: true })).slice(-3);
}

function indicatorIdsForInfoEscolasTreatment(treatment: StatisticalTreatment) {
  const title = normalizeText(treatment.indicator);
  const ids: string[] = [];
  if (/1 ciclo|primeiro ciclo/.test(title)) ids.push(indicatorId("res-acad", 0));
  if (/2 ciclo|segundo ciclo/.test(title)) ids.push(indicatorId("res-acad", 1));
  if (/3 ciclo|terceiro ciclo/.test(title)) ids.push(indicatorId("res-acad", 2));
  if (/cientifico humanistico/.test(title)) ids.push(indicatorId("res-acad", 3));
  if (/profissional/.test(title)) ids.push(indicatorId("res-acad", 4));
  if (/artistico especializado/.test(title)) ids.push(indicatorId("res-acad", 5));
  if (/apoio ase|\base\b/.test(title)) ids.push(indicatorId("res-acad", 9));
  return [...new Set(ids)];
}

function buildInfoEscolasComparison(items: StatisticalRecord[], id: string): StatisticalTreatment {
  const periods = latestThreePeriods(items);
  const selected = items.filter((item) => periods.includes(item.period || treatmentPointLabel(item, 0)));
  const indicator = selected[0]?.comparisonKey || selected[0]?.indicator.split(" — ")[0] || "Indicador do InfoEscolas";
  const rows = periods.map((period) => {
    const school = selected.find((item) => (item.period || treatmentPointLabel(item, 0)) === period && item.seriesRole === "school");
    const national = selected.find((item) => (item.period || treatmentPointLabel(item, 0)) === period && item.seriesRole === "national");
    const schoolValue = school ? parseStatisticalValue(school.value) : null;
    const nationalValue = national ? parseStatisticalValue(national.value) : null;
    return { period, school, national, schoolValue, nationalValue, difference: schoolValue !== null && nationalValue !== null ? schoolValue - nationalValue : null };
  });
  const complete = rows.filter((row) => row.schoolValue !== null && row.nationalValue !== null);
  const reading = rows.map((row) => {
    if (row.schoolValue === null || row.nationalValue === null || row.difference === null) return `${row.period}: comparação incompleta por ausência de uma das séries.`;
    const relation = Math.abs(row.difference) < 0.05 ? "em linha com" : row.difference > 0 ? "acima de" : "abaixo de";
    return `${row.period}: escola ${row.schoolValue.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% e nacional ${row.nationalValue.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}% — ${Math.abs(row.difference).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} p.p. ${relation} o valor nacional.`;
  }).join(" ");
  const first = complete[0];
  const last = complete.at(-1);
  const trend = first && last && first !== last
    ? `Entre ${first.period} e ${last.period}, a diferença face ao nacional variou de ${first.difference!.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} para ${last.difference!.toLocaleString("pt-PT", { maximumFractionDigits: 1 })} pontos percentuais.`
    : "A série disponível não permite ainda apurar a evolução da diferença face ao nacional.";
  const values = complete.flatMap((row) => [row.schoolValue!, row.nationalValue!]);
  return {
    id,
    fieldId: "res-acad",
    indicator,
    unit: "%",
    summary: `No indicador «${indicator}», a leitura comparada dos três últimos anos letivos disponíveis é a seguinte: ${reading} ${trend} A interpretação deve atender à consistência da tendência e não a um valor anual isolado.`,
    recordIds: selected.map((item) => item.id),
    sources: [...new Set(selected.map((item) => item.source))],
    points: complete.flatMap((row) => [
      { label: `${row.period} · Escola`, value: row.schoolValue!, source: row.school?.source || "InfoEscolas" },
      { label: `${row.period} · Nacional`, value: row.nationalValue!, source: row.national?.source || "InfoEscolas" },
    ]),
    minimum: values.length ? Math.min(...values) : null,
    maximum: values.length ? Math.max(...values) : null,
    average: values.length ? values.reduce((total, value) => total + value, 0) / values.length : null,
    strengths: [],
    improvements: complete.length < 3 ? ["A comparação não cobre três anos letivos completos com ambas as séries."] : [],
    evidenceUse: "academic-comparison",
    sourceKeys: [...new Set(selected.map((item) => item.sourceKey).filter((value): value is string => Boolean(value)))],
  };
}

function buildStatisticalTreatments(records: StatisticalRecord[]) {
  const grouped = new Map<string, StatisticalRecord[]>();
  records.forEach((record) => {
    const unit = record.value.includes("%") ? "%" : "valor";
    const respondentGroup = record.indicator.match(/—\s*(Alunos|Encarregados de educação|Docentes|Não docentes)$/i)?.[1];
    const key = record.dataset === "infoescolas" && record.evidenceUse === "academic-comparison" && record.comparisonKey
      ? `infoescolas|${record.sourceKey || normalizeText(record.source)}|${normalizeText(record.comparisonKey)}`
      : record.dataset === "infoescolas" && record.evidenceUse === "context-only"
        ? `infoescolas-context|${record.sourceKey || normalizeText(record.source)}|${record.fieldId}|${unit}|${treatmentIndicatorKey(record)}`
      : respondentGroup
        ? `questionnaire|${record.sourceKey || normalizeText(record.source)}|${respondentGroup}`
        : `local|${record.sourceKey || normalizeText(record.source)}|${record.fieldId}|${unit}|${treatmentIndicatorKey(record)}`;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  });
  return [...grouped.entries()].map(([id, items]): StatisticalTreatment => {
    if (id.startsWith("infoescolas|")) return buildInfoEscolasComparison(items, id);
    const respondentGroup = id.startsWith("questionnaire|") ? id.split("|").at(-1) as StatisticalTreatment["respondentGroup"] : undefined;
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
        sourceKeys: [...new Set(items.map((item) => item.sourceKey).filter((value): value is string => Boolean(value)))],
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
      evidenceUse: id.startsWith("infoescolas-context|") ? "context-only" : undefined,
      sourceKeys: [...new Set(items.map((item) => item.sourceKey).filter((value): value is string => Boolean(value)))],
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
      const text = content.items.map((item) => "str" in item ? `${item.str}${"hasEOL" in item && item.hasEOL ? "\n" : " "}` : "").join("").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
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

const privacyPatterns: Array<{ kind: PrivacyFinding["kind"]; pattern: RegExp; replacement?: string }> = [
  { kind: "Contacto", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL REMOVIDO]" },
  { kind: "Contacto", pattern: /(?<!\d)(?:\+351[ .-]?)?(?:2\d{8}|9[1236]\d{7})(?!\d)/g, replacement: "[TELEFONE REMOVIDO]" },
  { kind: "Identificador", pattern: /\bPT50(?:[ .-]?\d){21}\b/gi, replacement: "[IBAN REMOVIDO]" },
  { kind: "Identificador", pattern: /\b(?:NIF|NIPC|NISS|CC|BI|n[úu]mero de aluno|n\.?[ºo] de aluno)\s*[:#-]?\s*[A-Z0-9][A-Z0-9 .-]{4,20}/gi, replacement: "[IDENTIFICADOR REMOVIDO]" },
  { kind: "Nome possível", pattern: /\b(?:Nome|Aluno|Aluna|Encarregado de Educa[cç][aã]o|Representante legal)\s*:\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}'’-]+(?:\s+(?:d[aeo]s?|e|[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][\p{L}'’-]+)){1,5}/gu, replacement: "[NOME REMOVIDO]" },
];

const sensitivePattern = /\b(?:sa[úu]de|diagn[óo]stico|defici[êe]ncia|incapacidade|medica[cç][aã]o|doen[cç]a|necessidades? educativas? espec[ií]ficas?|medidas? seletivas?|medidas? adicionais?|processo disciplinar|san[cç][aã]o disciplinar|viol[êe]ncia|bullying|contexto familiar|tribunal|comiss[aã]o de prote[cç][aã]o)\b/gi;

function defaultPrivacyCategory(source: string): PrivacyCategory {
  const normalized = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/infoescolas|resultado|estatistic|questionario|taxa|indicador/.test(normalized)) return "Estatístico agregado";
  if (/projeto educativo|regulamento|plano anual|relatorio de autoavaliacao|plano de melhoria/.test(normalized)) return "Institucional público";
  return "Interno";
}

function privacyReview(source: string, chunks: TextChunk[]): PrivacyReview {
  const findings: PrivacyFinding[] = [];
  const sanitizedChunks = chunks.map((chunk, chunkIndex) => {
    let text = chunk.text;
    privacyPatterns.forEach((definition, patternIndex) => {
      definition.pattern.lastIndex = 0;
      text = text.replace(definition.pattern, (value) => {
        findings.push({ id: `${chunkIndex}-${patternIndex}-${findings.length}`, kind: definition.kind, value: value.slice(0, 120), location: chunk.location, redacted: true });
        return definition.replacement ?? "[DADO REMOVIDO]";
      });
    });
    sensitivePattern.lastIndex = 0;
    for (const match of chunk.text.matchAll(sensitivePattern)) {
      findings.push({ id: `${chunkIndex}-s-${findings.length}`, kind: "Informação sensível", value: match[0], location: chunk.location, redacted: false });
      if (findings.length >= 80) break;
    }
    return { ...chunk, text };
  });
  const sensitive = findings.some((finding) => finding.kind === "Informação sensível");
  const direct = findings.filter((finding) => finding.redacted).length;
  const risk: PrivacyRisk = sensitive || direct >= 5 ? "Elevado" : direct > 0 ? "Moderado" : "Baixo";
  return { source, category: defaultPrivacyCategory(source), risk, findings: findings.slice(0, 80), originalChunks: chunks, sanitizedChunks };
}

function getField(id: string) {
  return fields.find((field) => field.id === id) ?? fields[0];
}

function evidenceProbativeProfile(record: Evidence) {
  const text = normalizeText(`${record.claim} ${record.location}`);
  const linkedIndicators = record.indicatorIds?.length ?? 0;
  const hasSpecificLocation = Boolean(record.location.trim()) && !/^(amostra|sem pagina|nao identificada)$/i.test(normalizeText(record.location));
  const hasConcreteData = /\b\d+(?:[.,]\d+)?\s*%|\b(taxa|percentagem|media|resultado|evolucao|aumento|reducao|meta|impacto|efeito|progresso)\b/.test(text);
  const demonstratesPractice = /\b(implementa|realiza|executa|monitoriza|acompanha|aplica|desenvolve|funciona|assegura)\b/.test(text);
  const merelyIntended = /\b(preve|pretende|visa|devera|objetivo|orientacao|regulamento|criterio)\b/.test(text) && !demonstratesPractice && !hasConcreteData;
  const historical = /\b(20(?:0\d|1\d|2[0-4]))\b/.test(text);
  let score = 0;
  if (linkedIndicators > 0) score += linkedIndicators <= 2 ? 3 : 2;
  if (record.claim.trim().length >= 70) score += 1;
  if (hasSpecificLocation) score += 1;
  if (hasConcreteData) score += 2;
  else if (demonstratesPractice) score += 1;
  if (merelyIntended) score -= 1;
  if (historical) score -= 1;
  if (record.status === "Confirmada") score += 1;
  if (record.status === "Contraditória") score -= 2;
  const quality: Strength = score >= 7 ? "Forte" : score >= 4 ? "Moderada" : "Insuficiente";
  const demonstration = hasConcreteData ? (/\b(impacto|efeito|mudanca)\b/.test(text) ? "impacto" : "resultado") : demonstratesPractice ? "prática" : "intenção";
  return { quality, score, demonstration, historical };
}

function independentSourceKey(record: Evidence) {
  return normalizeText(record.source)
    .replace(/\b(anexo|volume|parte|capitulo|pagina|pp?|ficheiro)\b.*$/g, "")
    .replace(/\b(versao|revisto|final)\b/g, "")
    .replace(/\s+/g, " ").trim();
}

function triangulationFor(records: Evidence[]): TriangulationLevel {
  if (records.some((record) => record.status === "Contraditória")) return "Contraditória";
  const sourceFamilies = new Set(records.map(independentSourceKey).filter(Boolean));
  const sourceTypes = new Set(records.map((record) => record.sourceType));
  if (sourceFamilies.size >= 2 && sourceTypes.size >= 2) return "Confirmada";
  if (sourceFamilies.size >= 2 || sourceTypes.size >= 2) return "Parcial";
  return "Não realizada";
}

function strengthFor(records: Evidence[]): Strength {
  if (!records.length) return "Insuficiente";
  const profiles = records.map(evidenceProbativeProfile);
  const average = profiles.reduce((sum, item) => sum + item.score, 0) / profiles.length;
  const strongIndicators = profiles.filter((item) => item.quality === "Forte").length;
  if (average >= 6.5 || strongIndicators >= Math.ceil(records.length / 2)) return "Forte";
  if (average >= 3.5) return "Moderada";
  return "Insuficiente";
}

function fieldDiagnostic(field: Field, records: Evidence[], applicability: Record<string, IndicatorApplicability> = {}) {
  const applicableIds = (indicatorLabels[field.id] ?? []).map((_, index) => indicatorId(field.id, index)).filter((id) => applicability[id] !== "Não aplicável");
  const expected = applicableIds.length;
  const applicableSet = new Set(applicableIds);
  const linked = new Set(records.flatMap((record) => record.indicatorIds ?? []).filter((id) => applicableSet.has(id)));
  const sources = new Set(records.map(independentSourceKey).filter(Boolean));
  const sourceTypes = new Set(records.map((record) => record.sourceType));
  const corpus = normalizeText(records.map((record) => record.claim).join(" "));
  const hasResults = /\b(resultado|resultados|evolucao|melhoria|reducao|aumento|taxa|percentagem|impacto|efeito|mudanca|progresso|eficacia)\b/.test(corpus);
  const profiles = records.map((record) => ({ evidenceId: record.id, indicatorIds: record.indicatorIds ?? [], ...evidenceProbativeProfile(record) }));
  const triangulation = triangulationFor(records);
  return {
    indicatorTotal: expected,
    indicatorCovered: linked.size,
    coveragePercent: expected ? Math.round((linked.size / expected) * 100) : 0,
    evidenceCount: records.length,
    sourceCount: sources.size,
    sourceTypes: [...sourceTypes],
    independentDiversity: triangulation === "Confirmada",
    triangulation,
    hasContradictions: records.some((record) => record.status === "Contraditória"),
    hasResultsOrImpact: hasResults,
    evidenceQuality: strengthFor(records),
    evidenceProfiles: profiles,
    strength: strengthFor(records),
  };
}

function reportHeading(domain: string) {
  const index = domainOrder.indexOf(domain);
  return [`5.1 — Autoavaliação`, `5.2 — Liderança e gestão`, `5.3 — Prestação do serviço educativo`, `5.4 — Resultados`][index];
}

function completeSentence(value: string) {
  const sentence = value.trim().replace(/\s+/g, " ").replace(/\.{2,}$/g, ".").replace(/([!?])\1+$/g, "$1");
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
  return `No campo ${field.name.toLocaleLowerCase("pt-PT")}, a informação validada permite identificar como elementos centrais ${synthesis}. Consideradas em conjunto, estas evidências caracterizam as práticas e opções organizacionais abrangidas pelos referentes do campo.`;
}

function composeFieldNarrative(field: Field, records: Evidence[], applicability: Record<string, IndicatorApplicability> = {}) {
  if (!records.length) return "Não existe ainda evidência validada suficiente para caracterizar este campo de análise ou formular um juízo avaliativo sustentado.";

  const confirmed = records.filter((record) => record.status === "Confirmada");
  const contradictory = records.filter((record) => record.status === "Contraditória");
  const provisional = records.filter((record) => record.status === "Por triangular");
  const ordered = [...confirmed, ...provisional, ...contradictory]
    .map((record) => ({ ...record, narrativeClaim: cleanEvidenceClaim(record.claim) }))
    .filter((record) => record.narrativeClaim);
  const strength = strengthFor(ordered);
  const diagnostic = fieldDiagnostic(field, records, applicability);
  if (!ordered.length) return `No campo ${field.name.toLocaleLowerCase("pt-PT")}, os registos validados correspondem sobretudo a fragmentos de tabelas ou listas e não permitem, sem reformulação, construir uma caracterização sintaticamente segura.`;

  const paragraphs: string[] = [field.id === "auto-impacto" ? composeImpactNarrative(ordered) : composeGenericAnalyticalNarrative(field, ordered)];

  if (contradictory.length) {
    paragraphs.push("A existência de informação contraditória impede, nesta fase, uma conclusão estável e requer esclarecimento através de fonte independente ou dos painéis de entrevista.");
  } else if (diagnostic.coveragePercent < 100) {
    paragraphs.push(`A análise cobre ${diagnostic.indicatorCovered} dos ${diagnostic.indicatorTotal} indicadores aplicáveis (${diagnostic.coveragePercent}%), permanecendo os restantes sem evidência validada.`);
  } else if (diagnostic.evidenceQuality === "Insuficiente") {
    paragraphs.push("Todos os indicadores do campo estão cobertos, mas a qualidade probatória das evidências associadas é ainda insuficiente para sustentar uma interpretação robusta.");
  } else if (diagnostic.triangulation === "Não realizada") {
    paragraphs.push("Todos os indicadores do campo estão cobertos por evidência pertinente, embora a interpretação dependa de uma única linha probatória e ainda não esteja triangulada.");
  } else if (diagnostic.triangulation === "Parcial") {
    paragraphs.push("Todos os indicadores do campo estão cobertos por evidência pertinente; a triangulação é parcial, por assentar em fontes próximas ou de natureza pouco diversificada.");
  } else if (!diagnostic.hasResultsOrImpact) {
    paragraphs.push("Todos os indicadores estão cobertos por fontes diversificadas; contudo, a evidência sustenta sobretudo práticas e processos, não permitindo ainda demonstrar resultados ou impacto.");
  } else if (strength === "Forte") paragraphs.push("A cobertura integral dos indicadores e a diversidade das fontes conferem robustez à interpretação.");

  return paragraphs.join(" ");
}

function buildNarratives(evidence: Evidence[], applicability: Record<string, IndicatorApplicability> = {}) {
  return Object.fromEntries(fields.map((field) => [field.id, composeFieldNarrative(field, evidence.filter((record) => record.fieldId === field.id && record.validated), applicability)]));
}

function preserveReviewedNarratives(evidence: Evidence[], narratives: Record<string, string>, applicability: Record<string, IndicatorApplicability> = {}) {
  const completed = buildNarratives(evidence, applicability);
  Object.entries(narratives).forEach(([fieldId, narrative]) => {
    const normalized = normalizeText(narrative);
    const containsStructuralFragments = /[•●▪◦*]|publico[- ]alvo|metas? especificas?|objetivos? especificos?|calendarizacao|recursos necessarios|total de questionarios|concordo totalmente.*discordo|n\.?[oº]\s*%.*n\.?[oº]\s*%/.test(normalized);
    const legacyConcatenation = /evidencia validada permite reconhecer que|em convergencia|acresce que|convergencia observada sustenta uma leitura/.test(normalized);
    if (narrative.trim() && !containsStructuralFragments && !legacyConcatenation) completed[fieldId] = narrative.trim();
  });
  return completed;
}

function buildReport(evidence: Evidence[], narratives: Record<string, string> = {}, applicability: Record<string, IndicatorApplicability> = {}) {
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
      const narrative = narratives[field.id]?.trim() || composeFieldNarrative(field, records, applicability);
      lines.push(`${field.section}. ${field.name}`, "", completeSentence(narrative), "");
    });
  });
  lines.push("NOTA DE CONTROLO", "A redação distingue evidência, inferência e juízo. A validação final, a seleção dos pontos fortes e das áreas de melhoria pertencem à equipa de avaliação.");
  return lines.join("\n");
}

function isDirectCompletionComparison(value: string) {
  const normalized = normalizeText(value);
  if (/\b(?:ase|acao social escolar|provas? nacionais?|sem retencoes|retencao|desistencia)\b/.test(normalized)) return false;
  return /percentagem de alunos.*(?:concluem|concluiram|conclusao).*(?:ciclo|ensino secundario|curso profissional|curso).*(?:em|no prazo de)\s+(?:dois|tres|quatro|[234])\s+anos/.test(normalized)
    || /percursos? diretos? de sucesso.*(?:ciclo|secundario|profissional)/.test(normalized);
}

function requiredAcademicComparisons(records: Evidence[]) {
  return records
    .filter((item) => item.fieldId === "res-acad" && item.validated && item.sourceType === "Quantitativa" && (item.indicatorIds?.length ?? 0) > 0 && /nacional|país|pais|portugal/i.test(item.claim) && item.claim.trim() && isDirectCompletionComparison(item.claim))
    .map((item) => item.claim.trim());
}

function evidenceRevision(records: Evidence[], fieldId: string) {
  return records
    .filter((record) => record.fieldId === fieldId && record.validated)
    .map((record) => `${record.id}|${record.status}|${record.claim}|${(record.indicatorIds ?? []).join(",")}`)
    .sort()
    .join("\n");
}

function comparisonFacts(value: string) {
  return [...new Set(value.match(/\b(?:19|20)\d{2}\/\d{2}\b|[-−]?\d+(?:[,.]\d+)?\s*(?:%|p\.p\.)/gi) ?? [])]
    .map((item) => normalizeText(item).replace(/−/g, "-"));
}

function containsAcademicComparison(text: string, comparison: string) {
  const normalized = normalizeText(text).replace(/−/g, "-");
  const facts = comparisonFacts(comparison);
  return facts.length > 0 && facts.every((fact) => normalized.includes(fact));
}

function ensureAcademicComparisonsInNarrative(narrative: string, comparisons: string[]) {
  const missing = comparisons.filter((comparison) => !containsAcademicComparison(narrative, comparison));
  return [narrative.trim(), ...missing].filter(Boolean).join("\n\n");
}

function ensureAcademicComparisonsInReport(report: string, comparisons: string[]) {
  const missing = comparisons.filter((comparison) => !containsAcademicComparison(report, comparison));
  if (!missing.length) return report;
  const block = missing.join("\n\n");
  const nextSection = /\n5\.4\.2\.?\s+/i;
  const match = nextSection.exec(report);
  if (!match || match.index === undefined) return `${report.trim()}\n\n${block}`;
  return `${report.slice(0, match.index).trimEnd()}\n\n${block}\n${report.slice(match.index)}`;
}

const negativeConclusionPattern = /\b(?:não|sem|insuficiente|limitad[ao]s?|fragilidad|desigual|irregular|carece|lacuna|contradit|abaixo|reduzid[ao]s?|não permite|não demonstra|por consolidar|necessita|requer)\b/i;
const boilerplateConclusionPattern = /\b(?:evidência validada|base probatória|formulação do juízo|validação da equipa|fontes? independente|não demonstram?, por si só)\b/i;

function conclusionSentence(value: string) {
  return completeSentence(value.replace(/^No campo [^,]+,\s*/i, "").replace(/^A informação (?:validada|disponível) (?:permite identificar|evidencia|aponta para)\s*/i, "").trim());
}

function localDomainConclusions(narratives: Record<string, string>, evidence: Evidence[]): DomainConclusion[] {
  return domainOrder.map((domain) => {
    const domainFields = fields.filter((field) => field.domain === domain);
    const domainRecords = evidence.filter((record) => record.validated && domainFields.some((field) => field.id === record.fieldId));
    const sentences = domainFields.flatMap((field) => (narratives[field.id] || composeFieldNarrative(field, domainRecords.filter((record) => record.fieldId === field.id)))
      .split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter((item) => item.length >= 45 && !boilerplateConclusionPattern.test(item)));
    const improvements = sentences.filter((item) => negativeConclusionPattern.test(item)).slice(0, 4).map(conclusionSentence);
    const strengths = sentences.filter((item) => !negativeConclusionPattern.test(item)).slice(0, 4).map(conclusionSentence);
    const covered = domainFields.filter((field) => domainRecords.some((record) => record.fieldId === field.id)).length;
    const strongFields = domainFields.filter((field) => strengthFor(domainRecords.filter((record) => record.fieldId === field.id)) === "Forte").length;
    let rating: Rating = "Por definir";
    if (covered === domainFields.length && strengths.length > improvements.length && strongFields >= Math.ceil(domainFields.length / 2)) rating = "Muito bom";
    else if (covered >= Math.ceil(domainFields.length / 2) && strengths.length > improvements.length) rating = "Bom";
    else if (covered > 0 && strengths.length && improvements.length) rating = "Suficiente";
    else if (covered > 0 && improvements.length > strengths.length) rating = "Insuficiente";
    const rationale = rating === "Por definir"
      ? "A cobertura ou a robustez da evidência ainda não permite propor uma menção com segurança."
      : `Proposta local baseada na cobertura de ${covered}/${domainFields.length} campos e no equilíbrio entre pontos fortes e áreas de melhoria; requer validação da equipa.`;
    return { domain, strengths, improvements, rating, rationale };
  });
}

function conclusionsExport(conclusions: DomainConclusion[]) {
  const lines = ["QUADRO-RESUMO DAS CLASSIFICAÇÕES", ""];
  conclusions.forEach((item) => lines.push(`${item.domain}: ${item.rating}`, item.rationale, ""));
  lines.push("PONTOS FORTES", "");
  conclusions.forEach((item) => lines.push(item.domain, ...(item.strengths.length ? item.strengths.map((value) => `• ${value}`) : ["[A validar]" ]), ""));
  lines.push("ÁREAS DE MELHORIA", "");
  conclusions.forEach((item) => lines.push(item.domain, ...(item.improvements.length ? item.improvements.map((value) => `• ${value}`) : ["[A validar]" ]), ""));
  lines.push("NOTA", "As classificações, os pontos fortes e as áreas de melhoria constituem propostas de trabalho sujeitas a validação pela equipa de avaliação.");
  return lines.join("\n");
}

function createAnalysisBlocks(chunks: TextChunk[], targetSize = 8_000, overlapSize = 800): AnalysisBlock[] {
  const units: TextChunk[] = [];
  chunks.forEach((chunk) => {
    if (chunk.text.length <= targetSize) units.push(chunk);
    else {
      let start = 0;
      let part = 1;
      while (start < chunk.text.length) {
        const end = Math.min(start + targetSize, chunk.text.length);
        units.push({ text: chunk.text.slice(start, end), location: `${chunk.location} · parte ${part}` });
        if (end === chunk.text.length) break;
        start = Math.max(end - overlapSize, start + 1);
        part += 1;
      }
    }
  });

  const blocks: AnalysisBlock[] = [];
  let current: TextChunk[] = [];
  let currentSize = 0;
  for (const unit of units) {
    if (current.length && currentSize + unit.text.length > targetSize) {
      blocks.push({ text: current.map((item) => `[${item.location}]\n${item.text}`).join("\n\n"), label: `${current[0].location} — ${current[current.length - 1].location}` });
      const previous = current[current.length - 1];
      const overlapText = previous.text.slice(-overlapSize);
      current = overlapText ? [{ text: overlapText, location: `${previous.location} · contexto sobreposto` }] : [];
      currentSize = overlapText.length;
    }
    current.push(unit);
    currentSize += unit.text.length;
  }
  if (current.length) blocks.push({ text: current.map((item) => `[${item.location}]\n${item.text}`).join("\n\n"), label: `${current[0].location} — ${current[current.length - 1].location}` });
  return blocks;
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
  const [statisticalWorkspace, setStatisticalWorkspace] = useState<"infoescolas" | "general">("infoescolas");
  const [questionnaireComments, setQuestionnaireComments] = useState<QuestionnaireComment[]>([]);
  const [commentGroup, setCommentGroup] = useState<QuestionnaireComment["group"]>("Alunos");
  const [commentSource, setCommentSource] = useState("Relato escrito");
  const [commentText, setCommentText] = useState("");
  const [questionnaireReport, setQuestionnaireReport] = useState("");
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [files, setFiles] = useState<string[]>(["Projeto educativo — demonstração.pdf", "Relatório de autoavaliação — demonstração.docx", "Resultados académicos — demonstração.xlsx"]);
  const [fileAnalysis, setFileAnalysis] = useState<Record<string, FileAnalysis>>({});
  const [privacyReviews, setPrivacyReviews] = useState<PrivacyReview[]>([]);
  const [privacyConfirmed, setPrivacyConfirmed] = useState<string[]>([]);
  const [preparedDocuments, setPreparedDocuments] = useState<PreparedDocument[]>([]);
  const [filterDomain, setFilterDomain] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [interviewPanel, setInterviewPanel] = useState("Docentes");
  const [interviewField, setInterviewField] = useState(fields[0].id);
  const [interviewText, setInterviewText] = useState("");
  const [interviewCandidates, setInterviewCandidates] = useState<InterviewCandidate[]>([]);
  const [selectedInterviewCandidates, setSelectedInterviewCandidates] = useState<number[]>([]);
  const [interviewAnalysisStatus, setInterviewAnalysisStatus] = useState("");
  const [interviewAnalyzing, setInterviewAnalyzing] = useState(false);
  const [report, setReport] = useState("");
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [triangulationRevisions, setTriangulationRevisions] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [changesPending, setChangesPending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [aiTriangulatingField, setAiTriangulatingField] = useState("");
  const [aiTriangulatingAll, setAiTriangulatingAll] = useState(false);
  const [aiTriangulationStatus, setAiTriangulationStatus] = useState("");
  const [aiReportWriting, setAiReportWriting] = useState(false);
  const [backupStatus, setBackupStatus] = useState("");
  const [conclusions, setConclusions] = useState<DomainConclusion[]>([]);
  const [aiConclusionsWriting, setAiConclusionsWriting] = useState(false);
  const [conclusionsStatus, setConclusionsStatus] = useState("");
  const [indicatorApplicability, setIndicatorApplicability] = useState<Record<string, IndicatorApplicability>>({});
  const [indicatorFieldId, setIndicatorFieldId] = useState("all");
  const [indicatorSuggestions, setIndicatorSuggestions] = useState<IndicatorSuggestion[]>([]);
  const [indicatorDrafts, setIndicatorDrafts] = useState<Record<number, string[]>>({});
  const [indicatorSuggestionStatus, setIndicatorSuggestionStatus] = useState("");
  const [aiSuggestingIndicators, setAiSuggestingIndicators] = useState(false);

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
        if (Array.isArray(data.interviewCandidates)) setInterviewCandidates(data.interviewCandidates);
        const restoredStatisticalRecords = Array.isArray(data.statisticalRecords) ? deduplicateStatisticalRecords(data.statisticalRecords) : [];
        setStatisticalRecords(restoredStatisticalRecords);
        if (Array.isArray(data.statisticalTreatments)) setStatisticalTreatments(deduplicateStatisticalTreatments(data.statisticalTreatments.filter((item: StatisticalTreatment) => Array.isArray(item.points) && Array.isArray(item.strengths) && Array.isArray(item.improvements)), restoredStatisticalRecords));
        if (Array.isArray(data.questionnaireComments)) setQuestionnaireComments(data.questionnaireComments);
        if (typeof data.questionnaireReport === "string") setQuestionnaireReport(data.questionnaireReport);
        if (Array.isArray(data.files)) setFiles(data.files);
        if (data.fileAnalysis && typeof data.fileAnalysis === "object") setFileAnalysis(data.fileAnalysis);
        if (typeof data.report === "string") setReport(data.report);
        if (data.narratives && typeof data.narratives === "object") setNarratives(data.narratives);
        if (data.triangulationRevisions && typeof data.triangulationRevisions === "object") setTriangulationRevisions(data.triangulationRevisions);
        if (Array.isArray(data.conclusions)) setConclusions(data.conclusions);
        if (data.indicatorApplicability && typeof data.indicatorApplicability === "object") setIndicatorApplicability(data.indicatorApplicability);
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
  const pendingEvidenceCount = evidence.filter((record) => !record.validated).length;
  const pendingBreakdown = {
    privacy: privacyReviews.length,
    documents: documentCandidates.length,
    interviews: interviewCandidates.length,
    evidence: pendingEvidenceCount,
  };
  const pendingCount = Object.values(pendingBreakdown).reduce((total, count) => total + count, 0);
  const applicableIndicatorIds = fields.flatMap((field) => (indicatorLabels[field.id] ?? []).map((_, index) => indicatorId(field.id, index)))
    .filter((id) => indicatorApplicability[id] !== "Não aplicável");
  const coveredIndicatorIds = new Set(evidence.filter((record) => record.validated)
    .flatMap((record) => record.indicatorIds ?? []).filter((id) => applicableIndicatorIds.includes(id)));
  const indicatorCoverage = applicableIndicatorIds.length ? (coveredIndicatorIds.size / applicableIndicatorIds.length) * 100 : 0;
  const sourceTypeCount = new Set(evidence.filter((record) => record.validated).map((record) => record.sourceType)).size;
  const allCandidatesSelected = documentCandidates.length > 0 && documentCandidates.every((candidate) => selectedCandidates.includes(candidate.id));
  const orderedStatisticalRecords = useMemo(() => [...statisticalRecords].sort(compareStatisticalRecords), [statisticalRecords]);
  const workspaceStatisticalRecords = useMemo(() => orderedStatisticalRecords.filter((record) => (record.dataset || "general") === statisticalWorkspace), [orderedStatisticalRecords, statisticalWorkspace]);
  const allStatisticalSelected = workspaceStatisticalRecords.length > 0 && workspaceStatisticalRecords.every((record) => selectedStatisticalIds.includes(record.id));
  const promotableTreatments = statisticalTreatments.filter((treatment) => treatment.evidenceUse !== "context-only");
  const orderedStatisticalTreatments = useMemo(() => {
    const recordsById = new Map(statisticalRecords.map((record) => [record.id, record]));
    return [...statisticalTreatments].sort((a, b) => {
      const aRecord = a.recordIds.map((id) => recordsById.get(id)).filter((record): record is StatisticalRecord => Boolean(record)).sort(compareStatisticalRecords)[0];
      const bRecord = b.recordIds.map((id) => recordsById.get(id)).filter((record): record is StatisticalRecord => Boolean(record)).sort(compareStatisticalRecords)[0];
      const rank = (aRecord ? statisticalScopeRank(aRecord) : 100) - (bRecord ? statisticalScopeRank(bRecord) : 100);
      return rank || a.indicator.localeCompare(b.indicator, "pt-PT", { numeric: true, sensitivity: "base" });
    });
  }, [statisticalRecords, statisticalTreatments]);
  const recordDatasetById = useMemo(() => new Map(statisticalRecords.map((record) => [record.id, record.dataset || "general"])), [statisticalRecords]);
  const workspaceStatisticalTreatments = useMemo(() => orderedStatisticalTreatments.filter((treatment) => treatment.recordIds.some((id) => recordDatasetById.get(id) === statisticalWorkspace)), [orderedStatisticalTreatments, recordDatasetById, statisticalWorkspace]);
  const workspacePromotableTreatments = workspaceStatisticalTreatments.filter((treatment) => treatment.evidenceUse !== "context-only");
  const workspaceSelectedTreatmentCount = workspacePromotableTreatments.filter((treatment) => selectedTreatmentIds.includes(treatment.id)).length;
  const allTreatmentsSelected = workspacePromotableTreatments.length > 0 && workspacePromotableTreatments.every((treatment) => selectedTreatmentIds.includes(treatment.id));
  const quantitativeEvidence = evidence.filter((record) => record.sourceType === "Quantitativa" && record.statisticalTreatmentId);

  function saveLocal() {
    window.localStorage.setItem("aee-piloto-v2", JSON.stringify({ schoolName, evidence, documentCandidates, statisticalRecords, statisticalTreatments, questionnaireComments, questionnaireReport, interviews, interviewCandidates, files, fileAnalysis, narratives, triangulationRevisions, report, conclusions, indicatorApplicability, lastUpdated }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  function exportBackup() {
    const payload = { schoolName, evidence, documentCandidates, statisticalRecords, statisticalTreatments, questionnaireComments, questionnaireReport, interviews, interviewCandidates, files, fileAnalysis, narratives, triangulationRevisions, report, conclusions, indicatorApplicability, lastUpdated };
    const backup = {
      format: "plataforma-aee-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      payload,
    };
    const safeName = (schoolName || "processo-aee").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "processo-aee";
    const date = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}-copia-seguranca-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setBackupStatus("Cópia de segurança exportada.");
    window.setTimeout(() => setBackupStatus(""), 3000);
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setBackupStatus("O ficheiro excede o limite de 25 MB.");
      return;
    }
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== "plataforma-aee-backup" || parsed?.version !== 1 || !parsed?.payload) throw new Error("Formato inválido");
      const data = parsed.payload;
      if (!Array.isArray(data.evidence) || !Array.isArray(data.documentCandidates) || !Array.isArray(data.interviews) || !Array.isArray(data.files) || typeof data.fileAnalysis !== "object" || data.fileAnalysis === null) throw new Error("Conteúdo incompleto");
      if (!window.confirm(`Importar a cópia de segurança de “${data.schoolName || "processo AEE"}”? O trabalho atualmente aberto será substituído.`)) return;
      setSchoolName(typeof data.schoolName === "string" ? data.schoolName : "Nova escola");
      setEvidence(data.evidence);
      setDocumentCandidates(data.documentCandidates);
      setSelectedCandidates([]);
      const restoredStatisticalRecords = Array.isArray(data.statisticalRecords) ? deduplicateStatisticalRecords(data.statisticalRecords) : [];
      setStatisticalRecords(restoredStatisticalRecords);
      setSelectedStatisticalIds([]);
      setStatisticalTreatments(Array.isArray(data.statisticalTreatments) ? deduplicateStatisticalTreatments(data.statisticalTreatments, restoredStatisticalRecords) : []);
      setSelectedTreatmentIds([]);
      setQuestionnaireComments(Array.isArray(data.questionnaireComments) ? data.questionnaireComments : []);
      setQuestionnaireReport(typeof data.questionnaireReport === "string" ? data.questionnaireReport : "");
      setInterviews(data.interviews);
      setInterviewCandidates(Array.isArray(data.interviewCandidates) ? data.interviewCandidates : []);
      setSelectedInterviewCandidates([]);
      setFiles(data.files);
      setFileAnalysis(data.fileAnalysis);
      setNarratives(data.narratives && typeof data.narratives === "object" ? data.narratives : {});
      setTriangulationRevisions(data.triangulationRevisions && typeof data.triangulationRevisions === "object" ? data.triangulationRevisions : {});
      setReport(typeof data.report === "string" ? data.report : "");
      setConclusions(Array.isArray(data.conclusions) ? data.conclusions : []);
      setIndicatorApplicability(data.indicatorApplicability && typeof data.indicatorApplicability === "object" ? data.indicatorApplicability : {});
      setLastUpdated(typeof data.lastUpdated === "string" ? data.lastUpdated : "");
      setPrivacyReviews([]);
      setPrivacyConfirmed([]);
      setPreparedDocuments([]);
      setChangesPending(false);
      window.localStorage.setItem("aee-piloto-v2", JSON.stringify(data));
      setBackupStatus("Cópia importada e guardada neste navegador.");
      window.setTimeout(() => setBackupStatus(""), 4000);
    } catch {
      setBackupStatus("Não foi possível importar: ficheiro inválido ou danificado.");
    }
  }

  function updateAnalysis() {
    if (report && evidence.some((record) => record.fieldId === "res-acad" && record.validated) && triangulationRevisions["res-acad"] !== evidenceRevision(evidence, "res-acad")) {
      setAiTriangulationStatus("A atualização foi interrompida: a triangulação de 5.4.1 está desatualizada após alterações na Matriz.");
      setView("triangulacao");
      return;
    }
    setUpdating(true);
    const refreshedNarratives = preserveReviewedNarratives(evidence, narratives, indicatorApplicability);
    const refreshedReport = report ? buildReport(evidence, refreshedNarratives, indicatorApplicability) : report;
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
    window.localStorage.setItem("aee-piloto-v2", JSON.stringify({ schoolName, evidence, documentCandidates, statisticalRecords, statisticalTreatments, questionnaireComments, questionnaireReport, interviews, interviewCandidates, files, fileAnalysis, narratives: refreshedNarratives, triangulationRevisions, report: refreshedReport, conclusions, indicatorApplicability, lastUpdated: timestamp }));
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
      triangulationRevisions: {} as Record<string, string>,
      conclusions: [] as DomainConclusion[],
      indicatorApplicability: {} as Record<string, IndicatorApplicability>,
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
    setInterviewCandidates([]);
    setSelectedInterviewCandidates([]);
    setInterviewAnalysisStatus("");
    setFiles(emptyProcess.files);
    setFileAnalysis(emptyProcess.fileAnalysis);
    setPrivacyReviews([]);
    setPrivacyConfirmed([]);
    setPreparedDocuments([]);
    setReport(emptyProcess.report);
    setNarratives(emptyProcess.narratives);
    setTriangulationRevisions(emptyProcess.triangulationRevisions);
    setConclusions(emptyProcess.conclusions);
    setIndicatorApplicability(emptyProcess.indicatorApplicability);
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
        const review = privacyReview(file.name, chunks);
        setPrivacyReviews((current) => [...current.filter((item) => item.source !== file.name), review]);
        setPrivacyConfirmed((current) => current.filter((source) => source !== file.name));
        setDocumentCandidates((current) => current.filter((item) => item.source !== file.name));
        setFileAnalysis((current) => ({ ...current, [file.name]: { status: "Privacidade", extractedChars, candidates: 0, detail: `${review.findings.length} sinalizações · risco ${review.risk.toLocaleLowerCase("pt-PT")} · aguarda validação de privacidade.` } }));
        setView("privacidade");
      } catch (error) {
        setFileAnalysis((current) => ({ ...current, [file.name]: { status: "Erro", extractedChars: 0, candidates: 0, detail: error instanceof Error ? error.message : "Não foi possível ler o ficheiro." } }));
      }
    }
  }

  function updatePrivacyCategory(source: string, category: PrivacyCategory) {
    setPrivacyReviews((current) => current.map((review) => review.source === source ? { ...review, category } : review));
    setPrivacyConfirmed((current) => current.filter((item) => item !== source));
  }

  function approvePrivacy(source: string) {
    const review = privacyReviews.find((item) => item.source === source);
    if (!review || !privacyConfirmed.includes(source)) return;
    setPreparedDocuments((current) => [
      ...current.filter((item) => item.source !== source),
      { source, chunks: review.sanitizedChunks, status: "Pronto", message: "Texto minimizado validado e pronto para interpretação por IA." },
    ]);
    setDocumentCandidates((current) => current.filter((item) => item.source !== source));
    setFileAnalysis((current) => ({ ...current, [source]: { status: "Lido", extractedChars: review.sanitizedChunks.reduce((total, chunk) => total + chunk.text.length, 0), candidates: 0, detail: "Privacidade validada · aguarda análise documental por IA." } }));
    setPrivacyReviews((current) => current.filter((item) => item.source !== source));
    setPrivacyConfirmed((current) => current.filter((item) => item !== source));
    setChangesPending(true);
    if (privacyReviews.length === 1) setView("analise");
  }

  async function analyzePreparedDocument(source: string) {
    const document = preparedDocuments.find((item) => item.source === source);
    if (!document || document.status === "A analisar") return;

    // Segmentos maiores reduzem o número de chamadas. Não existe qualquer
    // consolidação posterior por IA: cada resposta gera evidências autónomas.
    const blocks = createAnalysisBlocks(document.chunks, 14_000, 0);
    setPreparedDocuments((current) => current.map((item) => item.source === source ? {
      ...item,
      status: "A analisar",
      message: `${blocks.length} segmento(s) · extração direta de evidências, sem consolidações…`,
    } : item));

    try {
      const collected: CandidateEvidence[] = [];
      for (let index = 0; index < blocks.length; index += 1) {
        const block = blocks[index];
        setPreparedDocuments((current) => current.map((item) => item.source === source ? {
          ...item,
          message: `Segmento ${index + 1} de ${blocks.length} · as evidências anteriores já estão preservadas…`,
        } : item));

        const response = await fetch("/api/analyze-document", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: source,
            location: block.label,
            text: block.text,
            indicators: fields.flatMap((field) => (indicatorLabels[field.id] ?? []).map((label, indicatorIndex) => ({
              id: indicatorId(field.id, indicatorIndex),
              field: field.name,
              label,
            }))),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
        const extracted = Array.isArray(payload?.evidence) ? payload.evidence : [];

        extracted.forEach((item: any) => {
          const claim = String(item?.afirmacao || "").trim();
          if (!claim) return;
          const field = fields.find((candidate) => normalizeText(candidate.name) === normalizeText(String(item?.campo || "")));
          if (!field) return;
          const location = String(item?.localizacao || block.label).trim();
          const reservation = String(item?.reserva || "").trim();
          const nature = String(item?.natureza || "").trim();
          const proposedIndicatorIds = (Array.isArray(item?.indicadores) ? item.indicadores : [])
            .map(String)
            .filter((id: string) => id.startsWith(`${field.id}:`) && (indicatorLabels[field.id] ?? []).some((_, indicatorIndex) => indicatorId(field.id, indicatorIndex) === id));
          const duplicate = collected.some((candidate) => candidate.fieldId === field.id && normalizeText(candidate.claim) === normalizeText(claim));
          if (duplicate) return;
          collected.push({
            id: Date.now() + collected.length,
            fieldId: field.id,
            claim,
            source,
            sourceType: "Documental",
            location,
            status: "Por triangular",
            strength: "Insuficiente",
            validated: false,
            indicatorIds: proposedIndicatorIds,
            matchedTerms: nature ? [nature] : [],
            analysis: reservation ? `${claim} Reserva: ${reservation}` : claim,
          });
        });

        // Ponto de recuperação imediato: mesmo que um segmento posterior falhe,
        // o trabalho pago até aqui fica disponível na interface e no autosave.
        setDocumentCandidates((current) => [
          ...current.filter((item) => item.source !== source),
          ...collected,
        ]);
        setFileAnalysis((current) => ({
          ...current,
          [source]: {
            ...(current[source] ?? { status: "Lido", extractedChars: 0, candidates: 0, detail: "" }),
            candidates: collected.length,
            detail: `${index + 1}/${blocks.length} segmento(s) concluído(s) · ${collected.length} evidência(s) preservada(s).`,
          },
        }));
      }

      if (!collected.length) throw new Error("Não foram identificadas evidências documentais materialmente relevantes.");
      setPreparedDocuments((current) => current.map((item) => item.source === source ? {
        ...item,
        status: "Concluído",
        message: `${collected.length} evidência(s) extraída(s) em ${blocks.length} chamada(s), sem consolidação paga.`,
      } : item));
      setChangesPending(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir a extração.";
      setPreparedDocuments((current) => current.map((item) => item.source === source ? {
        ...item,
        status: "Erro",
        message: `${message} As evidências dos segmentos já concluídos foram preservadas.`,
      } : item));
    }
  }

  function discardPrivacyReview(source: string) {
    setPrivacyReviews((current) => current.filter((item) => item.source !== source));
    setPrivacyConfirmed((current) => current.filter((item) => item !== source));
    setFiles((current) => current.filter((item) => item !== source));
    setFileAnalysis((current) => {
      const next = { ...current };
      delete next[source];
      return next;
    });
  }

  function toggleCandidate(id: number) {
    setSelectedCandidates((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllCandidates() {
    setSelectedCandidates(allCandidatesSelected ? [] : documentCandidates.map((candidate) => candidate.id));
  }

  function updateCandidateField(id: number, fieldId: string) {
    setDocumentCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, fieldId, indicatorIds: [] } : candidate));
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
      indicatorIds: candidate.indicatorIds ?? [],
    }));
    setEvidence((current) => [...current.filter((item) => !promoted.some((candidate) => candidate.id === item.id)), ...promoted]);
    setDocumentCandidates((current) => current.filter((candidate) => !selectedCandidates.includes(candidate.id)));
    setSelectedCandidates([]);
    setChangesPending(true);
    setView("evidencias");
  }

  function addStatisticalRecords(source: string, chunks: TextChunk[]) {
    const sourceKey = `local|${normalizeText(source)}`;
    const extracted = extractStatisticalRecords(source, chunks).map((record) => ({ ...record, dataset: "general" as const, sourceKey }));
    // Recarregar um ficheiro substitui apenas esse ficheiro. Não se volta a
    // validar nem a filtrar aqui os registos das restantes origens.
    setStatisticalRecords((current) => deduplicateStatisticalRecords([...current.filter((record) => (record.sourceKey || `local|${normalizeText(record.source)}`) !== sourceKey), ...extracted]));
    setStatisticalTreatments((current) => current.filter((treatment) => !(treatment.sourceKeys ?? []).includes(sourceKey) && !treatment.sources.includes(source)));
    setSelectedTreatmentIds((current) => current.filter((id) => !id.includes(sourceKey)));
    setSelectedStatisticalIds((current) => [...new Set([
      ...current.filter((id) => !statisticalRecords.some((record) => record.id === id && (record.sourceKey || `local|${normalizeText(record.source)}`) === sourceKey)),
      ...extracted.map((record) => record.id),
    ])]);
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
      const response = await fetch("/api/import-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.toString() }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || `Não foi possível ler o endereço (estado ${response.status}).`);
      }
      const contentType = response.headers.get("content-type") ?? "";
      const finalUrl = response.headers.get("x-source-url") || url.toString();
      const sourceUrl = new URL(finalUrl);
      const headerName = response.headers.get("x-source-filename");
      const fileName = headerName ? decodeURIComponent(headerName) : decodeURIComponent(sourceUrl.pathname.split("/").pop() || "InfoEscolas-online");
      if (contentType.includes("application/json")) {
        const payload = await response.json() as { kind?: string; school?: string; scopeLabel?: string; scopeCode?: string; scopeKey?: string; records?: Array<{ indicator?: string; value?: string; context?: string; location?: string; chartTitle?: string; period?: string; seriesRole?: "school" | "national" | "other"; evidenceUse?: "academic-comparison" | "context-only" }> };
        if (payload.kind !== "infoescolas" || !Array.isArray(payload.records)) throw new Error("O portal devolveu dados num formato não reconhecido.");
        const scopeLabel = payload.scopeLabel || "Oferta não identificada";
        const requestedLevel = url.searchParams.get("nivel") || sourceUrl.searchParams.get("nivel") || "";
        const scopeCode = payload.scopeCode || requestedLevel || scopeLabel;
        // A identidade não depende da chave devolvida pelo portal: para a mesma
        // escola e o mesmo ciclo/oferta é sempre igual, mesmo após redirects.
        const schoolKey = normalizeText(payload.school || sourceUrl.hostname);
        const sourceKey = `infoescolas|${schoolKey}|${String(scopeCode)}`;
        const source = `InfoEscolas · ${payload.school || sourceUrl.hostname} · ${scopeLabel}`;
        const extractedCandidates = payload.records.flatMap((item, index) => {
          const indicator = String(item.indicator ?? "").trim();
          const value = String(item.value ?? "").trim();
          const context = String(item.context ?? "").trim();
          if (!indicator || !value || !context || !isPlausibleStatisticalLabel(indicator) || looksLikeExecutableCode(indicator)) return [];
          return [{ id: Date.now() * 1000 + index, fieldId: "res-acad", indicator, value, context, source, location: String(item.location ?? finalUrl), dataset: "infoescolas", comparisonKey: String(item.chartTitle ?? indicator.split(" — ")[0]).trim(), period: String(item.period ?? "").trim(), seriesRole: item.seriesRole ?? "other", evidenceUse: item.evidenceUse ?? "context-only", sourceKey, sourceScope: scopeLabel, sourceScopeCode: scopeCode } satisfies StatisticalRecord];
        });
        const seenRecords = new Set<string>();
        const extracted = extractedCandidates.filter((record) => {
          const key = [normalizeText(record.comparisonKey || record.indicator), normalizeText(record.indicator), record.period, record.seriesRole, record.value].join("|");
          if (seenRecords.has(key)) return false;
          seenRecords.add(key);
          return true;
        });
        const sameSchool = (record: StatisticalRecord) => normalizeText(record.source).includes(schoolKey);
        const sameScope = (record: StatisticalRecord) => record.dataset === "infoescolas" && (
          record.sourceKey === sourceKey
          || (Boolean(scopeCode) && infoEscolasRecordScope(record) === String(scopeCode) && sameSchool(record))
        );
        // A segunda condição repara dados guardados pela v62 cuja chave ficou
        // errada devido a um redirecionamento: só substitui registos cujo próprio
        // indicador demonstra pertencer ao ciclo agora reimportado.
        setStatisticalRecords((current) => deduplicateStatisticalRecords([...current.filter((record) => !sameScope(record)), ...extracted]));
        setStatisticalTreatments((current) => current.filter((treatment) => !(treatment.sourceKeys ?? []).some((key) => key === sourceKey || (key.startsWith("infoescolas|") && key.endsWith(`|${String(scopeCode)}`) && normalizeText(treatment.sources.join(" ")).includes(schoolKey)))));
        // Todos os dados permanecem disponíveis para tratamento e consulta.
        // Só as comparações académicas serão pré-selecionadas para promoção.
        setSelectedStatisticalIds((current) => [...new Set([
          ...current.filter((id) => !statisticalRecords.some((record) => record.id === id && sameScope(record))),
          ...extracted.map((record) => record.id),
        ])]);
        setSelectedTreatmentIds((current) => current.filter((id) => !id.includes(sourceKey)));
        setChangesPending(true);
        setStatisticalStatus(extracted.length ? `${extracted.length} observações estatísticas de ${scopeLabel} acrescentadas. Os restantes ciclos/ofertas foram preservados.` : "A página da escola foi aberta, mas os gráficos não continham observações reconhecíveis.");
        return;
      }
      let chunks: TextChunk[];
      if (/pdf|spreadsheet|excel|csv/.test(contentType) || /\.(pdf|xlsx?|csv)$/i.test(fileName)) {
        chunks = await extractFile(new File([await response.blob()], fileName, { type: contentType }));
      } else {
        const html = await response.text();
        let text = html;
        if (contentType.includes("html")) {
          const document = new DOMParser().parseFromString(html, "text/html");
          document.querySelectorAll("script, style, noscript, template, svg, canvas").forEach((node) => node.remove());
          const root = document.querySelector("main, [role='main']") ?? document.body;
          root.querySelectorAll("img[alt], [aria-label], [title]").forEach((node) => {
            const label = node.getAttribute("alt") || node.getAttribute("aria-label") || node.getAttribute("title");
            if (label && !node.textContent?.trim()) node.append(` ${label} `);
          });
          root.querySelectorAll("tr").forEach((row) => {
            const cells = [...row.querySelectorAll(":scope > th, :scope > td")].map((cell) => cell.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
            if (cells.length) row.replaceChildren(document.createTextNode(cells.join("\t")));
            row.append("\n");
          });
          root.querySelectorAll("br, p, li, h1, h2, h3, h4, h5, h6, section, article, option").forEach((node) => node.append("\n"));
          text = root.textContent ?? "";
        }
        const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
        if (cleaned.length < 40) throw new Error("A página foi aberta, mas não devolveu dados legíveis. Pode depender de conteúdo gerado dinamicamente ou de uma sessão.");
        chunks = [{ text: cleaned, location: finalUrl }];
      }
      if (!chunks.length) throw new Error("O recurso foi aberto, mas não contém texto ou dados legíveis.");
      const count = addStatisticalRecords(sourceUrl.hostname, chunks);
      setStatisticalStatus(count > 0 ? `${count} registos identificados em ${sourceUrl.hostname}.` : `O endereço foi lido, mas não foram reconhecidos registos estatísticos. Reveja o conteúdo ou carregue o ficheiro original.`);
    } catch (error) {
      setStatisticalStatus(error instanceof Error ? error.message : "Não foi possível carregar o endereço público.");
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
    const workspaceIds = new Set(workspaceStatisticalRecords.map((record) => record.id));
    setSelectedStatisticalIds((current) => allStatisticalSelected
      ? current.filter((id) => !workspaceIds.has(id))
      : [...new Set([...current, ...workspaceIds])]);
  }

  function deleteSelectedStatisticalSources() {
    const selected = statisticalRecords.filter((record) => selectedStatisticalIds.includes(record.id));
    if (!selected.length) return;
    const sourceKeys = new Set(selected.map((record) => record.sourceKey || `${record.dataset || "general"}|${normalizeText(record.source)}`));
    const recordsToDelete = statisticalRecords.filter((record) => sourceKeys.has(record.sourceKey || `${record.dataset || "general"}|${normalizeText(record.source)}`));
    const recordIds = new Set(recordsToDelete.map((record) => record.id));
    const treatmentsToDelete = statisticalTreatments.filter((treatment) =>
      treatment.recordIds.some((id) => recordIds.has(id)) ||
      (treatment.sourceKeys ?? []).some((key) => sourceKeys.has(key))
    );
    const treatmentIds = new Set(treatmentsToDelete.map((treatment) => treatment.id));
    const affectedFields = new Set(treatmentsToDelete.map((treatment) => treatment.fieldId));
    const sourceNames = [...new Set(recordsToDelete.map((record) => record.dataset === "infoescolas" && record.sourceScope ? `${record.sourceScope} — ${record.source}` : record.source))];
    const confirmed = window.confirm(`Eliminar definitivamente ${sourceNames.length} origem(ns)?\n\n${sourceNames.join("\n")}\n\nSerão também removidos os tratamentos, as evidências estatísticas associadas e as conclusões já produzidas a partir destes dados. O Relatório terá de ser gerado novamente.`);
    if (!confirmed) return;

    setStatisticalRecords((current) => current.filter((record) => !recordIds.has(record.id)));
    setStatisticalTreatments((current) => current.filter((treatment) => !treatmentIds.has(treatment.id)));
    setEvidence((current) => current.filter((item) => !item.statisticalTreatmentId || !treatmentIds.has(item.statisticalTreatmentId)));
    setSelectedStatisticalIds([]);
    setSelectedTreatmentIds((current) => current.filter((id) => !treatmentIds.has(id)));
    setNarratives((current) => Object.fromEntries(Object.entries(current).filter(([fieldId]) => !affectedFields.has(fieldId))));
    setTriangulationRevisions((current) => Object.fromEntries(Object.entries(current).filter(([fieldId]) => !affectedFields.has(fieldId))));
    setReport("");
    setConclusions([]);
    setAiTriangulationStatus("Os dados selecionados e toda a cadeia estatística associada foram eliminados. Repita a triangulação dos campos afetados e gere novamente o Relatório.");
    setStatisticalStatus(`${recordsToDelete.length} registo(s), ${treatmentsToDelete.length} tratamento(s) e as respetivas evidências foram eliminados definitivamente.`);
    setChangesPending(true);
  }

  function treatStatisticalData(dataset?: "general" | "infoescolas") {
    const available = dataset ? statisticalRecords.filter((record) => (record.dataset || "general") === dataset) : statisticalRecords;
    const selectedInScope = available.filter((record) => selectedStatisticalIds.includes(record.id));
    const chosen = selectedInScope.length ? selectedInScope : available;
    const base = chosen.filter(validStatisticalRecord);
    const rejected = chosen.length - base.length;
    // O tratamento pode ignorar uma linha não interpretável, mas nunca apaga os
    // dados de origem. O utilizador pode revê-los ou voltar a carregá-los.
    const treatments = buildStatisticalTreatments(base);
    const treatmentIds = new Set(treatments.map((treatment) => treatment.id));
    setStatisticalTreatments((current) => deduplicateStatisticalTreatments([...current.filter((treatment) => !treatmentIds.has(treatment.id)), ...treatments]));
    setSelectedTreatmentIds((current) => [...new Set([...current.filter((id) => !treatmentIds.has(id)), ...treatments.filter((treatment) => treatment.evidenceUse !== "context-only").map((treatment) => treatment.id)])]);
    const scopeLabel = dataset === "general" ? "ficheiros locais" : dataset === "infoescolas" ? "InfoEscolas" : "todas as fontes";
    setStatisticalStatus(`${treatments.length} síntese(s) de ${scopeLabel} produzida(s) a partir de ${base.length} registo(s). Os tratamentos e dados das restantes fontes foram preservados.${rejected ? ` ${rejected} linha(s) sem estrutura estatística interpretável foram ignoradas no tratamento, mas permanecem nos dados de origem.` : ""}`);
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
    const workspaceIds = new Set(workspacePromotableTreatments.map((treatment) => treatment.id));
    setSelectedTreatmentIds((current) => allTreatmentsSelected
      ? current.filter((id) => !workspaceIds.has(id))
      : [...new Set([...current, ...workspaceIds])]);
  }

  function matrixStateForTreatment(treatment: StatisticalTreatment) {
    const matrixRecord = evidence.find((record) => record.statisticalTreatmentId === treatment.id);
    if (!matrixRecord) return "Por enviar";
    const expectedLocation = `${treatment.recordIds.length} registos · ${treatment.sources.join("; ")}`;
    return matrixRecord.claim === treatment.summary && matrixRecord.fieldId === treatment.fieldId && matrixRecord.location === expectedLocation
      ? "Na Matriz"
      : "Alterado após envio";
  }

  function promoteStatisticalTreatments() {
    const selected = workspacePromotableTreatments.filter((treatment) => selectedTreatmentIds.includes(treatment.id));
    if (!selected.length) return;
    const promoted: Evidence[] = selected.map((treatment, index) => ({
      id: Date.now() + index,
      fieldId: treatment.fieldId,
      claim: treatment.summary,
      source: `Tratamento estatístico — ${treatment.recordIds.some((id) => recordDatasetById.get(id) === "infoescolas") ? "InfoEscolas" : "Ficheiro local"} — ${getField(treatment.fieldId).name}`,
      sourceType: "Quantitativa",
      location: `${treatment.recordIds.length} registos · ${treatment.sources.join("; ")}`,
      status: "Confirmada",
      strength: "Insuficiente",
      validated: true,
      indicatorIds: treatment.id.startsWith("infoescolas|") ? indicatorIdsForInfoEscolasTreatment(treatment) : [],
      statisticalTreatmentId: treatment.id,
    }));
    const promotedIds = new Set(promoted.map((record) => record.statisticalTreatmentId));
    const promotedFields = new Set(promoted.map((record) => record.fieldId));
    setEvidence((current) => [...current.filter((item) => {
      if (item.statisticalTreatmentId && promotedIds.has(item.statisticalTreatmentId)) return false;
      if (!item.statisticalTreatmentId && promotedFields.has(item.fieldId) && item.source.startsWith("Tratamento estatístico —")) return false;
      return true;
    }), ...promoted]);
    setTriangulationRevisions((current) => {
      const next = { ...current };
      selected.forEach((treatment) => { delete next[treatment.fieldId]; });
      return next;
    });
    if (selected.some((treatment) => treatment.fieldId === "res-acad")) {
      setAiTriangulationStatus("Foram acrescentadas ou atualizadas evidências estatísticas em 5.4.1. A triangulação anterior está desatualizada e deve ser repetida antes do Relatório.");
    }
    setChangesPending(true);
    setStatisticalStatus(`${promoted.length} tratamento(s) enviado(s) para a Matriz de evidências. A triangulação só os utilizará enquanto evidências validadas na Matriz.`);
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

  async function analyzeInterviewNotes() {
    const text = interviewText.trim();
    if (text.length < 40 || interviewAnalyzing) {
      setInterviewAnalysisStatus(text.length < 40 ? "Introduza um relato suficientemente desenvolvido antes de iniciar a análise." : "");
      return;
    }
    setInterviewAnalyzing(true);
    setInterviewAnalysisStatus("A extrair evidências testemunhais numa única chamada, sem consolidações…");
    try {
      const response = await fetch("/api/analyze-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ panel: interviewPanel, text }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      const proposals = Array.isArray(payload?.evidence) ? payload.evidence : [];
      const generated: InterviewCandidate[] = proposals
        .filter((item: any) => typeof item.afirmacao === "string" && item.afirmacao.trim())
        .map((item: any, index: number) => {
          const field = fields.find((candidate) => normalizeText(candidate.name) === normalizeText(item.campo ?? "")) ?? fields[0];
          return {
            id: Date.now() + index,
            panel: interviewPanel,
            fieldId: field.id,
            synthesis: item.afirmacao.trim(),
            location: typeof item.localizacao === "string" && item.localizacao.trim() ? item.localizacao.trim() : "relato de entrevista",
            nature: ["perceção", "prática relatada", "resultado referido", "impacto alegado"].includes(item.natureza) ? item.natureza : "perceção",
            support: [],
            reservations: typeof item.reserva === "string" && item.reserva.trim() ? [item.reserva.trim()] : [],
            questions: [],
          };
        });
      if (!generated.length) throw new Error("O relato não contém informação suficientemente sustentada para produzir sínteses por campo.");
      setInterviewCandidates(generated);
      setSelectedInterviewCandidates(generated.map((item) => item.id));
      setInterviewAnalysisStatus(`${generated.length} evidência(s) testemunhal(is) extraída(s) numa única chamada. Reveja antes de promover.`);
      setChangesPending(true);
    } catch (error) {
      setInterviewAnalysisStatus(error instanceof Error ? error.message : "Não foi possível analisar o relato da entrevista.");
    } finally {
      setInterviewAnalyzing(false);
    }
  }

  function toggleInterviewCandidate(id: number) {
    setSelectedInterviewCandidates((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllInterviewCandidates() {
    const allSelected = interviewCandidates.length > 0 && interviewCandidates.every((item) => selectedInterviewCandidates.includes(item.id));
    setSelectedInterviewCandidates(allSelected ? [] : interviewCandidates.map((item) => item.id));
  }

  function updateInterviewCandidate(id: number, changes: Partial<InterviewCandidate>) {
    setInterviewCandidates((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
    setChangesPending(true);
  }

  function promoteInterviewCandidates() {
    const selected = interviewCandidates.filter((item) => selectedInterviewCandidates.includes(item.id));
    if (!selected.length) return;
    setInterviews((current) => [...current, ...selected.map((item) => ({ id: item.id, panel: item.panel, fieldId: item.fieldId, summary: item.synthesis }))]);
    setEvidence((current) => [...current, ...selected.map((item): Evidence => ({
      id: item.id,
      fieldId: item.fieldId,
      claim: item.synthesis,
      source: `Painel — ${item.panel}`,
      sourceType: "Testemunhal",
      location: `${item.location} · ${item.nature} · validação humana`,
      status: "Por triangular",
      strength: "Insuficiente",
      validated: true,
    }))]);
    setInterviewCandidates((current) => current.filter((item) => !selectedInterviewCandidates.includes(item.id)));
    setSelectedInterviewCandidates([]);
    setInterviewText("");
    setInterviewAnalysisStatus(`${selected.length} síntese(s) validada(s) e enviadas para as Evidências.`);
    setChangesPending(true);
    setView("evidencias");
  }

  function generateReport() {
    const completedNarratives = preserveReviewedNarratives(evidence, narratives, indicatorApplicability);
    const comparisons = requiredAcademicComparisons(evidence);
    if (evidence.some((record) => record.fieldId === "res-acad" && record.validated) && triangulationRevisions["res-acad"] !== evidenceRevision(evidence, "res-acad")) {
      setAiTriangulationStatus("A triangulação de 5.4.1 está desatualizada porque a Matriz recebeu novas evidências. Repita a triangulação antes de gerar o Relatório.");
      setView("triangulacao");
      return;
    }
    if (comparisons.some((comparison) => !containsAcademicComparison(narratives["res-acad"] || "", comparison))) {
      setAiTriangulationStatus("As análises comparadas de 5.4.1 já estão na Matriz, mas ainda não constam da narrativa triangulada. Execute a triangulação antes de gerar o Relatório.");
      setView("triangulacao");
      return;
    }
    setNarratives(completedNarratives);
    setReport(buildReport(evidence, completedNarratives, indicatorApplicability));
    setView("relatorio");
  }

  function refreshNarratives() {
    setNarratives(buildNarratives(evidence, indicatorApplicability));
    setChangesPending(true);
  }

  async function suggestIndicatorsWithAi() {
    const selectedFields = indicatorFieldId === "all" ? fields : [getField(indicatorFieldId)];
    const selectedFieldIds = new Set(selectedFields.map((field) => field.id));
    const records = evidence.filter((record) => selectedFieldIds.has(record.fieldId) && record.validated);
    if (!records.length) {
      setIndicatorSuggestionStatus("Não existem evidências validadas no âmbito selecionado.");
      return;
    }
    if (records.length > 160) {
      setIndicatorSuggestionStatus(`Existem ${records.length} evidências validadas. Para evitar uma análise global incompleta, selecione os campos individualmente e faça a associação por partes.`);
      return;
    }
    const scope = indicatorFieldId === "all" ? `os ${selectedFields.length} campos` : `o campo ${selectedFields[0].section}`;
    if (!window.confirm(`Esta operação utiliza IA e faz uma única chamada à API para propor indicadores para ${records.length} evidência(s) de ${scope}. As propostas só contam para a cobertura depois da sua confirmação. Pretende continuar?`)) return;
    setAiSuggestingIndicators(true);
    setIndicatorSuggestionStatus(`Associação assistida para ${scope} em curso · 1 chamada…`);
    setIndicatorSuggestions([]);
    setIndicatorDrafts({});
    try {
      const indicators = selectedFields.flatMap((field) => (indicatorLabels[field.id] ?? []).map((label, index) => ({
        id: indicatorId(field.id, index), fieldId: field.id, label,
        applicability: indicatorApplicability[indicatorId(field.id, index)] ?? "Aplicável",
      })));
      const response = await fetch("/api/suggest-indicators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: selectedFields, evidence: records, indicators }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      const allowedIds = new Set(indicators.filter((item) => item.applicability !== "Não aplicável").map((item) => item.id));
      const recordIds = new Set(records.map((item) => item.id));
      const suggestions: IndicatorSuggestion[] = (Array.isArray(payload?.suggestions) ? payload.suggestions : [])
        .filter((item: any) => recordIds.has(Number(item?.evidenceId)) && allowedIds.has(String(item?.indicatorId)))
        .map((item: any) => ({
          evidenceId: Number(item.evidenceId),
          indicatorId: String(item.indicatorId),
          justification: String(item.justification || "").trim(),
          confidence: item.confidence === "Alta" ? "Alta" : "Média",
        }));
      const drafts = Object.fromEntries(records.map((record) => {
        const proposed = suggestions.filter((item) => item.evidenceId === record.id).map((item) => item.indicatorId);
        return [record.id, Array.from(new Set([...(record.indicatorIds ?? []), ...proposed]))];
      }));
      setIndicatorSuggestions(suggestions);
      setIndicatorDrafts(drafts);
      setIndicatorSuggestionStatus(`A IA propôs ${suggestions.length} associação(ões) em ${scope}. Reveja, acrescente ou retire indicadores antes de confirmar.`);
    } catch (error) {
      setIndicatorSuggestionStatus(`${error instanceof Error ? error.message : "Não foi possível propor indicadores."} Não foi feita repetição automática paga.`);
    } finally {
      setAiSuggestingIndicators(false);
    }
  }

  function toggleIndicatorDraft(evidenceId: number, id: string) {
    setIndicatorDrafts((current) => {
      const linked = current[evidenceId] ?? [];
      return { ...current, [evidenceId]: linked.includes(id) ? linked.filter((value) => value !== id) : [...linked, id] };
    });
  }

  function confirmIndicatorDrafts() {
    const ids = new Set(Object.keys(indicatorDrafts).map(Number));
    if (!ids.size) return;
    setEvidence((current) => current.map((record) => ids.has(record.id) ? { ...record, indicatorIds: indicatorDrafts[record.id] ?? [] } : record));
    setChangesPending(true);
    setIndicatorSuggestionStatus("Associações confirmadas pela equipa e contabilizadas na cobertura.");
    setIndicatorSuggestions([]);
    setIndicatorDrafts({});
  }

  async function triangulateFieldWithAi(field: Field) {
    const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
    if (!records.length) {
      setAiTriangulationStatus(`${field.section}: não existem evidências validadas para triangular.`);
      return;
    }
    if (!window.confirm(`Esta operação utiliza IA e faz 1 chamada à API para o campo ${field.section}. Pretende continuar?`)) return;
    setAiTriangulatingField(field.id);
    setAiTriangulationStatus(`${field.section}: triangulação por IA em curso · 1 chamada…`);
    try {
      const response = await fetch("/api/triangulate-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, evidence: records, diagnostic: fieldDiagnostic(field, records, indicatorApplicability), mandatoryAcademicComparisons: field.id === "res-acad" ? requiredAcademicComparisons(records) : [] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      const narrative = ensureAcademicComparisonsInNarrative(String(payload?.narrative || "").trim(), field.id === "res-acad" ? requiredAcademicComparisons(records) : []);
      if (!narrative) throw new Error("A IA não devolveu uma narrativa utilizável.");
      setNarratives((current) => ({ ...current, [field.id]: narrative }));
      setTriangulationRevisions((current) => ({ ...current, [field.id]: evidenceRevision(evidence, field.id) }));
      setChangesPending(true);
      setAiTriangulationStatus(`${field.section}: triangulação concluída numa chamada. Reveja e valide o texto.`);
    } catch (error) {
      setAiTriangulationStatus(`${field.section}: ${error instanceof Error ? error.message : "Não foi possível triangular."} Não foi feita repetição automática paga.`);
    } finally {
      setAiTriangulatingField("");
    }
  }

  async function triangulateAllWithAi() {
    const records = evidence.filter((record) => record.validated);
    const activeFields = fields.filter((field) => records.some((record) => record.fieldId === field.id));
    if (!records.length) {
      setAiTriangulationStatus("Não existem evidências validadas para triangular.");
      return;
    }
    if (records.length > 180) {
      setAiTriangulationStatus(`Existem ${records.length} evidências validadas. Para evitar truncagem, use a triangulação por campo nos casos que necessitem de revisão.`);
      return;
    }
    if (!window.confirm(`Esta operação utiliza IA e faz uma única chamada para triangular ${records.length} evidência(s) em ${activeFields.length} campo(s). As narrativas atuais desses campos serão substituídas, mas continuarão editáveis. Pretende continuar?`)) return;
    setAiTriangulatingAll(true);
    setAiTriangulationStatus(`Triangulação global de ${activeFields.length} campo(s) em curso · 1 chamada…`);
    try {
      const response = await fetch("/api/triangulate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: activeFields, evidence: records, diagnostics: Object.fromEntries(activeFields.map((field) => [field.id, fieldDiagnostic(field, records.filter((record) => record.fieldId === field.id), indicatorApplicability)])), mandatoryAcademicComparisons: requiredAcademicComparisons(records) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      const received = Array.isArray(payload?.narratives) ? payload.narratives : [];
      const usable = received.filter((item: any) => activeFields.some((field) => field.id === String(item?.fieldId)) && String(item?.narrative || "").trim());
      if (!usable.length) throw new Error("A IA não devolveu narrativas utilizáveis.");
      setNarratives((current) => ({
        ...current,
        ...Object.fromEntries(usable.map((item: any) => {
          const fieldId = String(item.fieldId);
          const value = String(item.narrative).trim();
          return [fieldId, fieldId === "res-acad" ? ensureAcademicComparisonsInNarrative(value, requiredAcademicComparisons(records)) : value];
        })),
      }));
      setTriangulationRevisions((current) => ({
        ...current,
        ...Object.fromEntries(usable.map((item: any) => [String(item.fieldId), evidenceRevision(evidence, String(item.fieldId))])),
      }));
      setChangesPending(true);
      const missing = activeFields.length - usable.length;
      setAiTriangulationStatus(missing
        ? `Foram concluídos ${usable.length} de ${activeFields.length} campos numa chamada. Reveja os ${missing} campo(s) em falta individualmente.`
        : `${usable.length} campos triangulados numa única chamada. Reveja e valide as narrativas.`);
    } catch (error) {
      setAiTriangulationStatus(`${error instanceof Error ? error.message : "Não foi possível triangular globalmente."} As narrativas existentes foram preservadas e não houve repetição automática paga.`);
    } finally {
      setAiTriangulatingAll(false);
    }
  }

  async function improveReportWithAi() {
    const completedNarratives = preserveReviewedNarratives(evidence, narratives, indicatorApplicability);
    const comparisons = requiredAcademicComparisons(evidence);
    if (evidence.some((record) => record.fieldId === "res-acad" && record.validated) && triangulationRevisions["res-acad"] !== evidenceRevision(evidence, "res-acad")) {
      setExportStatus("O relatório não foi aprimorado: a triangulação de 5.4.1 está desatualizada após a entrada de novas evidências.");
      setView("triangulacao");
      return;
    }
    if (comparisons.some((comparison) => !containsAcademicComparison(narratives["res-acad"] || "", comparison))) {
      setExportStatus("O relatório não foi aprimorado: as análises estatísticas de 5.4.1 têm de passar primeiro pela triangulação.");
      setView("triangulacao");
      return;
    }
    const localDraft = ensureAcademicComparisonsInReport(report.trim() || buildReport(evidence, completedNarratives, indicatorApplicability), comparisons);
    const usable = fields.filter((field) => completedNarratives[field.id]?.trim()).map((field) => ({
      section: field.section, domain: field.domain, name: field.name, narrative: completedNarratives[field.id].trim(),
      diagnostic: fieldDiagnostic(field, evidence.filter((record) => record.fieldId === field.id && record.validated), indicatorApplicability),
    }));
    if (!usable.length) {
      setExportStatus("Valide e reveja primeiro as narrativas da triangulação.");
      return;
    }
    if (!window.confirm("Esta operação utiliza IA e faz 1 chamada à API para aprimorar a redação integral do relatório. Pretende continuar?")) return;
    setAiReportWriting(true);
    setExportStatus("Aprimoramento do relatório por IA em curso · 1 chamada…");
    try {
      const response = await fetch("/api/write-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, narratives: usable, localDraft, mandatoryAcademicComparisons: comparisons }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      const improved = ensureAcademicComparisonsInReport(String(payload?.report || "").trim(), comparisons);
      if (!improved) throw new Error("A IA não devolveu um relatório utilizável.");
      setReport(improved);
      setChangesPending(true);
      setExportStatus("Relatório aprimorado numa chamada. A validação humana continua obrigatória.");
    } catch (error) {
      setReport(localDraft);
      setExportStatus(`${error instanceof Error ? error.message : "Não foi possível aprimorar o relatório."} A minuta local foi preservada e não houve repetição automática paga.`);
    } finally {
      setAiReportWriting(false);
    }
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
    const selectedHere = workspaceStatisticalTreatments.filter((item) => selectedTreatmentIds.includes(item.id));
    const treatments = selectedHere.length ? selectedHere : workspaceStatisticalTreatments;
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

  function generateConclusions() {
    const completedNarratives = preserveReviewedNarratives(evidence, narratives, indicatorApplicability);
    setNarratives(completedNarratives);
    setConclusions(localDomainConclusions(completedNarratives, evidence));
    setConclusionsStatus("Proposta local gerada sem utilização da API. Reveja todos os enunciados e menções.");
    setChangesPending(true);
    setView("conclusoes");
  }

  function updateConclusion(domain: string, changes: Partial<DomainConclusion>) {
    setConclusions((current) => current.map((item) => item.domain === domain ? { ...item, ...changes } : item));
    setChangesPending(true);
  }

  async function improveConclusionsWithAi() {
    const completedNarratives = preserveReviewedNarratives(evidence, narratives, indicatorApplicability);
    const base = conclusions.length ? conclusions : localDomainConclusions(completedNarratives, evidence);
    const payloadDomains = domainOrder.map((domain) => ({
      domain,
      fields: fields.filter((field) => field.domain === domain).map((field) => ({ section: field.section, name: field.name, narrative: completedNarratives[field.id] || "" })),
      evidenceProfile: fields.filter((field) => field.domain === domain).map((field) => {
        const records = evidence.filter((record) => record.validated && record.fieldId === field.id);
        return { section: field.section, count: records.length, strength: strengthFor(records), sourceTypes: [...new Set(records.map((record) => record.sourceType))] };
      }),
      currentProposal: base.find((item) => item.domain === domain),
    }));
    if (!payloadDomains.some((item) => item.fields.some((field) => field.narrative.trim()))) {
      setConclusionsStatus("Ainda não existem narrativas trianguladas suficientes para formular conclusões.");
      return;
    }
    if (!window.confirm("Esta operação utiliza IA e faz 1 chamada à API para rever os Pontos Fortes, as Áreas de Melhoria e propor as quatro menções. Pretende continuar?")) return;
    setAiConclusionsWriting(true);
    setConclusionsStatus("Revisão por IA em curso · 1 chamada…");
    try {
      const response = await fetch("/api/write-conclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, domains: payloadDomains }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) throw new Error(payload?.error || `O servidor devolveu o estado ${response.status}.`);
      if (!Array.isArray(payload?.conclusions) || payload.conclusions.length !== domainOrder.length) throw new Error("A IA não devolveu os quatro domínios esperados.");
      setConclusions(payload.conclusions);
      setChangesPending(true);
      setConclusionsStatus("Proposta revista numa única chamada. Confirme a consistência com o relatório antes de validar.");
    } catch (error) {
      setConclusions(base);
      setConclusionsStatus(`${error instanceof Error ? error.message : "Não foi possível rever as conclusões."} A proposta existente foi preservada e não houve repetição automática paga.`);
    } finally {
      setAiConclusionsWriting(false);
    }
  }

  function exportConclusionsWord() {
    if (!conclusions.length) return;
    openExportCenter(conclusionsExport(conclusions), "classificacoes-pontos-fortes-areas-melhoria-aee", "docx", setConclusionsStatus);
  }

  const nav: { id: View; label: string; step: string }[] = [
    { id: "visao", label: "Visão geral", step: "00" },
    { id: "documentos", label: "Documentos", step: "01" },
    { id: "privacidade", label: "Privacidade", step: "02" },
    { id: "analise", label: "Análise documental", step: "03" },
    { id: "estatistica", label: "Análise estatística", step: "04" },
    { id: "evidencias", label: "Evidências", step: "05" },
    { id: "entrevistas", label: "Entrevistas", step: "06" },
    { id: "triangulacao", label: "Triangulação", step: "07" },
    { id: "relatorio", label: "Relatório", step: "08" },
    { id: "conclusoes", label: "Pontos fortes e melhoria", step: "09" },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">AEE</span>
          <div><strong>Plataforma de análise</strong><small>Piloto privado · dados fictícios</small></div>
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
            <button className="button secondary" onClick={exportBackup}>Exportar cópia</button>
            <label className="button secondary" htmlFor="import-backup">Importar cópia</label>
            <input id="import-backup" type="file" accept="application/json,.json" onChange={importBackup} hidden />
            <button className="button danger-ghost" onClick={() => setShowResetConfirm(true)}>Novo processo</button>
          </div>
        </header>

        {backupStatus && <div className="statistics-status" role="status">{backupStatus}</div>}

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
              <div className="action-row"><button className="button primary" onClick={() => setView(privacyReviews.length ? "privacidade" : documentCandidates.length ? "analise" : "evidencias")}>{privacyReviews.length ? "Validar privacidade" : documentCandidates.length ? "Rever análise documental" : "Abrir matriz de evidências"}</button><button className="button ghost" onClick={generateReport}>Gerar minuta</button></div>
            </div>
            <div className="progress-panel">
              <span className="progress-value">{Math.round(indicatorCoverage)}%</span>
              <strong>Cobertura dos indicadores</strong>
              <div className="progress-track"><span style={{ width: `${indicatorCoverage}%` }} /></div>
              <small>{coveredIndicatorIds.size} de {applicableIndicatorIds.length} indicadores aplicáveis com evidência</small>
            </div>
          </div>

          <div className="metrics clean-metrics">
            <article><span>Cobertura</span><strong>{Math.round(indicatorCoverage)}%</strong><small>{coveredIndicatorIds.size}/{applicableIndicatorIds.length} indicadores</small></article>
            <article><span>Diversidade</span><strong>{sourceTypeCount}/4</strong><small>tipos de fonte validados</small></article>
            <article><span>Evidências</span><strong>{validatedCount}</strong><small>{evidence.length} registos no total</small></article>
            <article className={pendingCount ? "warning" : ""}><span>Por validar</span><strong>{pendingCount}</strong><small>propostas que ainda não são evidência validada</small></article>
          </div>

          {pendingCount > 0 && <section className="ethics-panel" aria-labelledby="pending-title">
            <div className="ethics-intro">
              <p className="eyebrow">Trabalho por concluir</p>
              <h3 id="pending-title">O que falta validar</h3>
              <p>Estes itens não entram na triangulação nem na cobertura. Só passam a evidência depois de revistos e promovidos para a Matriz.</p>
            </div>
            <ul>
              <li><strong>{pendingBreakdown.privacy} · Privacidade</strong><span>Rever e autorizar o texto antes da análise documental.</span>{pendingBreakdown.privacy > 0 && <button className="text-button" onClick={() => setView("privacidade")}>Abrir</button>}</li>
              <li><strong>{pendingBreakdown.documents} · Propostas documentais</strong><span>Confirmar afirmação, localização, campo e indicadores; depois validar e promover.</span>{pendingBreakdown.documents > 0 && <button className="text-button" onClick={() => setView("analise")}>Abrir</button>}</li>
              <li><strong>{pendingBreakdown.interviews} · Propostas testemunhais</strong><span>Rever a síntese e as reservas; depois validar e enviar para a Matriz.</span>{pendingBreakdown.interviews > 0 && <button className="text-button" onClick={() => setView("entrevistas")}>Abrir</button>}</li>
              <li><strong>{pendingBreakdown.evidence} · Registos da Matriz</strong><span>Confirmar ou eliminar os registos ainda não validados.</span>{pendingBreakdown.evidence > 0 && <button className="text-button" onClick={() => setView("evidencias")}>Abrir</button>}</li>
            </ul>
          </section>}

          <section className="ethics-panel" aria-labelledby="ethics-title">
            <div className="ethics-intro">
              <p className="eyebrow">Utilização responsável</p>
              <h3 id="ethics-title">Princípios éticos</h3>
              <p>Instrumento de apoio à análise. O juízo avaliativo e a decisão permanecem sob responsabilidade da equipa.</p>
            </div>
            <ul>
              <li><strong>Proteger</strong><span>Minimizar e anonimizar dados pessoais e sensíveis.</span></li>
              <li><strong>Validar</strong><span>Confirmar fontes, interpretações e conclusões antes de as utilizar.</span></li>
              <li><strong>Contextualizar</strong><span>Considerar contradições, limites, diversidade e possíveis enviesamentos.</span></li>
              <li><strong>Responsabilizar</strong><span>Não automatizar juízos nem decisões sobre pessoas ou escolas.</span></li>
            </ul>
          </section>

          <div className="section-heading"><div><p className="eyebrow">Estrutura oficial</p><h3>Cobertura por domínio</h3></div><span className="source-note">Referencial AEE · 3.º ciclo</span></div>
          <div className="domain-grid">
            {domainOrder.map((domain, index) => {
              const domainFields = fields.filter((field) => field.domain === domain);
              const covered = domainFields.filter((field) => evidence.some((record) => record.fieldId === field.id && record.validated)).length;
              return <article key={domain} className={`domain-card tone-${index + 1}`}>
                <span className="domain-number">0{index + 1}</span>
                <h4>{domain}</h4>
                {(() => {
                  const domainApplicable = domainFields.flatMap((field) => (indicatorLabels[field.id] ?? []).map((_, indicatorIndex) => indicatorId(field.id, indicatorIndex)))
                    .filter((id) => indicatorApplicability[id] !== "Não aplicável");
                  const domainCovered = new Set(evidence.filter((record) => record.validated && domainFields.some((field) => field.id === record.fieldId))
                    .flatMap((record) => record.indicatorIds ?? []).filter((id) => domainApplicable.includes(id)));
                  const percentage = domainApplicable.length ? (domainCovered.size / domainApplicable.length) * 100 : 0;
                  return <><p><strong>{Math.round(percentage)}%</strong> · {domainCovered.size}/{domainApplicable.length} indicadores</p><div className="mini-track"><span style={{ width: `${percentage}%` }} /></div></>;
                })()}
                <details><summary>{covered}/{domainFields.length} campos com evidência</summary><ul>{domainFields.map((field) => <li key={field.id}>{field.section} · {field.name}</li>)}</ul></details>
              </article>;
            })}
          </div>
          <div className="section-heading field-coverage-heading"><div><p className="eyebrow">Leitura detalhada</p><h3>Cobertura por campo de análise</h3><p>A percentagem representa os indicadores aplicáveis com pelo menos uma evidência validada e associada. A diversidade das fontes é apresentada separadamente.</p></div><span className="source-note">Indicadores do Quadro de Referência</span></div>
          <div className="field-coverage-grid">
            {fields.map((field) => {
              const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
              const sourceTypes = new Set(records.map((record) => record.sourceType));
              const labels = indicatorLabels[field.id] ?? [];
              const applicableIds = labels.map((_, index) => indicatorId(field.id, index)).filter((id) => indicatorApplicability[id] !== "Não aplicável");
              const coveredIds = new Set(records.flatMap((record) => record.indicatorIds ?? []).filter((id) => applicableIds.includes(id)));
              const coverage = applicableIds.length ? (coveredIds.size / applicableIds.length) * 100 : 0;
              return <article className="field-coverage-card" key={field.id}>
                <div className="field-coverage-top"><span>{field.section}</span><strong>{Math.round(coverage)}%</strong></div>
                <h4>{field.name}</h4>
                <small>{field.domain}</small>
                <div className="field-track" aria-label={`${Math.round(coverage)}% de cobertura`}><span style={{ width: `${coverage}%` }} /></div>
                <div className="field-coverage-meta"><span>{coveredIds.size}/{applicableIds.length} indicadores com evidência</span><span>{sourceTypes.size}/4 tipos de fonte</span></div>
                <details className="indicator-coverage-detail"><summary>Rever aplicabilidade dos indicadores</summary>
                  <div className="indicator-coverage-list">{labels.map((label, index) => {
                    const id = indicatorId(field.id, index);
                    const linked = coveredIds.has(id);
                    const applicability = indicatorApplicability[id] ?? "Aplicável";
                    return <label key={id}><span><strong>{linked ? "Com evidência" : applicability === "Não aplicável" ? "Não aplicável" : applicability === "Por confirmar" ? "Por confirmar" : "Sem evidência"}</strong>{label}</span><select value={applicability} onChange={(event) => { setIndicatorApplicability((current) => ({ ...current, [id]: event.target.value as IndicatorApplicability })); setChangesPending(true); }}><option>Aplicável</option><option>Por confirmar</option><option>Não aplicável</option></select></label>;
                  })}</div>
                </details>
              </article>;
            })}
          </div>
        </section>}

        {view === "documentos" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 1 · Diagnóstico</p><h2>Mapa de fontes</h2><p>Os ficheiros são lidos no navegador e passam primeiro pelo Agente de Privacidade. Só o texto validado segue para análise documental.</p></div><label className="button primary file-button">Ler documentos localmente<input type="file" multiple accept=".pdf,.docx,.xls,.xlsx,.csv,.txt" onChange={handleFiles} /></label></div>
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

        {view === "privacidade" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente de Privacidade · Validação prévia</p><h2>Triagem e minimização de dados</h2><p>A deteção é efetuada localmente. Reveja as sinalizações e confirme a versão minimizada antes de permitir a análise documental.</p></div><span className="badge">{privacyReviews.length} por validar</span></div>
          <div className="privacy-warning"><strong>Limite da deteção automática</strong><span>Podem existir nomes, imagens, tabelas ou referências indiretas que não sejam reconhecidos. A confirmação humana é obrigatória. O texto original desta etapa permanece apenas na memória da sessão e não é incluído em “Guardar localmente”.</span></div>
          {privacyReviews.length === 0 ? <div className="empty-analysis"><strong>Não existem documentos a aguardar validação de privacidade.</strong><p>Carregue novos documentos ou prossiga para a análise documental.</p><div className="action-row"><button className="button secondary" onClick={() => setView("documentos")}>Carregar documentos</button><button className="button primary" onClick={() => setView("analise")}>Abrir análise documental</button></div></div> : <div className="privacy-review-list">
            {privacyReviews.map((review) => {
              const directCount = review.findings.filter((finding) => finding.redacted).length;
              const sensitiveCount = review.findings.filter((finding) => finding.kind === "Informação sensível").length;
              const preview = review.sanitizedChunks.map((chunk) => `${chunk.location}\n${chunk.text}`).join("\n\n").slice(0, 5000);
              return <article className="privacy-review-card" key={review.source}>
                <div className="privacy-review-head"><div><p className="eyebrow">Documento em memória</p><h3>{review.source}</h3></div><span className={`risk-badge risk-${review.risk.toLocaleLowerCase("pt-PT")}`}>Risco {review.risk.toLocaleLowerCase("pt-PT")}</span></div>
                <div className="privacy-controls"><label>Natureza do documento<select value={review.category} onChange={(event) => updatePrivacyCategory(review.source, event.target.value as PrivacyCategory)}><option>Institucional público</option><option>Estatístico agregado</option><option>Interno</option><option>Contém dados pessoais</option></select></label><div><strong>{directCount}</strong><span>dados ocultados automaticamente</span></div><div><strong>{sensitiveCount}</strong><span>referências sensíveis a rever</span></div></div>
                {review.findings.length ? <div className="privacy-findings">{review.findings.map((finding) => <div key={finding.id}><span className={finding.redacted ? "finding-state redacted" : "finding-state review"}>{finding.redacted ? "Ocultado" : "Rever"}</span><strong>{finding.kind}</strong><code>{finding.value}</code><small>{finding.location}</small></div>)}</div> : <p className="privacy-clear">Não foram detetados identificadores diretos nem expressões sensíveis. Confirme, ainda assim, o conteúdo do documento.</p>}
                <details className="sanitized-preview"><summary>Pré-visualizar texto que seguirá para análise</summary><pre>{preview}{preview.length >= 5000 ? "\n\n[Pré-visualização limitada; a validação aplica-se ao texto completo.]" : ""}</pre></details>
                <label className="privacy-confirm"><input type="checkbox" checked={privacyConfirmed.includes(review.source)} onChange={() => setPrivacyConfirmed((current) => current.includes(review.source) ? current.filter((item) => item !== review.source) : [...current, review.source])} /><span>Verifiquei o documento e confirmo que a versão proposta não contém dados pessoais desnecessários para a avaliação.</span></label>
                <div className="action-row privacy-actions"><button className="button danger-ghost" onClick={() => discardPrivacyReview(review.source)}>Eliminar documento</button><button className="button primary" disabled={!privacyConfirmed.includes(review.source)} onClick={() => approvePrivacy(review.source)}>Validar e enviar para análise documental</button></div>
              </article>;
            })}
          </div>}
        </section>}

        {view === "analise" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 2 · Extração documental por IA</p><h2>Evidências documentais por campo e indicador</h2><p>A IA percorre o texto, extrai factos e propõe imediatamente os indicadores diretamente sustentados. A validação confirma simultaneamente a evidência e as associações revistas.</p></div><div className="analysis-actions"><span className="badge">{documentCandidates.length} evidências · {new Set(documentCandidates.flatMap((item) => item.indicatorIds ?? [])).size} indicadores detetados</span><button className="button secondary" disabled={!documentCandidates.length} onClick={toggleAllCandidates}>{allCandidatesSelected ? "Desmarcar todos" : "Selecionar todos"}</button><button className="button primary" disabled={!selectedCandidates.length} onClick={promoteCandidates}>Validar {selectedCandidates.length || ""} e promover</button></div></div>
          <div className="quality-gate"><strong>Documentos prontos para interpretação</strong><span>Apenas o texto previamente validado no Agente de Privacidade será enviado. O documento original não é transmitido nem guardado por esta etapa.</span></div>
          <div className="ai-document-list">
            {preparedDocuments.map((document) => <article className="ai-document-card" key={document.source}>
              <div><strong>{document.source}</strong><small>{document.chunks.length} secções ou páginas · {document.chunks.reduce((total, chunk) => total + chunk.text.length, 0).toLocaleString("pt-PT")} caracteres</small><span className={`ai-state ${document.status.toLowerCase().replace(" ", "-")}`}>{document.message}</span></div>
              <button className="button primary" disabled={document.status === "A analisar"} onClick={() => analyzePreparedDocument(document.source)}>{document.status === "A analisar" ? "Extração em curso…" : document.status === "Concluído" ? "Reextrair evidências" : "Extrair evidências"}</button>
            </article>)}
          </div>
          {preparedDocuments.length === 0 && documentCandidates.length === 0 && <div className="empty-analysis"><strong>Não existem documentos prontos para interpretação.</strong><p>Carregue um documento, valide a minimização dos dados na etapa Privacidade e regresse a esta área.</p><button className="button secondary" onClick={() => setView("documentos")}>Voltar aos documentos</button></div>}
          {documentCandidates.length > 0 && <><div className="quality-gate human-gate"><strong>Validação humana obrigatória</strong><span>Cada cartão corresponde a uma evidência proposta, ainda não triangulada. Reveja o facto, a localização, o campo e a reserva antes de o promover para a matriz.</span></div><div className="candidate-list">
            {documentCandidates.map((candidate) => { const field = getField(candidate.fieldId); return <article className={selectedCandidates.includes(candidate.id) ? "candidate-card selected" : "candidate-card"} key={candidate.id}>
              <label className="candidate-check"><input type="checkbox" checked={selectedCandidates.includes(candidate.id)} onChange={() => toggleCandidate(candidate.id)} /><span>Validar</span></label>
              <div className="candidate-main"><div className="original-excerpt"><strong>Excerto identificado</strong><p>{candidate.claim}</p><div className="candidate-source"><span>{candidate.source} · {candidate.location}</span></div></div>{candidate.matchedTerms.length > 0 && <div className="matched-terms">{candidate.matchedTerms.map((term) => <span key={term}>{term}</span>)}</div>}<label className="analysis-editor">Formulação analítica — opcional<textarea value={candidate.analysis} onChange={(event) => updateCandidateAnalysis(candidate.id, event.target.value)} placeholder="Se necessário, reformule ou clarifique a interpretação deste excerto antes de o validar." /><small className={candidate.analysis.trim() ? "analysis-ready" : "analysis-neutral"}>{candidate.analysis.trim() ? "Será usada a formulação editada" : "Será usado o excerto selecionado"}</small></label></div>
              <div className="candidate-classification"><label>Campo proposto<select value={candidate.fieldId} onChange={(event) => updateCandidateField(candidate.id, event.target.value)}>{fields.map((option) => <option value={option.id} key={option.id}>{option.section} · {option.name}</option>)}</select></label><small>{field.domain}</small><details className="evidence-indicators" open><summary>{candidate.indicatorIds?.length ? `${candidate.indicatorIds.length} indicador(es) proposto(s)` : "Sem indicador diretamente sustentado"}</summary>{(indicatorLabels[field.id] ?? []).map((label, index) => { const id = indicatorId(field.id, index); const linked = candidate.indicatorIds ?? []; return <label key={id}><input type="checkbox" checked={linked.includes(id)} onChange={() => { setDocumentCandidates((current) => current.map((item) => item.id === candidate.id ? { ...item, indicatorIds: linked.includes(id) ? linked.filter((value) => value !== id) : [...linked, id] } : item)); setChangesPending(true); }} /><span>{label}</span></label>; })}</details><button className="text-button danger-text" onClick={() => discardCandidate(candidate.id)}>Descartar</button></div>
            </article>; })}
          </div></>}
        </section>}

        {view === "estatistica" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 3 · Análise estatística</p><h2>Tratamento de dados quantitativos</h2><p>Trabalhe separadamente no InfoEscolas e nos ficheiros estatísticos. Em ambos os espaços, cada tratamento mostra se já está efetivamente na Matriz.</p></div><div className="analysis-actions"><span className="badge">{quantitativeEvidence.length} evidências quantitativas na Matriz</span><button className="button secondary" disabled={!workspaceStatisticalRecords.length} onClick={toggleAllStatisticalRecords}>{allStatisticalSelected ? "Desmarcar esta origem" : "Selecionar esta origem"}</button><button className="text-button danger-text" disabled={!selectedStatisticalIds.length} onClick={deleteSelectedStatisticalSources}>Eliminar origens selecionadas</button><button className="button primary" disabled={!workspaceStatisticalRecords.length} onClick={() => treatStatisticalData(statisticalWorkspace)}>Tratar dados deste espaço</button></div></div>
          <div className="quality-gate"><strong>Dois espaços independentes</strong><span>A separação evita misturar carregamento, seleção e tratamento. A convergência ocorre apenas quando usa «Enviar para a Matriz».</span><div className="action-row"><button className={statisticalWorkspace === "infoescolas" ? "button primary" : "button secondary"} onClick={() => { setStatisticalWorkspace("infoescolas"); setSelectedStatisticalIds([]); setSelectedTreatmentIds([]); setStatisticalStatus(""); }}>InfoEscolas · {statisticalRecords.filter((record) => record.dataset === "infoescolas").length} registos</button><button className={statisticalWorkspace === "general" ? "button primary" : "button secondary"} onClick={() => { setStatisticalWorkspace("general"); setSelectedStatisticalIds([]); setSelectedTreatmentIds([]); setStatisticalStatus(""); }}>Ficheiros estatísticos · {statisticalRecords.filter((record) => (record.dataset || "general") === "general").length} registos</button></div></div>
          <div className="statistics-import">
            {statisticalWorkspace === "general" ? <div className="statistics-upload"><strong>Ficheiros estatísticos</strong><p>Formatos aceites: XLS, XLSX, CSV, PDF e TXT.</p><label className="button primary file-button">Carregar dados<input type="file" multiple accept=".pdf,.xls,.xlsx,.csv,.txt" onChange={handleStatisticalFiles} /></label></div> : <div className="statistics-online"><strong>InfoEscolas ou outro endereço público</strong><p>Cole o endereço da página ou do ficheiro disponibilizado publicamente.</p><div><input type="url" value={statisticalUrl} onChange={(event) => setStatisticalUrl(event.target.value)} placeholder="https://infoescolas.medu.pt/…" /><button className="button secondary" onClick={loadStatisticalUrl}>Ler endereço público</button></div><small>Os ciclos são conservados separadamente e ordenados do 1.º ciclo ao ensino profissional.</small></div>}
          </div>
          {statisticalStatus && <div className="statistics-status" role="status">{statisticalStatus}</div>}
          {workspaceStatisticalRecords.length === 0 ? <div className="empty-analysis"><strong>Ainda não existem dados neste espaço.</strong><p>{statisticalWorkspace === "infoescolas" ? "Indique um endereço do InfoEscolas." : "Carregue um ficheiro estatístico."} Os dados só chegam à triangulação depois de tratados e enviados para a Matriz.</p></div> : <div className="statistics-list">
            {workspaceStatisticalRecords.map((record) => <article className={selectedStatisticalIds.includes(record.id) ? "statistics-card selected" : "statistics-card"} key={record.id}>
              <label className="candidate-check"><input type="checkbox" checked={selectedStatisticalIds.includes(record.id)} onChange={() => toggleStatisticalRecord(record.id)} /><span>Incluir</span></label>
              <div className="statistics-fields"><label>Indicador<input value={record.indicator} onChange={(event) => updateStatisticalRecord(record.id, { indicator: event.target.value })} /></label><label>Valor<input value={record.value} onChange={(event) => updateStatisticalRecord(record.id, { value: event.target.value })} /></label><div className="statistics-context"><strong>Contexto extraído</strong><span>{record.context}</span><small>{record.source} · {record.location}</small>{record.dataset === "infoescolas" && <small><strong>{record.evidenceUse === "academic-comparison" ? "Evidência académica · exige comparação com o nacional" : "Dado contextual · não entra automaticamente nas evidências"}</strong></small>}</div></div>
              <div className="candidate-classification"><label>Campo de análise<select value={record.fieldId} onChange={(event) => updateStatisticalRecord(record.id, { fieldId: event.target.value })}>{fields.map((field) => <option value={field.id} key={field.id}>{field.section} · {field.name}</option>)}</select></label><button className="text-button danger-text" onClick={() => { setStatisticalRecords((current) => current.filter((item) => item.id !== record.id)); setSelectedStatisticalIds((current) => current.filter((id) => id !== record.id)); }}>Descartar</button></div>
            </article>)}
          </div>}
          {workspaceStatisticalTreatments.length > 0 && <section className="treatment-panel">
            <div className="section-heading"><div><p className="eyebrow">Resultado intermédio</p><h3>Apresentação do tratamento por indicador</h3><p>Nos questionários, os dados são agregados por grupo e questões repetidas são deduplicadas. Critérios de sinalização: concordância ≥75% para ponto forte; não concordância ≥15%, “Não sei” ≥10% ou concordância &lt;60% para área de melhoria.</p></div><div className="action-row"><button className="button secondary" onClick={toggleAllTreatments}>{allTreatmentsSelected ? "Desmarcar tratamentos" : "Selecionar tratamentos"}</button><button className="button secondary" onClick={exportStatisticalServer}>Guardar Word (.docx)</button><button className="button primary" disabled={!workspaceSelectedTreatmentCount} onClick={promoteStatisticalTreatments}>Enviar para a Matriz ({workspaceSelectedTreatmentCount || ""})</button></div></div>
            {workspaceStatisticalTreatments.some((treatment) => treatment.respondentGroup) && <QuestionnaireOverviewChart treatments={workspaceStatisticalTreatments.filter((treatment) => treatment.respondentGroup)} />}
            <div className="treatment-grid">{workspaceStatisticalTreatments.map((treatment) => { const field = getField(treatment.fieldId); const matrixState = matrixStateForTreatment(treatment); return <article className={selectedTreatmentIds.includes(treatment.id) ? "treatment-card selected" : "treatment-card"} key={treatment.id}>
              <div className="treatment-top"><label className="check"><input type="checkbox" disabled={treatment.evidenceUse === "context-only"} checked={selectedTreatmentIds.includes(treatment.id)} onChange={() => toggleTreatment(treatment.id)} />{treatment.evidenceUse === "context-only" ? "Consulta/contexto" : "Usar tratamento"}</label><span className="badge">{matrixState}</span><span className="badge">{field.section} · {treatment.recordIds.length} registos</span></div>
              <h4>{treatment.indicator}</h4><small className="treatment-field">{field.name}</small>
              <TreatmentChart treatment={treatment} />
              {treatment.respondentGroup ? <div className="treatment-metrics questionnaire-metrics">{treatment.points.map((point) => <span key={point.label}><strong>{point.value.toLocaleString("pt-PT", { maximumFractionDigits: 1 })}%</strong>{point.label}</span>)}</div> : <div className="treatment-metrics"><span><strong>{treatment.points.length}</strong> observações</span><span><strong>{treatment.minimum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> mínimo</span><span><strong>{treatment.maximum?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> máximo</span><span><strong>{treatment.average?.toLocaleString("pt-PT", { maximumFractionDigits: 1 }) ?? "—"}{treatment.unit === "%" ? "%" : ""}</strong> média</span></div>}
              {treatment.respondentGroup && <div className="findings-grid"><div><strong>Pontos fortes</strong>{treatment.strengths.length ? <ul>{treatment.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Sem ponto forte global sinalizado pelo limiar de 75%.</p>}</div><div><strong>Áreas de melhoria</strong>{treatment.improvements.length ? <ul>{treatment.improvements.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Sem área global sinalizada pelos limiares definidos.</p>}</div></div>}
              <label>Análise descritiva para eventual utilização como evidência<textarea value={treatment.summary} onChange={(event) => updateStatisticalTreatment(treatment.id, event.target.value)} /></label>
              <small>Fontes de base: {treatment.sources.join("; ")}</small>
            </article>; })}</div>
            {workspaceStatisticalTreatments.some((treatment) => treatment.respondentGroup) && <section className="questionnaire-report-panel">
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
          <div className="quality-gate"><strong>Confirmação da Análise estatística</strong><span>{quantitativeEvidence.length ? `${quantitativeEvidence.length} tratamento(s) quantitativo(s) encontram-se efetivamente na Matriz e podem seguir para a triangulação. A origem e o número de registos constam em cada evidência.` : "Ainda não existe qualquer tratamento estatístico na Matriz. Volte à Análise estatística, trate os dados, selecione os tratamentos e use «Enviar para a Matriz»."}</span><div className="action-row"><button className="button secondary" onClick={() => setView("estatistica")}>Voltar à Análise estatística</button><button className="button primary" disabled={!quantitativeEvidence.length} onClick={() => setView("triangulacao")}>Seguir para a triangulação</button></div></div>
          <section className="interview-review-panel">
            <div className="section-heading"><div><p className="eyebrow">Associação assistida · validação humana</p><h3>Associar evidências aos indicadores</h3><p>Use uma única chamada para todos os campos. Se precisar de corrigir apenas uma parte, pode repetir a operação para um campo específico. As sugestões só alteram a cobertura depois de confirmadas.</p></div><span className="badge auto-badge">1 chamada global</span></div>
            <div className="filters">
              <label>Âmbito da análise<select value={indicatorFieldId} onChange={(event) => { setIndicatorFieldId(event.target.value); setIndicatorSuggestions([]); setIndicatorDrafts({}); setIndicatorSuggestionStatus(""); }}><option value="all">Todos os campos de análise — recomendado</option>{fields.map((field) => <option value={field.id} key={field.id}>{field.section} · {field.name}</option>)}</select></label>
              <button className="button primary" disabled={aiSuggestingIndicators || !evidence.some((record) => record.validated && (indicatorFieldId === "all" || record.fieldId === indicatorFieldId))} onClick={suggestIndicatorsWithAi}>{aiSuggestingIndicators ? "A analisar todos os campos…" : indicatorFieldId === "all" ? "Propor todas as associações · 1 chamada" : "Reanalisar este campo · 1 chamada"}</button>
            </div>
            {indicatorSuggestionStatus && <div className="statistics-status" role="status">{indicatorSuggestionStatus}</div>}
            {Object.keys(indicatorDrafts).length > 0 && <div className="interview-candidate-list">
              {evidence.filter((record) => record.validated && indicatorDrafts[record.id] && (indicatorFieldId === "all" || record.fieldId === indicatorFieldId)).map((record) => {
                const labels = indicatorLabels[record.fieldId] ?? [];
                const linked = indicatorDrafts[record.id] ?? [];
                const proposals = indicatorSuggestions.filter((item) => item.evidenceId === record.id);
                const recordField = getField(record.fieldId);
                return <article className="interview-candidate selected" key={record.id}>
                  <div className="interview-candidate-main"><span className="badge">{recordField.section} · {recordField.name}</span><strong>{record.claim}</strong><small>{record.source} · {record.location}</small>
                    <details className="evidence-indicators" open><summary>{linked.length} indicador(es) selecionado(s) para confirmação</summary>
                      {labels.map((label, index) => {
                        const id = indicatorId(record.fieldId, index);
                        const suggestion = proposals.find((item) => item.indicatorId === id);
                        const notApplicable = indicatorApplicability[id] === "Não aplicável";
                        return <label key={id}><input type="checkbox" disabled={notApplicable} checked={linked.includes(id)} onChange={() => toggleIndicatorDraft(record.id, id)} /><span>{label}{suggestion ? ` — sugestão IA (${suggestion.confidence.toLowerCase()}): ${suggestion.justification}` : notApplicable ? " — não aplicável" : ""}</span></label>;
                      })}
                    </details>
                  </div>
                </article>;
              })}
              <div className="action-row"><button className="button secondary" onClick={() => { setIndicatorSuggestions([]); setIndicatorDrafts({}); setIndicatorSuggestionStatus("Propostas descartadas; as associações existentes foram preservadas."); }}>Descartar propostas</button><button className="button primary" onClick={confirmIndicatorDrafts}>Confirmar associações revistas</button></div>
            </div>}
          </section>
          <div className="filters">
            <label>Domínio<select value={filterDomain} onChange={(event) => setFilterDomain(event.target.value)}><option>Todos</option>{domainOrder.map((domain) => <option key={domain}>{domain}</option>)}</select></label>
            <label>Estado<select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option>Todos</option><option>Confirmada</option><option>Por triangular</option><option>Contraditória</option><option>Ausente</option></select></label>
          </div>
          <div className="table-wrap"><table><thead><tr><th>Formulação analítica</th><th>Campo e indicadores</th><th>Fonte / localização</th><th>Estado</th><th>Validação</th></tr></thead><tbody>
            {visibleEvidence.map((record) => { const field = getField(record.fieldId); const linked = record.indicatorIds ?? []; return <tr key={record.id}><td><textarea className="evidence-editor" value={record.claim} onChange={(event) => { const claim = event.target.value; setEvidence((current) => current.map((item) => item.id === record.id ? { ...item, claim } : item)); setChangesPending(true); }} aria-label={`Formulação analítica — ${field.name}`} /><small>{record.sourceType} · robustez {record.strength.toLowerCase()} · edite para interpretar, não transcrever</small></td><td><strong>{field.section}</strong><small>{field.domain}<br />{field.name}</small><details className="evidence-indicators"><summary>{linked.length ? `${linked.length} indicador(es) associado(s)` : "Associar indicadores"}</summary>{(indicatorLabels[field.id] ?? []).map((label, index) => { const id = indicatorId(field.id, index); return <label key={id}><input type="checkbox" checked={linked.includes(id)} onChange={() => { setEvidence((current) => current.map((item) => item.id === record.id ? { ...item, indicatorIds: linked.includes(id) ? linked.filter((value) => value !== id) : [...linked, id] } : item)); setChangesPending(true); }} /><span>{label}</span></label>; })}</details></td><td>{record.source}<small>{record.location}</small></td><td><span className={`status ${record.status.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{record.status}</span></td><td><label className="check"><input type="checkbox" checked={record.validated} onChange={() => { setEvidence((current) => current.map((item) => item.id === record.id ? { ...item, validated: !item.validated } : item)); setChangesPending(true); }} />{record.validated ? "Validada" : "Pendente"}</label></td></tr>; })}
          </tbody></table></div>
        </section>}

        {view === "entrevistas" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 5 · Extração testemunhal por IA</p><h2>Evidências dos painéis</h2><p>Introduza as notas de cada painel. A IA extrai apenas evidências testemunhais para os campos pertinentes, sem formular juízos nem realizar consolidações; a equipa revê e valida antes de as enviar para a Matriz.</p></div></div>
          <div className="interview-workflow-note"><strong>Menos classificação manual</strong><span>Não é necessário dividir antecipadamente o relato pelos campos de análise. Evite apenas nomes e outros dados pessoais desnecessários.</span></div>
          <div className="interview-import-card">
            <label>Painel entrevistado<select value={interviewPanel} onChange={(event) => setInterviewPanel(event.target.value)}><option>Direção</option><option>Conselho Geral</option><option>Elementos do Conselho Pedagógico</option><option>Equipa de Autoavaliação</option><option>Diretores de Turma</option><option>Docentes</option><option>Alunos</option><option>Encarregados de educação</option><option>Pessoal não docente</option><option>Parceiros</option></select></label>
            <label className="interview-full-text">Notas completas ou síntese global da entrevista<textarea value={interviewText} onChange={(event) => setInterviewText(event.target.value)} placeholder="Cole aqui as notas da entrevista, sem identificação nominal. A organização por campos será proposta automaticamente…" /></label>
            <div className="interview-import-actions"><small>{interviewText.trim().length.toLocaleString("pt-PT")} caracteres</small><button className="button primary" disabled={interviewAnalyzing || interviewText.trim().length < 40} onClick={analyzeInterviewNotes}>{interviewAnalyzing ? "A analisar…" : "Analisar relato integralmente"}</button></div>
          </div>
          {interviewAnalysisStatus && <div className="statistics-status" role="status">{interviewAnalysisStatus}</div>}
          {interviewCandidates.length > 0 && <section className="interview-review-panel">
            <div className="section-heading"><div><p className="eyebrow">Validação humana obrigatória</p><h3>Evidências testemunhais propostas</h3><p>Reveja a afirmação, o campo, a natureza e a reserva. Uma declaração do painel permanece por triangular, mesmo depois de validada.</p></div><div className="action-row"><button className="button secondary" onClick={toggleAllInterviewCandidates}>{interviewCandidates.every((item) => selectedInterviewCandidates.includes(item.id)) ? "Desmarcar todas" : "Selecionar todas"}</button><button className="button primary" disabled={!selectedInterviewCandidates.length} onClick={promoteInterviewCandidates}>Validar e enviar ({selectedInterviewCandidates.length})</button></div></div>
            <div className="interview-candidate-list">{interviewCandidates.map((candidate) => { const field = getField(candidate.fieldId); return <article className={selectedInterviewCandidates.includes(candidate.id) ? "interview-candidate selected" : "interview-candidate"} key={candidate.id}>
              <label className="candidate-check"><input type="checkbox" checked={selectedInterviewCandidates.includes(candidate.id)} onChange={() => toggleInterviewCandidate(candidate.id)} /><span>Validar</span></label>
              <div className="interview-candidate-main"><label>Afirmação testemunhal<textarea value={candidate.synthesis} onChange={(event) => updateInterviewCandidate(candidate.id, { synthesis: event.target.value })} /></label><small>{candidate.location} · {candidate.nature}</small>{candidate.reservations.length > 0 && <div className="interview-detail warning"><strong>Reserva ou necessidade de triangulação</strong><ul>{candidate.reservations.map((item) => <li key={item}>{item}</li>)}</ul></div>}</div>
              <div className="candidate-classification"><label>Campo proposto<select value={candidate.fieldId} onChange={(event) => updateInterviewCandidate(candidate.id, { fieldId: event.target.value })}>{fields.map((option) => <option value={option.id} key={option.id}>{option.section} · {option.name}</option>)}</select></label><small>{field.domain}</small><button className="text-button danger-text" onClick={() => { setInterviewCandidates((current) => current.filter((item) => item.id !== candidate.id)); setSelectedInterviewCandidates((current) => current.filter((id) => id !== candidate.id)); }}>Descartar</button></div>
            </article>; })}</div>
          </section>}
          {interviews.length > 0 && <section className="validated-interviews"><div className="section-heading"><div><p className="eyebrow">Histórico validado</p><h3>Sínteses já integradas</h3></div></div><div className="interview-list">{interviews.map((item) => { const field = getField(item.fieldId); return <article key={item.id}><div><span className="badge">{item.panel}</span><small>{field.section} · {field.name}</small></div><p>{item.summary}</p></article>; })}</div></section>}
        </section>}

        {view === "triangulacao" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 6 · Cruzamento de fontes</p><h2>Triangulação e narrativa avaliativa</h2><p>A opção recomendada cruza todos os campos numa única chamada. A operação por campo fica disponível apenas para correções pontuais.</p></div><div className="action-row"><span className="badge auto-badge">Só evidência validada</span><button className="button secondary" onClick={refreshNarratives}>Atualizar localmente · sem API</button><button className="button primary" disabled={aiTriangulatingAll || Boolean(aiTriangulatingField) || !validatedCount} onClick={triangulateAllWithAi}>{aiTriangulatingAll ? "A triangular todos…" : "Triangular todos os campos com IA · 1 chamada"}</button></div></div>
          {aiTriangulationStatus && <div className="statistics-status" role="status">{aiTriangulationStatus}</div>}
          <div className="narrative-guidance"><strong>Do dado ao juízo</strong><span>As narrativas são propostas de trabalho editáveis. Reveja o alcance, confirme as referências e não transforme previsão, atividade ou testemunho isolado em impacto demonstrado.</span></div>
          <div className="triangulation-grid narrative-grid">
            {fields.map((field) => {
              const records = evidence.filter((record) => record.fieldId === field.id && record.validated);
              const waiting = evidence.filter((record) => record.fieldId === field.id && !record.validated).length;
              const strength = strengthFor(records);
              const types = new Set(records.map((record) => record.sourceType));
              const narrative = narratives[field.id] ?? composeFieldNarrative(field, records);
              const triangulationOutdated = Boolean(narrative.trim()) && triangulationRevisions[field.id] !== evidenceRevision(evidence, field.id);
              return <article key={field.id}>
                <div className="tri-top"><span>{field.section}</span><span className={`strength ${strength.toLowerCase()}`}>{strength}</span></div>
                <h3>{field.name}</h3><small>{field.domain}</small>
                {triangulationOutdated && <div className="statistics-status" role="status"><strong>Triangulação desatualizada.</strong> A Matriz mudou depois desta narrativa; repita a triangulação antes de atualizar o Relatório.</div>}
                <div className="tri-stats"><span><strong>{records.length}</strong> validadas</span><span><strong>{types.size}</strong> tipos de fonte</span><span><strong>{waiting}</strong> pendentes</span></div>
                <button className="button secondary" disabled={!records.length || aiTriangulatingAll || Boolean(aiTriangulatingField)} onClick={() => triangulateFieldWithAi(field)}>{aiTriangulatingField === field.id ? "A triangular…" : "Refazer apenas este campo · 1 chamada"}</button>
                <label className="narrative-editor">Síntese avaliativa<textarea value={narrative} onChange={(event) => { setNarratives((current) => ({ ...current, [field.id]: event.target.value })); setChangesPending(true); }} /></label>
                <div className="source-evidence"><strong>Base probatória</strong>{records.length ? <ul>{records.map((record) => <li key={record.id}>{record.source} · {record.location} · {record.status}</li>)}</ul> : <span>Lacuna documental: preparar pedido de evidência e questões para os painéis.</span>}</div>
              </article>;
            })}
          </div>
        </section>}

        {view === "relatorio" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 7 · Redação avaliativa</p><h2>Minuta do relatório</h2><p>Gere primeiro a minuta local sem custo. O aprimoramento por IA é opcional e usa uma única chamada para o relatório completo.</p></div><div className="action-row"><button className="button secondary" onClick={generateReport}>Gerar minuta local · sem API</button><button className="button primary" disabled={aiReportWriting} onClick={improveReportWithAi}>{aiReportWriting ? "A aprimorar…" : "Aprimorar com IA · 1 chamada"}</button><button className="button secondary" disabled={!report} onClick={downloadReport}>Guardar Word (.docx)</button><button className="button secondary" disabled={!report} onClick={downloadReportText}>Guardar texto (.txt)</button></div></div>
          {exportStatus && <div className="export-status" role="status">{exportStatus}</div>}
          <div className="report-layout">
            <aside><strong>Controlo de qualidade</strong><ul><li>Estrutura 5.1–5.4 preservada</li><li>Texto contínuo em cada campo</li><li>Interpretação revista na triangulação preservada</li><li>Sem nomes de documentos ou páginas no corpo</li><li>Distinção entre prática, resultado e impacto</li><li>Validação humana obrigatória</li></ul></aside>
            <textarea value={report} onChange={(event) => setReport(event.target.value)} placeholder="Selecione “Gerar minuta” para produzir um texto organizado a partir das evidências atuais." aria-label="Minuta do relatório" />
          </div>
        </section>}

        {view === "conclusoes" && <section className="view">
          <div className="page-heading"><div><p className="eyebrow">Agente 8 · Síntese conclusiva</p><h2>Classificações, Pontos Fortes e Áreas de Melhoria</h2><p>As propostas partem das narrativas trianguladas e devem ser consistentes com o relatório. A decisão final pertence à equipa de avaliação.</p></div><div className="action-row"><button className="button secondary" onClick={generateConclusions}>Gerar proposta local · sem API</button><button className="button primary" disabled={aiConclusionsWriting} onClick={improveConclusionsWithAi}>{aiConclusionsWriting ? "A rever…" : "Melhorar e propor menções com IA · 1 chamada"}</button><button className="button secondary" disabled={!conclusions.length} onClick={exportConclusionsWord}>Guardar Word (.docx)</button></div></div>
          {conclusionsStatus && <div className="export-status" role="status">{conclusionsStatus}</div>}
          <div className="narrative-guidance"><strong>Critério de decisão</strong><span>A proposta considera o predomínio relativo de pontos fortes e áreas de melhoria, a cobertura dos campos, a generalização das práticas, a robustez das fontes e a demonstração de resultados ou impacto. Não constitui uma média matemática.</span></div>
          {!conclusions.length ? <div className="empty-analysis"><strong>Ainda não existe uma proposta conclusiva.</strong><p>Conclua e reveja as triangulações; depois gere a proposta local ou peça a revisão opcional por IA.</p></div> : <div className="triangulation-grid narrative-grid">
            {conclusions.map((item) => <article key={item.domain}>
              <div className="tri-top"><span>{reportHeading(item.domain).split(" — ")[0]}</span><span className="strength moderada">{item.rating}</span></div>
              <h3>{item.domain}</h3>
              <label>Menção proposta<select value={item.rating} onChange={(event) => updateConclusion(item.domain, { rating: event.target.value as Rating })}><option>Por definir</option><option>Excelente</option><option>Muito bom</option><option>Bom</option><option>Suficiente</option><option>Insuficiente</option></select></label>
              <label className="narrative-editor">Fundamentação da menção<textarea value={item.rationale} onChange={(event) => updateConclusion(item.domain, { rationale: event.target.value })} /></label>
              <label className="narrative-editor">Pontos fortes — um por linha<textarea value={item.strengths.join("\n")} onChange={(event) => updateConclusion(item.domain, { strengths: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></label>
              <label className="narrative-editor">Áreas de melhoria — uma por linha<textarea value={item.improvements.join("\n")} onChange={(event) => updateConclusion(item.domain, { improvements: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean) })} /></label>
            </article>)}
          </div>}
        </section>}
      </section>
      <style>{`
        .clean-metrics {
          gap: 14px;
        }
        .clean-metrics article {
          position: relative;
          min-height: 116px;
          padding: 20px 22px;
          border: 1px solid #e7ece9;
          border-radius: 18px;
          background: linear-gradient(145deg, #ffffff 0%, #f8faf9 100%);
          box-shadow: 0 8px 24px rgba(26, 49, 42, .055);
        }
        .clean-metrics article::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 4px;
          border-radius: 18px 0 0 18px;
          background: #4d8b72;
        }
        .clean-metrics article.warning::before { background: #d29a49; }
        .clean-metrics article span {
          color: #65736e;
          font-size: .72rem;
          font-weight: 750;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .clean-metrics article strong {
          margin: 7px 0 2px;
          color: #173f34;
          font-size: 2rem;
          line-height: 1;
        }
        .field-coverage-grid {
          gap: 14px;
        }
        .field-coverage-card {
          border: 1px solid #e5ebe8;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 6px 20px rgba(20, 52, 42, .045);
        }
        .field-coverage-top strong {
          color: #245d4c;
          font-size: 1.45rem;
        }
        .field-coverage-meta {
          padding-top: 10px;
          border-top: 1px solid #eef2f0;
        }
        .domain-card details { margin-top: 14px; }
        .domain-card summary {
          color: #53635d;
          cursor: pointer;
          font-size: .8rem;
          font-weight: 700;
        }
        @media (max-width: 760px) {
          .clean-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </main>
  );
}
