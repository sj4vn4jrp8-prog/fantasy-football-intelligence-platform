import { NextRequest, NextResponse } from "next/server";
import { saveExpertTakeOutcome } from "@/knowledge-brain/expert-outcomes";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await saveExpertTakeOutcome({
      expertTakeId: String(body?.expertTakeId ?? ""),
      outcomeType: String(body?.outcomeType ?? "MANUAL"),
      outcomeValue: normalizeOptionalString(body?.outcomeValue),
      outcomeDate: normalizeOptionalString(body?.outcomeDate),
      grade: String(body?.grade ?? "NEEDS_REVIEW"),
      confidence: body?.confidence,
      notes: normalizeOptionalString(body?.notes),
    });

    return NextResponse.json({
      summary: {
        expertName: result.expertName,
        snapshotsUpdated: result.snapshotsUpdated,
        outcomeId: result.outcome.id,
      },
    });
  } catch (error) {
    console.error("Expert take outcome save failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Expert take outcome could not be saved.",
      },
      { status: 400 },
    );
  }
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack:
        process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  return { message: String(error) };
}
