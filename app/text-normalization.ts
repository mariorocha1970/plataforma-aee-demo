type AcronymRule = {
  acronym: string;
  designation: string;
  designationPattern?: string;
};

const acronymRules: AcronymRule[] = [
  { acronym: "AEE", designation: "avaliação externa das escolas" },
  { acronym: "IGEC", designation: "Inspeção-Geral da Educação e Ciência", designationPattern: "inspe[cç][aã]o[- ]geral da educa[cç][aã]o e ci[eê]ncia" },
  { acronym: "TEIP", designation: "territórios educativos de intervenção prioritária" },
  { acronym: "PASEO", designation: "perfil dos alunos à saída da escolaridade obrigatória" },
  { acronym: "EMAEI", designation: "equipa multidisciplinar de apoio à educação inclusiva" },
  { acronym: "PADDE", designation: "plano de ação para o desenvolvimento digital da escola" },
  { acronym: "EQAVET", designation: "quadro de referência europeu de garantia da qualidade para a educação e formação profissionais" },
  { acronym: "CFAE", designation: "centro de formação de associação de escolas" },
  { acronym: "PAA", designation: "plano anual de atividades" },
  { acronym: "RAA", designation: "relatório de autoavaliação" },
  { acronym: "PE", designation: "projeto educativo" },
  { acronym: "ASE", designation: "ação social escolar" },
  { acronym: "CAA", designation: "centro de apoio à aprendizagem" },
  { acronym: "SPO", designation: "serviço de psicologia e orientação" },
  { acronym: "GAAF", designation: "gabinete de apoio ao aluno e à família" },
  { acronym: "CRTIC", designation: "centro de recursos de tecnologias de informação e comunicação para a educação especial" },
  { acronym: "CEF", designation: "curso de educação e formação" },
  { acronym: "EFA", designation: "educação e formação de adultos" },
  { acronym: "RVCC", designation: "reconhecimento, validação e certificação de competências" },
  { acronym: "DAC", designation: "domínio de autonomia curricular" },
  { acronym: "DGE", designation: "Direção-Geral da Educação", designationPattern: "dire[cç][aã]o[- ]geral da educa[cç][aã]o" },
  { acronym: "IAVE", designation: "Instituto de Avaliação Educativa", designationPattern: "instituto de avalia[cç][aã]o educativa" },
];

function escapeExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeAcronyms(value: string) {
  let result = value;

  result = result.replace(
    /\b(?:plano(?:\s+de\s+a[cç][aã]o)?\s+)?TEIP\s*4\b(?:\s*[-–—:]?\s*(?:plano\s+de\s+a[cç][aã]o\s+)?TEIP\s*4\b)?/gi,
    "plano de ação dos territórios educativos de intervenção prioritária (plano de ação TEIP4)",
  );

  acronymRules.forEach(({ acronym, designation, designationPattern }) => {
    if (acronym === "TEIP" && /plano de ação dos territórios educativos de intervenção prioritária \(plano de ação TEIP4\)/i.test(result)) return;
    const phrase = designationPattern || escapeExpression(designation);
    const designationWithAcronym = new RegExp(`\\b${phrase}\\b(?:\\s*[-–—,:]?\\s*\\(?${escapeExpression(acronym)}\\)?)?`, "gi");
    const firstPhrase = designationWithAcronym.exec(result);
    const acronymExpression = new RegExp(`\\b${escapeExpression(acronym)}\\b`, "g");
    const firstAcronym = acronymExpression.exec(result);

    if (firstPhrase && (firstAcronym?.index ?? Number.POSITIVE_INFINITY) >= firstPhrase.index) {
      result = `${result.slice(0, firstPhrase.index)}${designation} (${acronym})${result.slice(firstPhrase.index + firstPhrase[0].length)}`;
      return;
    }

    if (firstAcronym?.index !== undefined) {
      result = `${result.slice(0, firstAcronym.index)}${designation} (${acronym})${result.slice(firstAcronym.index + acronym.length)}`;
    }
  });

  return result;
}
