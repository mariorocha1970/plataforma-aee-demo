import { buildTemplateReport } from "../../template-docx";

const SIMPLIFIED_REPORT_VERSION = "2026.11.23-v38.6";

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
    if (content?.generation?.version !== SIMPLIFIED_REPORT_VERSION || content?.generation?.mode !== "ai-validated") {
      return new Response("Exportação bloqueada: gere novamente o relatório simplificado com o motor institucional atual.", { status: 409 });
    }
    const analysis = JSON.parse(String(form.get("questionnaireAnalysis") || "{}"));
    const sourceReport = String(form.get("sourceReport") || "");
    const metadata = JSON.parse(String(form.get("reportMetadata") || "{}"));
    const audience = form.get("audience") === "familias" ? "familias" : "alunos";
    const school = String(form.get("school") || "Unidade orgânica avaliada").slice(0, 180);
    const coverValue = form.get("cover");
    const cover = coverValue instanceof File ? coverValue : null;
    const document = await buildTemplateReport({ audience, school, content, analysis, cover, sourceReport, metadata });
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
