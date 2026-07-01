import { NextRequest, NextResponse } from "next/server";
import { reprocessKnowledgeBrainTranscriptSource } from "@/knowledge-brain/reprocess-transcripts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const scope = String(body?.scope ?? "");

    const summary =
      scope === "sourceVideo"
        ? await reprocessKnowledgeBrainTranscriptSource({
            scope,
            sourceVideoId: String(body?.sourceVideoId ?? ""),
          })
        : await reprocessKnowledgeBrainTranscriptSource({
            scope: "transcript",
            transcriptId: String(body?.transcriptId ?? ""),
          });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Knowledge Brain transcript reprocessing failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.stack
          : undefined,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Transcript reprocessing failed.",
      },
      { status: 400 },
    );
  }
}
