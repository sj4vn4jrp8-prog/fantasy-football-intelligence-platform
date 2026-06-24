import { NextResponse } from "next/server";
import { createTranscriptDiscoveryScaffoldRun } from "@/lib/knowledge-brain";

export async function POST() {
  const status = await createTranscriptDiscoveryScaffoldRun();

  return NextResponse.json({
    status,
    message:
      "Transcript discovery is scaffolded, but YouTube/transcript source integration is not active yet.",
  });
}
