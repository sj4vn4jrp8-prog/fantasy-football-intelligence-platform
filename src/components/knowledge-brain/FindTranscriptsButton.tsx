"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FindState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function FindTranscriptsButton() {
  const router = useRouter();
  const [state, setState] = useState<FindState>({ status: "idle" });

  async function handleClick() {
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/knowledge-brain/find-new-transcripts", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Transcript discovery could not run.",
        });
        return;
      }

      setState({
        status: "success",
        message: payload.message,
      });
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Transcript discovery could not run.",
      });
    }
  }

  return (
    <div className="grid gap-3">
      <button
        className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        disabled={state.status === "loading"}
        onClick={handleClick}
        type="button"
      >
        {state.status === "loading" ? "Checking" : "Find New Transcripts"}
      </button>
      {state.status === "success" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {state.message}
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </div>
      ) : null}
    </div>
  );
}
