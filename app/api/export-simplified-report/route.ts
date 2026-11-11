import { AlignmentType, BorderStyle, Document, Footer, ImageRun, PageBreak, PageNumber, Packer, Paragraph, SectionType, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"];
const TEAL = "35A8AE";
const STUDENT = "80C342";
const FAMILY = "D41445";

function safeFilename(value: string) {
  return `${value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "relatorio-simplificado"}.docx`;
}

function pageBreak() { return new Paragraph({ children: [new PageBreak()] }); }

function barHeading(text: string) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } }, rows: [new TableRow({ children: [new TableCell({ shading: { fill: TEAL, type: ShadingType.CLEAR }, margins: { top: 70, bottom: 70, left: 100, right: 100 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text.toUpperCase(), bold: true, color: "FFFFFF", size: 16, font: "Arial" })] })] })] })] });
}

function lead(text: string) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 250 }, children: [new TextRun({ text, size: 17, font: "Arial", color: "222222" })] });
}

function domainHeading(text: string) {
  return new Paragraph({ spacing: { before: 130, after: 45 }, children: [new TextRun({ text, bold: true, size: 18, font: "Arial", color: "222222" })] });
}

function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 55, line: 235 }, children: [new TextRun({ text, size: 16, font: "Arial", color: "222222" })] });
}

function domainSection(title: string, values: Record<string, string[]>) {
  return [barHeading(title), ...DOMAINS.flatMap((domain) => [domainHeading(domain), ...((Array.isArray(values?.[domain]) && values[domain].length ? values[domain] : ["Não foram identificados aspetos específicos neste domínio."]).map(bullet))])];
}

function listSection(title: string, values: string[]) {
  return [barHeading(title), ...((Array.isArray(values) && values.length ? values : ["Não foram identificados elementos específicos no relatório."]).map(bullet))];
}

function ratingsTable(ratings: Array<{ dominio: string; classificacao: string }>) {
  const border = { style: BorderStyle.SINGLE, size: 5, color: "B8C7C3" };
  const rows = [new TableRow({ tableHeader: true, children: ["Domínio", "Classificação"].map((text) => new TableCell({ shading: { fill: TEAL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 16, font: "Arial" })] })] })) }), ...DOMAINS.map((domain) => {
    const rating = ratings?.find((item) => item.dominio === domain)?.classificacao || "Não indicada";
    return new TableRow({ children: [domain, rating].map((text) => new TableCell({ verticalAlign: VerticalAlign.CENTER, margins: { top: 70, bottom: 70, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, size: 16, font: "Arial" })] })] })) });
  })];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows });
}

