"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MarkdownTranscriptSummary = {
  expertName: string;
  videoTitle: string;
  segmentsCreated: number;
  takesCreated: number;
  playersMentioned: number;
  sourcePlatform: string;
  videoId?: string;
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: MarkdownTranscriptSummary }
  | { status: "error"; message: string };

export function MarkdownTranscriptImportForm() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/knowledge-brain/import-markdown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          markdown: formData.get("markdown"),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Markdown transcript could not be imported.",
        });
        return;
      }

      setState({ status: "success", summary: payload.summary });
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Markdown transcript could not be imported.",
      });
    }
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Markdown Transcript
        <textarea
          className="min-h-[420px] rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-950"
          name="markdown"
          placeholder={`---
expert: "Fantasy Footballers"
channel: "The Fantasy Footballers"
title: "Example Video"
date: "2026-06-23"
runtime: "1:02:14"
url: "https://www.youtube.com/watch?v=..."
video_id: "abc123..."
source_platform: "YouTube"
---

# Example Video

Paste transcript text here...`}
          required
        />
      </label>

      <button
        className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 md:w-fit"
        disabled={state.status === "loading"}
        type="submit"
      >
        {state.status === "loading" ? "Importing" : "Import Markdown"}
      </button>

      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Imported {state.summary.videoTitle} from {state.summary.expertName}.
          Created {state.summary.segmentsCreated} segments,{" "}
          {state.summary.takesCreated} takes, and matched{" "}
          {state.summary.playersMentioned} players.
          {state.summary.videoId ? (
            <span> Video ID: {state.summary.videoId}.</span>
          ) : null}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
