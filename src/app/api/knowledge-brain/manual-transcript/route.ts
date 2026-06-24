import { NextRequest, NextResponse } from "next/server";
import { ingestManualTranscript } from "@/lib/knowledge-brain";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const publishedAt = parseRequiredDate(body?.publishedAt);

    const summary = await ingestManualTranscript({
      expertId: String(body?.expertId ?? ""),
      title: String(body?.title ?? ""),
      url: normalizeRequiredUrl(body?.url),
      publishedAt,
      transcript: String(body?.transcript ?? ""),
    });

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Manual transcript save failed", serializeError(error));

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Manual transcript could not be saved.",
      },
      { status: 400 },
    );
  }
}

function normalizeRequiredUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Video URL is required.");
  }

  const trimmedValue = value.trim();

  try {
    const url = new URL(trimmedValue);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Video URL must start with http:// or https://.");
    }

    return trimmedValue;
  } catch {
    throw new Error("Enter a valid video URL before saving.");
  }
}

function parseRequiredDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Publish date is required.");
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Enter a valid publish date before saving.");
  }

  return parsedDate;
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
