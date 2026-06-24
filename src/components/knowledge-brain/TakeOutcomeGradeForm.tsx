"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type GradeFormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type TakeOutcomeGradeFormProps = {
  expertTakeId: string;
  outcomeTypeOptions: readonly string[];
  gradeOptions: readonly string[];
};

const TAKE_OUTCOME_API_URL = "/api/knowledge-brain/take-outcomes";

export function TakeOutcomeGradeForm({
  expertTakeId,
  outcomeTypeOptions,
  gradeOptions,
}: TakeOutcomeGradeFormProps) {
  const router = useRouter();
  const [state, setState] = useState<GradeFormState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const requestBody = {
      expertTakeId,
      outcomeType: getFormString(formData, "outcomeType"),
      grade: getFormString(formData, "grade"),
      confidence: getFormString(formData, "confidence"),
      outcomeValue: getFormString(formData, "outcomeValue"),
      outcomeDate: getFormString(formData, "outcomeDate"),
      notes: getFormString(formData, "notes"),
    };
    const validationError = validateRequestBody(requestBody);

    if (validationError) {
      setState({ status: "error", message: validationError });
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch(TAKE_OUTCOME_API_URL, {
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
            `Outcome grade could not be saved. Server returned ${response.status}.`,
        });
        return;
      }

      setState({
        status: "success",
        message: `Saved grade for ${payload.summary?.expertName ?? "expert"}.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Outcome grade could not be saved: ${error.message}`
            : "Outcome grade could not be saved.",
      });
    }
  }

  return (
    <form className="grid gap-3" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Outcome Type
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue="MANUAL"
            name="outcomeType"
            required
          >
            {outcomeTypeOptions.map((option) => (
              <option key={option} value={option}>
                {formatEnumLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Grade
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue="NEEDS_REVIEW"
            name="grade"
            required
          >
            {gradeOptions.map((option) => (
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
            defaultValue="0.5"
            max="1"
            min="0"
            name="confidence"
            step="0.05"
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Outcome Value
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            name="outcomeValue"
            placeholder="Example: WR18 finish, 14.6 points, missed 3 games"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Outcome Date
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            name="outcomeDate"
            type="date"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Notes
        <textarea
          className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          name="notes"
          placeholder="Why this grade was chosen."
        />
      </label>
      <button
        className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 md:w-fit"
        disabled={state.status === "loading"}
        type="submit"
      >
        {state.status === "loading" ? "Saving Grade" : "Save Grade"}
      </button>
      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          {state.message}
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

function validateRequestBody(requestBody: {
  outcomeType: string;
  grade: string;
  confidence: string;
}) {
  if (!requestBody.outcomeType) return "Select an outcome type.";
  if (!requestBody.grade) return "Select an outcome grade.";

  const confidence = Number(requestBody.confidence);

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return "Confidence must be a number from 0 to 1.";
  }

  return null;
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
