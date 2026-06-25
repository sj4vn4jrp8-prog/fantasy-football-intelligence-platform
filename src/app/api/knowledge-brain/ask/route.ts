import { NextRequest, NextResponse } from "next/server";
import { answerKnowledgeBrainQuestion } from "@/knowledge-brain/brain-search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const answer = await answerKnowledgeBrainQuestion({
      question: String(body?.question ?? ""),
      targetSeason: body?.targetSeason,
      includeHistorical: Boolean(body?.includeHistorical),
    });

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Knowledge Brain ask failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The Knowledge Brain could not answer that question.",
      },
      { status: 400 },
    );
  }
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return { message: String(error) };
}
