import { AlignmentType, Document, HeadingLevel, Packer, Paragraph } from "docx";

function safeFilename(value: string, extension: string) {
  const base = value.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "relatorio-aee";
  return `${base}.${extension}`;
}

function wordParagraph(line: string) {
  const value = line.trim();
  if (!value) return new Paragraph({ text: "", spacing: { after: 100 } });
  if (/^(?:MINUTA|RELATÓRIO ANALÍTICO)/i.test(value)) return new Paragraph({ text: value, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 320 } });
  if (/^(?:\d+\.|5\.\d(?:\.\d)?\.?\s|NOTA DE CONTROLO)/.test(value)) return new Paragraph({ text: value, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 140 } });
  return new Paragraph({ text: value, alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 300 } });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const content = String(form.get("content") ?? "").slice(0, 2_000_000);
  const requestedName = String(form.get("filename") ?? "relatorio-aee");
  const format = form.get("format") === "txt" ? "txt" : "docx";
  if (!content.trim()) return new Response("Não existe texto para exportar.", { status: 400 });

  if (format === "txt") {
    const filename = safeFilename(requestedName, "txt");
    return new Response(`\uFEFF${content}`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
  }

  const document = new Document({ sections: [{ properties: {}, children: content.split(/\r?\n/).map(wordParagraph) }] });
  const blob = await Packer.toBlob(document);
  const filename = safeFilename(requestedName, "docx");
  return new Response(await blob.arrayBuffer(), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
