"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewStatus = "PENDING" | "APPROVED" | "DISMISSED" | "NEEDS_EDIT";

type TranscriptSummaryReviewControlsProps = {
  reviewStatus: ReviewStatus;
  summaryId: string;
};

type FormState =
  | { status: "idle" }
  | { status: "loading"; action: ReviewStatus }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const SUMMARY_REVIEW_API_URL = "/api/knowledge-brain/transcript-summary-review";

export function TranscriptSummaryReviewControls({
  reviewStatus,
  summaryId,
}: TranscriptSummaryReviewControlsProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function saveReview(nextStatus: ReviewStatus) {
    setState({ status: "loading", action: nextStatus });

    try {
      const response = await fetch(SUMMARY_REVIEW_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summaryId,
          reviewStatus: nextStatus,
        }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            payload.error ??
            `Summary review could not be saved. Server returned ${response.status}.`,
        });
        return;
      }

      setState({
        status: "success",
        message: `Transcript summary saved as ${formatEnumLabel(nextStatus)}.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Summary review could not be saved: ${error.message}`
            : "Summary review could not be saved.",
      });
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <ReviewButton
          currentState={state}
          label="Approve Summary"
          onClick={() => saveReview("APPROVED")}
          status="APPROVED"
        />
        <ReviewButton
          currentState={state}
          label="Dismiss"
          onClick={() => saveReview("DISMISSED")}
          status="DISMISSED"
        />
        <ReviewButton
          currentState={state}
          label="Needs Edit"
          onClick={() => saveReview("NEEDS_EDIT")}
          status="NEEDS_EDIT"
        />
        <ReviewButton
          currentState={state}
          label="Return Pending"
          onClick={() => saveReview("PENDING")}
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
    </div>
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
