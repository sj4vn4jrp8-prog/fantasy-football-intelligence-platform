"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type BulkImportSummary = {
  totalSubmitted: number;
  imported: number;
  skipped: number;
  failed: number;
  results: Array<
    | {
        filename: string;
        status: "IMPORTED";
        summary: {
          expertName: string;
          videoTitle: string;
          segmentsCreated: number;
          takesCreated: number;
          playersMentioned: number;
          videoId?: string;
        };
      }
    | {
        filename: string;
        status: "SKIPPED";
        reason: string;
      }
    | {
        filename: string;
        status: "FAILED";
        error: string;
      }
  >;
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: BulkImportSummary }
  | { status: "error"; message: string };

export function BulkMarkdownTranscriptImportForm() {
  const router = useRouter();
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/knowledge-brain/import-markdown/bulk", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Bulk Markdown import could not run.",
        });
        return;
      }

      setState({ status: "success", summary: payload.summary });
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Bulk Markdown import could not run.",
      });
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold text-zinc-700">
        Markdown Files
        <input
          accept=".md,text/markdown,text/plain"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
          multiple
          name="files"
          required
          type="file"
        />
      </label>

      <button
        className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 md:w-fit"
        disabled={state.status === "loading"}
        type="submit"
      >
        {state.status === "loading" ? "Importing Files" : "Import Files"}
      </button>

      {state.status === "success" ? (
        <BulkImportResults summary={state.summary} />
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </div>
      ) : null}
    </form>
  );
}

function BulkImportResults({ summary }: { summary: BulkImportSummary }) {
  return (
    <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-2 sm:grid-cols-4">
        <ResultMetric label="Submitted" value={String(summary.totalSubmitted)} />
        <ResultMetric label="Imported" value={String(summary.imported)} />
        <ResultMetric label="Skipped" value={String(summary.skipped)} />
        <ResultMetric label="Failed" value={String(summary.failed)} />
      </div>

      <div className="grid gap-2">
        {summary.results.map((result) => (
          <div
            className="rounded-md border border-zinc-200 bg-white p-3 text-sm"
            key={`${result.filename}-${result.status}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="font-semibold text-zinc-950">{result.filename}</p>
              <StatusBadge status={result.status} />
            </div>
            {result.status === "IMPORTED" ? (
              <p className="mt-2 text-zinc-600">
                Imported {result.summary.videoTitle} from{" "}
                {result.summary.expertName}. Created{" "}
                {result.summary.segmentsCreated} segments,{" "}
                {result.summary.takesCreated} takes, and matched{" "}
                {result.summary.playersMentioned} players.
              </p>
            ) : null}
            {result.status === "SKIPPED" ? (
              <p className="mt-2 text-zinc-600">{result.reason}</p>
            ) : null}
            {result.status === "FAILED" ? (
              <p className="mt-2 text-red-700">{result.error}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "IMPORTED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "SKIPPED"
        ? "bg-amber-100 text-amber-900"
        : "bg-red-100 text-red-800";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {status.toLowerCase()}
    </span>
  );
}
