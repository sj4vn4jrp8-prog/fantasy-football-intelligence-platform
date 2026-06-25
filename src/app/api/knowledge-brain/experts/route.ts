import { NextRequest, NextResponse } from "next/server";
import { createExpert, DuplicateExpertNameError } from "@/lib/knowledge-brain";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  try {
    const summary = await createExpert({
      name: String(body?.name ?? ""),
      description:
        typeof body?.description === "string" ? body.description : undefined,
      websiteUrl:
        typeof body?.websiteUrl === "string" ? body.websiteUrl : undefined,
      youtubeChannelUrl:
        typeof body?.youtubeChannelUrl === "string"
          ? body.youtubeChannelUrl
          : undefined,
      active: body?.active !== false,
      tags: typeof body?.tags === "string" ? body.tags : undefined,
    });

    return NextResponse.json({ summary }, { status: 201 });
  } catch (error) {
    console.error("Expert create failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Expert could not be created.",
      },
      { status: error instanceof DuplicateExpertNameError ? 409 : 400 },
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
