import { NextRequest, NextResponse } from "next/server";
import { ingestBulkMarkdownTranscripts } from "@/lib/knowledge-brain";

const MAX_FILES = 25;
const MAX_FILE_BYTES = 1_500_000;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "Choose at least one Markdown file to import." },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Import ${MAX_FILES} files or fewer at a time.` },
        { status: 400 },
      );
    }

    const items = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".md")) {
        return NextResponse.json(
          { error: `${file.name} is not a .md file.` },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `${file.name} is too large for bulk import.` },
          { status: 400 },
        );
      }

      items.push({
        filename: file.name,
        markdown: await file.text(),
      });
    }

    const summary = await ingestBulkMarkdownTranscripts(items);

    return NextResponse.json({ summary });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Bulk Markdown import could not be completed.",
      },
      { status: 400 },
    );
  }
}