function groupCode(value: string) {
  const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const match = normalized.match(/\bQ\s*([1-6])\b/);
  return match ? `Q${match[1]}` : "";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const content = JSON.parse(String(form.get("content") || "{}"));
    const audience = form.get("audience") === "familias" ? "familias" : "alunos";
    const school = String(form.get("school") || "Unidade orgânica avaliada").slice(0, 180);
    const manifest = JSON.parse(String(form.get("graphManifest") || "[]"));
    const accent = audience === "alunos" ? STUDENT : FAMILY;
    const allowedCodes = audience === "alunos" ? ["Q1", "Q2"] : ["Q5", "Q6"];
    const graphsByCode: Record<string, Paragraph[]> = Object.fromEntries(allowedCodes.map((code) => [code, []]));
    for (const item of Array.isArray(manifest) ? manifest.slice(0, 12) : []) {
      const code = groupCode(String(item.name || ""));
      if (!allowedCodes.includes(code)) continue;
      const file = form.get(`graph-${item.id}`);
      if (!(file instanceof File) || !file.type.match(/^image\/(png|jpeg)$/)) continue;
      const ratio = Number(item.width) > 0 && Number(item.height) > 0 ? Number(item.height) / Number(item.width) : 0.52;
      const width = 485;
      graphsByCode[code].push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 110, after: 35 }, children: [new ImageRun({ type: file.type === "image/png" ? "png" : "jpg", data: new Uint8Array(await file.arrayBuffer()), transformation: { width, height: Math.min(265, Math.max(150, Math.round(width * ratio))) }, altText: { title: item.name || `Gráfico ${code}`, description: item.name || `Resultados do ${code}`, name: item.name || code } })] }));
      graphsByCode[code].push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: item.name || `Resultados do ${code}`, italics: true, size: 14, color: "666666", font: "Arial" })] }));
    }

    const questionnaireIntro = audience === "alunos"
      ? "Através dos questionários respondidos pelos alunos, foi possível conhecer as suas opiniões sobre a escola. Os gráficos seguintes apresentam os resultados mais relevantes."
      : "Através dos questionários aplicados aos pais e encarregados de educação, foi possível conhecer as suas opiniões sobre diferentes aspetos da escola. Nos gráficos, as respostas de concordância e de discordância são apresentadas de forma agregada.";

    const body: Array<Paragraph | Table> = [
      new Paragraph({ spacing: { after: 130 }, children: [new TextRun({ text: audience === "alunos" ? "Caros alunos" : "Caros Pais e Encarregados de Educação", bold: true, size: 20, font: "Arial" })] }),
      lead(content.introducao || ""),
      ...domainSection(audience === "alunos" ? "O que está a correr bem?" : "Pontos fortes", content.pontosFortes || {}),
      pageBreak(),
      ...domainSection(audience === "alunos" ? "O que pode melhorar?" : "Áreas de melhoria", content.areasMelhoria || {}),
      ...(audience === "alunos" ? [...listSection("Projetos interessantes", content.projetosInteressantes || [])] : []),
      pageBreak(),
      ...(audience === "familias" ? [...listSection("Projetos", content.projetosInteressantes || []), ...listSection("Valorização do papel dos pais na vida escolar", content.papelFamilias || []), pageBreak()] : []),
      lead(questionnaireIntro),
      ...graphsByCode[allowedCodes[0]],
      pageBreak(),
      ...graphsByCode[allowedCodes[1]],
      new Paragraph({ spacing: { before: 180, after: 100 }, children: [new TextRun({ text: "Considerando uma escala de avaliação de cinco níveis, que vai de Excelente a Insuficiente, os resultados da avaliação foram os seguintes:", size: 16, font: "Arial" })] }),
      ratingsTable(content.classificacoes || []),
      new Paragraph({ spacing: { before: 170 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "O relatório detalhado da avaliação externa pode ser consultado na página da IGEC.", color: TEAL, bold: true, size: 14, font: "Arial" })] }),
    ];

    const cover = form.get("cover");
    const coverChildren: Paragraph[] = [];
    if (cover instanceof File && cover.type.match(/^image\/(png|jpeg)$/)) {
      coverChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: cover.type === "image/png" ? "png" : "jpg", data: new Uint8Array(await cover.arrayBuffer()), transformation: { width: 446, height: 631 }, altText: { title: "Capa do relatório validado", description: "Primeira página do relatório AEE validado", name: "Capa" } })] }));
    } else {
      coverChildren.push(
        new Paragraph({ spacing: { after: 700 }, children: [new TextRun({ text: "IGEC", bold: true, color: "159447", size: 38, font: "Arial" }), new TextRun({ text: "  Inspeção-Geral da Educação e Ciência", color: "159447", size: 16, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 650, after: 200 }, children: [new TextRun({ text: audience === "alunos" ? "RELATÓRIO PARA ALUNOS" : "RELATÓRIO PARA PAIS E ENCARREGADOS DE EDUCAÇÃO", bold: true, color: TEAL, size: 32, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 520 }, children: [new TextRun({ text: school.toUpperCase(), bold: true, color: accent, size: 28, font: "Arial" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500 }, children: [new TextRun({ text: "AVALIAÇÃO EXTERNA DAS ESCOLAS", color: TEAL, size: 28, font: "Arial" })] }),
      );
    }

    const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: school, color: "999999", size: 13 }), new TextRun({ text: "  |  ", color: "999999", size: 13 }), new TextRun({ children: [PageNumber.CURRENT], color: "999999", size: 13 })] })] });
    const document = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 16 }, paragraph: { spacing: { line: 235 } } } } },
      sections: [
        { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } }, children: coverChildren },
        { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, right: 850, bottom: 720, left: 850 } } }, footers: { default: footer }, children: body },
      ],
    });
    const blob = await Packer.toBlob(document);
    return new Response(await blob.arrayBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeFilename(`${school}-${audience}`)}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Não foi possível exportar o relatório.", { status: 500 });
  }
}
