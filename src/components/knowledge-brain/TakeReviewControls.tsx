"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewStatus = "PENDING" | "APPROVED" | "DISMISSED" | "NEEDS_EDIT";

type PlayerOption = {
  id: string;
  fullName: string;
  position: string;
  team: string | null;
};

type TakeReviewControlsProps = {
  confidence: number;
  expertTakeId: string;
  playerId: string | null;
  players: PlayerOption[];
  reviewStatus: ReviewStatus;
  sentiment: string;
  summary: string;
  takeType: string;
};

type FormState =
  | { status: "idle" }
  | { status: "loading"; action: ReviewStatus }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const TAKE_REVIEW_API_URL = "/api/knowledge-brain/take-review";
const SENTIMENTS = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
const TAKE_TYPES = [
  "START_SIT",
  "WAIVER",
  "TRADE",
  "DRAFT",
  "INJURY",
  "MATCHUP",
  "BREAKOUT",
  "FADE",
  "SLEEPER",
  "UNCATEGORIZED",
] as const;

export function TakeReviewControls({
  confidence,
  expertTakeId,
  playerId,
  players,
  reviewStatus,
  sentiment,
  summary,
  takeType,
}: TakeReviewControlsProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function saveReview(form: HTMLFormElement, nextStatus: ReviewStatus) {
    const formData = new FormData(form);
    const requestBody = {
      expertTakeId,
      reviewStatus: nextStatus,
      playerId: getFormString(formData, "playerId"),
      sentiment: getFormString(formData, "sentiment"),
      takeType: getFormString(formData, "takeType"),
      summary: getFormString(formData, "summary"),
      confidence: getFormString(formData, "confidence"),
    };

    if (!requestBody.summary) {
      setState({ status: "error", message: "Summary is required." });
      return;
    }

    setState({ status: "loading", action: nextStatus });

    try {
      const response = await fetch(TAKE_REVIEW_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ??
            `Review could not be saved. Server returned ${response.status}.`,
        });
        return;
      }

      setState({
        status: "success",
        message: `Saved as ${formatEnumLabel(nextStatus)}.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Review could not be saved: ${error.message}`
            : "Review could not be saved.",
      });
    }
  }

  return (
    <form className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px_170px_120px]">
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Player Match
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={playerId ?? ""}
            name="playerId"
          >
            <option value="">No player match</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.fullName} - {player.position}
                {player.team ? `, ${player.team}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Sentiment
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={sentiment}
            name="sentiment"
          >
            {SENTIMENTS.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Take Type
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={takeType}
            name="takeType"
          >
            {TAKE_TYPES.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Confidence
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={confidence.toFixed(2)}
            max="1"
            min="0"
            name="confidence"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Summary
        <textarea
          className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={summary}
          name="summary"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <ReviewButton
          currentState={state}
          label="Approve"
          onClick={(event) =>
            event.currentTarget.form
              ? saveReview(event.currentTarget.form, "APPROVED")
              : undefined
          }
          status="APPROVED"
        />
        <ReviewButton
          currentState={state}
          label="Dismiss"
          onClick={(event) =>
            event.currentTarget.form
              ? saveReview(event.currentTarget.form, "DISMISSED")
              : undefined
          }
          status="DISMISSED"
        />
        <ReviewButton
          currentState={state}
          label="Needs Edit"
          onClick={(event) =>
            event.currentTarget.form
              ? saveReview(event.currentTarget.form, "NEEDS_EDIT")
              : undefined
          }
          status="NEEDS_EDIT"
        />
        <ReviewButton
          currentState={state}
          label="Return Pending"
          onClick={(event) =>
            event.currentTarget.form
              ? saveReview(event.currentTarget.form, "PENDING")
              : undefined
          }
          status="PENDING"
        />
        <span className="rounded-md bg-zinc-100 px-2 py-2 text-xs font-semibold text-zinc-600">
          Current: {formatEnumLabel(reviewStatus)}
        </span>
      </div>

      {state.status === "success" ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {state.message}
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function ReviewButton({
  currentState,
  label,
  onClick,
  status,
}: {
  currentState: FormState;
  label: string;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  status: ReviewStatus;
}) {
  const loading =
    currentState.status === "loading" && currentState.action === status;

  return (
    <button
      className={`h-9 rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-zinc-300 ${
        status === "APPROVED"
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : status === "DISMISSED"
            ? "bg-red-700 text-white hover:bg-red-800"
            : status === "NEEDS_EDIT"
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-zinc-950 text-white hover:bg-zinc-800"
      }`}
      disabled={currentState.status === "loading"}
      onClick={onClick}
      type="button"
    >
      {loading ? "Saving" : label}
    </button>
  );
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
