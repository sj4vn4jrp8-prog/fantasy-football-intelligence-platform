import { NextRequest, NextResponse } from "next/server";
import { updateExpertSettings } from "@/lib/knowledge-brain";

type ExpertRouteContext = {
  params: Promise<{
    expertId: string;
  }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: ExpertRouteContext,
) {
  const { expertId } = await params;
  const body = await request.json().catch(() => null);

  try {
    const summary = await updateExpertSettings({
      expertId,
      active: Boolean(body?.active),
      notes: typeof body?.notes === "string" ? body.notes : undefined,
      tags: typeof body?.tags === "string" ? body.tags : undefined,
      channelUrl:
        typeof body?.channelUrl === "string" ? body.channelUrl : undefined,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Expert settings could not be saved.",
      },
      { status: 400 },
    );
  }
}
