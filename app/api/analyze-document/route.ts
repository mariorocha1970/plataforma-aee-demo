import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPOS_AEE = [
  "Desenvolvimento", "Consistência e impacto", "Visão e estratégia", "Liderança", "Gestão",
  "Desenvolvimento pessoal e bem-estar das crianças e dos alunos", "Oferta educativa e gestão curricular",
  "Ensino, aprendizagem e avaliação", "Planificação e acompanhamento das práticas educativa e letiva",
  "Resultados académicos", "Resultados sociais", "Reconhecimento da comunidade",
] as const;

const ANALISE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    enquadramento: { type: "string" },
    sinteseGlobal: { type: "string" },
    analises: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          campo: { type: "string", enum: CAMPOS_AEE }, pertinente: { type: "boolean" }, sintese: { type: "string" },
          evidencias: { type: "array", items: { type: "string" } }, pontosFortes: { type: "array", items: { type: "string" } },
          areasMelhoria: { type: "array", items: { type: "string" } }, reservas: { type: "array", items: { type: "string" } },
          robustez: { type: "string", enum: ["sem evidência", "fraca", "moderada", "forte"] },
        },
        required: ["campo", "pertinente", "sintese", "evidencias", "pontosFortes", "areasMelhoria", "reservas", "robustez"],
      },
    },
  },
  required: ["enquadramento", "sinteseGlobal", "analises"],
};

function outputText(data: any): string {
  if (typeof data?.output_text === "string") return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : [])
    .filter((item: any) => item?.type === "output_text").map((item: any) => item?.text ?? "").join("");
}

async function invoke(apiKey: string, model: string, prompt: string, maxOutputTokens: number) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model, store: false, input: prompt,
      reasoning: { effort: "low" },
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name: "analise_documental_aee", strict: true, schema: ANALISE_SCHEMA } },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error?.message || "A OpenAI não conseguiu concluir a análise."), { status: response.status, type: data?.error?.type });
  const raw = outputText(data);
  if (!raw) throw Object.assign(new Error("A resposta da IA não contém uma análise utilizável."), { status: 502 });
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("A resposta da IA não pôde ser convertida para a matriz."), { status: 502 }); }
}

export async function GET() {
  return NextResponse.json({ ok: true, configured: Boolean(process.env.OPENAI_API_KEY), route: "/api/analyze-document", modes: ["block", "consolidate"] });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ ok: false, configured: false, error: "Adicione OPENAI_API_KEY às variáveis de ambiente do servidor." }, { status: 503 });
    const body = await request.json().catch(() => null) as any;
    if (!body) return NextResponse.json({ ok: false, error: "O pedido não contém JSON válido." }, { status: 400 });
    // Um modelo rápido reduz o risco de exceder a duração máxima da função.
    // OPENAI_MODEL continua a permitir uma escolha explícita na Vercel.
    let model = process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
    const fileName = typeof body.fileName === "string" ? body.fileName : "Documento sem título";
    const campos = CAMPOS_AEE.map((campo, i) => `${i + 1}. ${campo}`).join("\n");
    let prompt = "";

    if (body.mode === "consolidate") {
      if (!Array.isArray(body.partialAnalyses) || !body.partialAnalyses.length) return NextResponse.json({ ok: false, error: "Não foram recebidas análises parciais para consolidar." }, { status: 400 });
      const compactAnalyses = body.partialAnalyses.map((partial: any) => ({
        localizacao: partial?.localizacao || partial?.bloco || "",
        analises: (Array.isArray(partial?.analises) ? partial.analises : [])
          .filter((item: any) => item?.pertinente && item?.sintese)
          .map((item: any) => ({
            campo: item.campo,
            sintese: String(item.sintese).slice(0, 900),
            evidencias: (item.evidencias || []).slice(0, 4).map((value: any) => String(value).slice(0, 350)),
            pontosFortes: (item.pontosFortes || []).slice(0, 3).map((value: any) => String(value).slice(0, 250)),
            areasMelhoria: (item.areasMelhoria || []).slice(0, 3).map((value: any) => String(value).slice(0, 250)),
            reservas: (item.reservas || []).slice(0, 3).map((value: any) => String(value).slice(0, 250)),
            robustez: item.robustez,
          })),
      }));
      prompt = `Atue como especialista em Avaliação Externa das Escolas, em Portugal. Consolide as análises parciais do documento ${fileName}.\n\nREGRAS: inclua apenas campos com suporte; síntese máxima de 120 palavras por campo; no máximo 4 evidências e 3 itens em cada lista; elimine repetições; não conte a sobreposição como fontes independentes; preserve contradições, lacunas, reservas e localização; distinga intenção, execução, resultado e impacto; não invente; não aumente a robustez pela repetição; escreva em português europeu.\n\nCampos:\n${campos}\n\nAnálises parciais compactadas:\n${JSON.stringify(compactAnalyses)}`;
    } else {
      const text = typeof body.text === "string" ? body.text.trim() : typeof body.extractedText === "string" ? body.extractedText.trim() : "";
      if (!text) return NextResponse.json({ ok: false, error: "Não foi recebido texto do bloco." }, { status: 400 });
      prompt = `Atue como especialista em Avaliação Externa das Escolas, em Portugal. Analise apenas este bloco do documento ${fileName} (${body.blockLabel || "localização não indicada"}).\n\nREGRAS: não copie excertos extensos; conserve nas evidências a página/secção indicada; não transforme títulos ou frases isoladas em conclusões; diferencie intenções, práticas, monitorização, resultados e impacto; não invente causalidades nem juízos; declare insuficiência; produza sínteses fluidas em português europeu; distribua informação apenas por campos pertinentes; pontos fortes e áreas de melhoria exigem suporte; tenha em conta que há sobreposição com blocos adjacentes.\n\nCampos:\n${campos}\n\n--- INÍCIO DO BLOCO ---\n${text}\n--- FIM DO BLOCO ---`;
    }

    const result = await invoke(apiKey, model, prompt, body.mode === "consolidate" ? 3_200 : 4_000);
    return NextResponse.json({ ok: true, configured: true, model, mode: body.mode === "consolidate" ? "consolidate" : "block", analysis: result, result, data: result });
  } catch (error: any) {
    console.error("Erro na análise documental:", error);
    return NextResponse.json({ ok: false, configured: true, error: error instanceof Error ? error.message : "Erro interno durante a análise documental.", errorType: error?.type || "server_error" }, { status: Number.isInteger(error?.status) ? error.status : 500 });
  }
}
