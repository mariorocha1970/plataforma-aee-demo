import { buildTemplateReport } from "../../template-docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function safeFilename(value: string) {
  return `${value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "relatorio-simplificado"}.docx`;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const content = JSON.parse(String(form.get("content") || "{}"));
    const analysis = JSON.parse(String(form.get("questionnaireAnalysis") || "{}"));
    const audience = form.get("audience") === "familias" ? "familias" : "alunos";
    const school = String(form.get("school") || "Unidade orgânica avaliada").slice(0, 180);
    const coverValue = form.get("cover");
    const cover = coverValue instanceof File ? coverValue : null;
    const document = await buildTemplateReport({ audience, school, content, analysis, cover });
    return new Response(Buffer.from(document), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFilename(`${school}-${audience}`)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Não foi possível preencher o template do relatório.", { status: 500 });
  }
}
