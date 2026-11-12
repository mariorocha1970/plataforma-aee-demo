import { NextRequest, NextResponse } from "next/server";
import { parseQuestionnaires } from "../../questionnaire-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as any;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (text.length < 100) return NextResponse.json({ ok: false, error: "Não foi possível extrair informação suficiente dos questionários." }, { status: 400 });
    if (text.length > 180_000) return NextResponse.json({ ok: false, error: "Os questionários excedem o limite preventivo de 180 000 caracteres." }, { status: 413 });
    return NextResponse.json({ ok: true, analysis: parseQuestionnaires(text), deterministic: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Erro interno na leitura dos questionários." }, { status: 400 });
  }
}
