import { NextRequest, NextResponse } from "next/server";
import { updateExpertTakeReview } from "@/knowledge-brain/take-review";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await updateExpertTakeReview({
      expertTakeId: String(body?.expertTakeId ?? ""),
      reviewStatus: String(body?.reviewStatus ?? "PENDING"),
      playerId:
        body?.playerId === undefined || body?.playerId === null
          ? body?.playerId
          : String(body.playerId),
      sentiment:
        body?.sentiment === undefined ? undefined : String(body.sentiment),
      takeType: body?.takeType === undefined ? undefined : String(body.takeType),
      summary: body?.summary === undefined ? undefined : String(body.summary),
      confidence: body?.confidence,
    });

    return NextResponse.json({ summary: result });
  } catch (error) {
    console.error("Expert take review update failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Expert take review could not be updated.",
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
