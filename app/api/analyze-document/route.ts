import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPOS_AEE = [
  "Desenvolvimento",
  "Consistência e impacto",
  "Visão e estratégia",
  "Liderança",
  "Gestão",
  "Desenvolvimento pessoal e bem-estar das crianças e dos alunos",
  "Oferta educativa e gestão curricular",
  "Ensino, aprendizagem e avaliação",
  "Planificação e acompanhamento das práticas educativa e letiva",
  "Resultados académicos",
  "Resultados sociais",
  "Reconhecimento da comunidade",
];

function obterTexto(body: Record<string, unknown>): string {
  const possibilidades = [
    body.text,
    body.extractedText,
    body.documentText,
    body.content,
    body.texto,
    body.conteudo,
  ];

  const texto = possibilidades.find(
    (valor) => typeof valor === "string" && valor.trim().length > 0
  );

  return typeof texto === "string" ? texto.trim() : "";
}

function extrairOutputText(data: any): string {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }

  if (!Array.isArray(data?.output)) {
    return "";
  }

  return data.output
    .flatMap((item: any) =>
      Array.isArray(item?.content) ? item.content : []
    )
    .filter((item: any) => item?.type === "output_text")
    .map((item: any) => item?.text ?? "")
    .join("");
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.OPENAI_API_KEY),
    route: "/api/analyze-document",
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          configured: false,
          error:
            "O Agente de IA ainda não está configurado. Adicione OPENAI_API_KEY às variáveis de ambiente do servidor.",
        },
        { status: 503 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "O pedido enviado para análise não contém JSON válido.",
        },
        { status: 400 }
      );
    }

    const texto = obterTexto(body);

    if (!texto) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi recebido texto do documento. Confirme se o PDF foi lido e se contém texto pesquisável.",
        },
        { status: 400 }
      );
    }

    const nomeDocumento =
      typeof body.fileName === "string"
        ? body.fileName
        : typeof body.documentName === "string"
        ? body.documentName
        : typeof body.nomeDocumento === "string"
        ? body.nomeDocumento
        : "Documento sem título";

    /*
     * Limita o texto enviado numa única chamada.
     * Em documentos muito extensos deverá implementar-se posteriormente
     * análise por blocos e consolidação final.
     */
    const textoLimitado = texto.slice(0, 120_000);

    let model = process.env.OPENAI_MODEL?.trim() || "gpt-5.6-sol";

    // Corrige automaticamente a designação incompleta usada anteriormente.
    if (model === "gpt-5.6") {
      model = "gpt-5.6-sol";
    }

    const prompt = `
Atue como especialista em Avaliação Externa das Escolas, em Portugal.

Analise o documento com rigor técnico e produza formulações analíticas prontas
para validação humana e posterior integração numa matriz de evidências.

Regras obrigatórias:

1. Não copie extensos excertos do documento.
2. Não transforme títulos, listas ou frases isoladas em conclusões.
3. Interprete a informação, identificando finalidades, medidas, processos,
   níveis de concretização, monitorização, resultados e impacto.
4. Não invente informação, resultados, causalidades ou juízos avaliativos.
5. Quando não existir informação suficiente para um campo, declare claramente
   que o documento não contém evidência bastante.
6. Diferencie intenções, ações implementadas, mecanismos de monitorização e
   resultados efetivamente demonstrados.
7. Escreva em português europeu, com frases completas, coesas e sintaticamente
   corretas.
8. Cada síntese deve constituir uma narrativa analítica fluida e não uma
   concatenação de excertos.
9. Indique pontos fortes apenas quando estiverem sustentados.
10. Formule áreas de melhoria com prudência, sem ultrapassar a informação
    disponível.
11. Distribua a informação apenas pelos campos em que seja efetivamente
    pertinente.
12. Não faça referência ao nome do ficheiro dentro das sínteses.

Campos de análise:
${CAMPOS_AEE.map((campo, indice) => `${indice + 1}. ${campo}`).join("\n")}

Documento: ${nomeDocumento}

Texto:
--- INÍCIO DO DOCUMENTO ---
${textoLimitado}
--- FIM DO DOCUMENTO ---
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        input: prompt,
        text: {
          format: {
            type: "json_schema",
            name: "analise_documental_aee",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                enquadramento: {
                  type: "string",
                  description:
                    "Caracterização sintética da natureza, finalidade e alcance do documento.",
                },
                sinteseGlobal: {
                  type: "string",
                  description:
                    "Síntese interpretativa global, fluida e rigorosa.",
                },
                analises: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      campo: {
                        type: "string",
                        enum: CAMPOS_AEE,
                      },
                      pertinente: {
                        type: "boolean",
                      },
                      sintese: {
                        type: "string",
                      },
                      evidencias: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                      },
                      pontosFortes: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                      },
                      areasMelhoria: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                      },
                      reservas: {
                        type: "array",
                        items: {
                          type: "string",
                        },
                      },
                      robustez: {
                        type: "string",
                        enum: [
                          "sem evidência",
                          "fraca",
                          "moderada",
                          "forte",
                        ],
                      },
                    },
                    required: [
                      "campo",
                      "pertinente",
                      "sintese",
                      "evidencias",
                      "pontosFortes",
                      "areasMelhoria",
                      "reservas",
                      "robustez",
                    ],
                  },
                },
              },
              required: ["enquadramento", "sinteseGlobal", "analises"],
            },
          },
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro devolvido pela OpenAI:", data);

      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error:
            data?.error?.message ||
            "A OpenAI não conseguiu concluir a análise.",
          errorType: data?.error?.type || "openai_error",
        },
        { status: response.status }
      );
    }

    const outputText = extrairOutputText(data);

    if (!outputText) {
      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error: "A resposta da IA não contém uma análise utilizável.",
        },
        { status: 502 }
      );
    }

    let resultado;

    try {
      resultado = JSON.parse(outputText);
    } catch {
      console.error("Resposta não convertível em JSON:", outputText);

      return NextResponse.json(
        {
          ok: false,
          configured: true,
          error:
            "A IA respondeu, mas o resultado não pôde ser convertido para a matriz.",
        },
        { status: 502 }
      );
    }

    /*
     * São devolvidos os nomes analysis, result e data para assegurar
     * compatibilidade com diferentes versões do page.tsx.
     */
    return NextResponse.json({
      ok: true,
      configured: true,
      model,
      truncated: texto.length > textoLimitado.length,
      analysis: resultado,
      result: resultado,
      data: resultado,
      ...resultado,
    });
  } catch (error) {
    console.error("Erro interno na análise documental:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro interno durante a análise documental.",
      },
      { status: 500 }
    );
  }
}