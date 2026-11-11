import { AlignmentType, BorderStyle, Document, Footer, ImageRun, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType } from "docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOMAINS = ["Autoavaliação", "Liderança e Gestão", "Prestação do Serviço Educativo", "Resultados"];
const TEAL = "35A8AE";
const STUDENT = "80C342";
const FAMILY = "D41445";

function safeFilename(value: string) {
  return `${value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "relatorio-simplificado"}.docx`;
}

function heading(text: string, color = TEAL, size = 26) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 220, after: 160 }, children: [new TextRun({ text: text.toUpperCase(), bold: true, color, size, font: "Arial" })] });
}

function domainHeading(text: string) {
  return new Paragraph({ spacing: { before: 180, after: 60 }, children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: "222222" })] });
}

function bullet(text: string) {
  return new Paragraph({ bullet: { level: 0 }, spacing: { after: 80, line: 260 }, children: [new TextRun({ text, size: 18, font: "Arial", color: "222222" })] });
}

function sectionFromDomains(title: string, values: Record<string, string[]>, color: string) {
  return [heading(title, color), ...DOMAINS.flatMap((domain) => [domainHeading(domain), ...(Array.isArray(values?.[domain]) && values[domain].length ? values[domain].map(bullet) : [bullet("Não foram identificados aspetos específicos neste domínio.")])])];
}

function ratingsTable(ratings: Array<{ dominio: string; classificacao: string }>) {
  const borders = { top: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" }, left: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" }, right: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D6D6D6" } };
  const rows = [new TableRow({ tableHeader: true, children: ["Domínio", "Classificação"].map((text) => new TableCell({ shading: { fill: TEAL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })] })) }), ...DOMAINS.map((domain) => {
    const rating = ratings?.find((item) => item.dominio === domain)?.classificacao || "Não indicada";
    return new TableRow({ children: [domain, rating].map((text) => new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 50, after: 50 }, children: [new TextRun({ text, size: 18, font: "Arial" })] })] })) });
  })];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders, rows });
}

function questionnaireTables(analysis: any) {
  if (!Array.isArray(analysis?.grupos)) return [];
  return analysis.grupos.flatMap((group: any) => {
    const tableFor = (title: string, items: any[], positive: boolean) => {
      const headers = positive ? ["N.º", "Item", "CT (%)", "C (%)", "CT + C (%)"] : ["N.º", "Item", "D (%)", "DT (%)", "Total (%)"];
      const rows = [new TableRow({ tableHeader: true, children: headers.map((value) => new TableCell({ shading: { fill: TEAL, type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: value, bold: true, color: "FFFFFF", size: 14, font: "Arial" })] })] })) }), ...(items || []).map((item) => new TableRow({ children: [item.numero, item.item, positive ? item.concordoTotalmente : item.discordo, positive ? item.concordo : item.discordoTotalmente, item.total].map((value, index) => new TableCell({ verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ alignment: index === 1 ? AlignmentType.LEFT : AlignmentType.CENTER, children: [new TextRun({ text: String(value ?? ""), size: 14, font: "Arial" })] })] })) }))];
      return [domainHeading(title), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })];
    };
    return [heading(`Questionários — ${group.grupo}`, TEAL, 22), ...tableFor("Itens de maior concordância", group.maiorConcordancia, true), ...tableFor("Itens de menor concordância", group.menorConcordancia, false)];
  });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const content = JSON.parse(String(form.get("content") || "{}"));
    const audience = form.get("audience") === "familias" ? "familias" : "alunos";
    const school = String(form.get("school") || "Unidade orgânica avaliada").slice(0, 180);
    const analysis = JSON.parse(String(form.get("questionnaireAnalysis") || "{}"));
    const manifest = JSON.parse(String(form.get("graphManifest") || "[]"));
    const accent = audience === "alunos" ? STUDENT : FAMILY;
    const graphParagraphs: Paragraph[] = [];
    for (const item of Array.isArray(manifest) ? manifest.slice(0, 12) : []) {
      const file = form.get(`graph-${item.id}`);
      if (!(file instanceof File) || !file.type.match(/^image\/(png|jpeg)$/)) continue;
      const ratio = Number(item.width) > 0 && Number(item.height) > 0 ? Number(item.height) / Number(item.width) : 0.58;
      const width = 520;
      graphParagraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 80 }, children: [new ImageRun({ type: file.type === "image/png" ? "png" : "jpg", data: new Uint8Array(await file.arrayBuffer()), transformation: { width, height: Math.min(360, Math.max(180, Math.round(width * ratio))) }, altText: { title: item.name || "Gráfico dos questionários", description: item.name || "Gráfico dos questionários", name: item.name || "Gráfico" } })] }));
      graphParagraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: item.name || "Gráfico dos questionários", italics: true, size: 16, color: "666666", font: "Arial" })] }));
    }

    const sectionTitle = audience === "alunos" ? "Relatório para alunos" : "Relatório para famílias";
    const children = [
      new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 500 }, children: [new TextRun({ text: "IGEC", bold: true, color: "159447", size: 34, font: "Arial" }), new TextRun({ text: "  Inspeção-Geral da Educação e Ciência", color: "159447", size: 16, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900, after: 280 }, children: [new TextRun({ text: sectionTitle.toUpperCase(), bold: true, color: TEAL, size: 34, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: school.toUpperCase(), bold: true, color: accent, size: 30, font: "Arial" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 700 }, children: [new TextRun({ text: "AVALIAÇÃO EXTERNA DAS ESCOLAS", color: TEAL, size: 30, font: "Arial" })] }),
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 180, line: 280 }, children: [new TextRun({ text: content.introducao || "", size: 19, font: "Arial" })] }),
      ...sectionFromDomains(audience === "alunos" ? "O que está a correr bem?" : "Pontos fortes", content.pontosFortes || {}, accent),
      new Paragraph({ children: [new PageBreak()] }),
      ...sectionFromDomains(audience === "alunos" ? "O que pode melhorar?" : "Áreas de melhoria", content.areasMelhoria || {}, accent),
      heading("Projetos interessantes", accent),
      ...(content.projetosInteressantes || []).map(bullet),
      ...(audience === "familias" ? [heading("Valorização do papel dos pais na vida escolar", accent), ...(content.papelFamilias || []).map(bullet)] : []),
      ...(graphParagraphs.length || analysis?.grupos?.length ? [new Paragraph({ children: [new PageBreak()] }), heading("Resultados dos questionários", TEAL), ...graphParagraphs, ...questionnaireTables(analysis)] : []),
      new Paragraph({ children: [new PageBreak()] }),
      heading("Classificações", TEAL), ratingsTable(content.classificacoes || []),
    ];
    const document = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 18 }, paragraph: { spacing: { line: 260 } } } } },
      sections: [{ properties: { page: { margin: { top: 900, right: 900, bottom: 900, left: 900 } } }, footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: school, color: "999999", size: 14 }), new TextRun({ text: "  |  ", color: "999999", size: 14 }), new TextRun({ children: [PageNumber.CURRENT], color: "999999", size: 14 })] })] }) }, children }],
    });
    const blob = await Packer.toBlob(document);
    return new Response(await blob.arrayBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeFilename(`${school}-${audience}`)}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Não foi possível exportar o relatório.", { status: 500 });
  }
}
