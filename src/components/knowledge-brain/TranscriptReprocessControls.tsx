"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReprocessScope = "transcript" | "sourceVideo";

type TranscriptReprocessControlsProps = {
  sourceTitle: string;
  sourceVideoId: string;
  transcriptId: string | null;
};

type ReprocessState =
  | { status: "idle" }
  | { status: "loading"; scope: ReprocessScope }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const REPROCESS_API_URL = "/api/knowledge-brain/reprocess-transcript";

export function TranscriptReprocessControls({
  sourceTitle,
  sourceVideoId,
  transcriptId,
}: TranscriptReprocessControlsProps) {
  const router = useRouter();
  const [state, setState] = useState<ReprocessState>({ status: "idle" });

  async function reprocess(scope: ReprocessScope) {
    if (scope === "transcript" && !transcriptId) {
      setState({
        status: "error",
        message: "This take is not linked to a transcript.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Reprocess "${sourceTitle}"?\n\nThis replaces pending, needs-edit, and dismissed extracted takes for this ${scope === "transcript" ? "transcript" : "source"} with fresh Phase 2D extraction results. Approved takes and their grading outcomes are preserved.`,
    );

    if (!confirmed) return;

    setState({ status: "loading", scope });

    try {
      const response = await fetch(REPROCESS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          scope === "transcript"
            ? { scope, transcriptId }
            : { scope, sourceVideoId },
        ),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ??
            `Reprocessing failed. Server returned ${response.status}.`,
        });
        return;
      }

      const summary = payload.summary;
      setState({
        status: "success",
        message: `Reprocessed ${summary.transcriptCount} transcript${
          summary.transcriptCount === 1 ? "" : "s"
        }, replaced ${summary.oldUnapprovedTakeCount} unapproved take${
          summary.oldUnapprovedTakeCount === 1 ? "" : "s"
        }, and created ${summary.newTakeCount} new pending take${
          summary.newTakeCount === 1 ? "" : "s"
        }. Approved takes were preserved.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Reprocessing failed: ${error.message}`
            : "Reprocessing failed.",
      });
    }
  }

  return (
    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <p className="font-semibold">Reprocess this source</p>
      <p className="leading-5">
        Reprocessing uses the stricter extractor, replaces unapproved generated
        takes for this transcript/source, and keeps approved takes untouched.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="h-9 rounded-md bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          disabled={state.status === "loading" || !transcriptId}
          onClick={() => reprocess("transcript")}
          type="button"
        >
          {state.status === "loading" && state.scope === "transcript"
            ? "Reprocessing"
            : "Reprocess Transcript"}
        </button>
        <button
          className="h-9 rounded-md border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-zinc-100"
          disabled={state.status === "loading"}
          onClick={() => reprocess("sourceVideo")}
          type="button"
        >
          {state.status === "loading" && state.scope === "sourceVideo"
            ? "Reprocessing"
            : "Reprocess Source"}
        </button>
      </div>
      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-900">
          {state.message}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-2 text-red-900">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: `Server returned a non-JSON response: ${text.slice(0, 160)}`,
    };
  }
}
