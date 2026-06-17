"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MockProjectionImportSummary = {
  leagueName: string;
  week: number;
  provider: string;
  playersConsidered: number;
  projectionsImported: number;
};

type ImportState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: MockProjectionImportSummary }
  | { status: "error"; message: string };

export function MockProjectionImportForm({
  leagueId,
  defaultWeek = 1,
}: {
  leagueId: string;
  defaultWeek?: number;
}) {
  const router = useRouter();
  const [week, setWeek] = useState(String(defaultWeek));
  const [state, setState] = useState<ImportState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading" });

    try {
      const response = await fetch(`/api/leagues/${leagueId}/mock-projections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week: Number(week),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ?? "Mock projections could not be generated.",
        });
        return;
      }

      setState({ status: "success", summary: payload.summary });
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Mock projections could not be generated.",
      });
    }
  }

  return (
    <form className="grid gap-3 sm:max-w-md" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Week</span>
          <input
            className="h-10 w-24 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none ring-emerald-600 transition focus:border-emerald-600 focus:ring-2"
            max="18"
            min="1"
            onChange={(event) => setWeek(event.target.value)}
            type="number"
            value={week}
          />
        </label>
        <button
          className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          disabled={state.status === "loading"}
          type="submit"
        >
          {state.status === "loading"
            ? "Generating"
            : "Generate mock projections"}
        </button>
      </div>

      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Saved {state.summary.projectionsImported} {state.summary.provider}{" "}
          projections for week {state.summary.week}.
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
