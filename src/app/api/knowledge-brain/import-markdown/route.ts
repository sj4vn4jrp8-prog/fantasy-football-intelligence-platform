import { NextRequest, NextResponse } from "next/server";
import { ingestMarkdownTranscript } from "@/lib/knowledge-brain";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const markdown = typeof body?.markdown === "string" ? body.markdown : "";

  try {
    const summary = await ingestMarkdownTranscript(markdown);

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Markdown transcript could not be imported.",
      },
      { status: 400 },
    );
  }
}
