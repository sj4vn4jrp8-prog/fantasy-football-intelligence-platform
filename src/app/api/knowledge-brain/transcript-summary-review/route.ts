import { NextRequest, NextResponse } from "next/server";
import { updateTranscriptPlayerSummaryReview } from "@/knowledge-brain/take-review";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateTranscriptPlayerSummaryReview({
      summaryId: String(body?.summaryId ?? ""),
      reviewStatus: String(body?.reviewStatus ?? "PENDING"),
    });

    return NextResponse.json({ summary: result });
  } catch (error) {
    console.error("Transcript player summary review update failed", {
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
            : "Transcript player summary review could not be updated.",
      },
      { status: 400 },
    );
  }
}
