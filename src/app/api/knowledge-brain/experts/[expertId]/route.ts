import { NextRequest, NextResponse } from "next/server";
import {
  archiveExpert,
  deleteExpert,
  DuplicateExpertNameError,
  reactivateExpert,
  updateExpertManagementSettings,
  updateExpertSettings,
} from "@/lib/knowledge-brain";

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
    if (body?.action === "archive") {
      const summary = await archiveExpert(expertId);

      return NextResponse.json({ summary });
    }

    if (body?.action === "reactivate") {
      const summary = await reactivateExpert(expertId);

      return NextResponse.json({ summary });
    }

    if (typeof body?.name === "string") {
      const summary = await updateExpertManagementSettings({
        expertId,
        input: {
          name: body.name,
          description:
            typeof body?.description === "string"
              ? body.description
              : undefined,
          websiteUrl:
            typeof body?.websiteUrl === "string" ? body.websiteUrl : undefined,
          youtubeChannelUrl:
            typeof body?.youtubeChannelUrl === "string"
              ? body.youtubeChannelUrl
              : undefined,
          active: Boolean(body?.active),
          tags: typeof body?.tags === "string" ? body.tags : undefined,
        },
      });

      return NextResponse.json({ summary });
    }

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
      { status: error instanceof DuplicateExpertNameError ? 409 : 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: ExpertRouteContext,
) {
  const { expertId } = await params;
  const body = await request.json().catch(() => null);

  try {
    const summary = await deleteExpert({
      expertId,
      confirmHistory: body?.confirmHistory === true,
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Expert delete failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Expert could not be deleted.",
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
