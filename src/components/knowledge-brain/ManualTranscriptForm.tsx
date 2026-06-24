"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ExpertOption = {
  id: string;
  name: string;
  active: boolean;
};

type ManualTranscriptSummary = {
  expertName: string;
  videoTitle: string;
  segmentsCreated: number;
  takesCreated: number;
  playersMentioned: number;
};

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; summary: ManualTranscriptSummary }
  | { status: "error"; message: string };

const MANUAL_TRANSCRIPT_API_URL = "/api/knowledge-brain/manual-transcript";

export function ManualTranscriptForm({ experts }: { experts: ExpertOption[] }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const requestBody = {
      expertId: getFormString(formData, "expertId"),
      title: getFormString(formData, "title"),
      url: getFormString(formData, "url"),
      publishedAt: getFormString(formData, "publishedAt"),
      transcript: getFormString(formData, "transcript"),
    };
    const validationError = validateManualTranscriptPayload(requestBody);

    if (validationError) {
      setState({ status: "error", message: validationError });
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch(MANUAL_TRANSCRIPT_API_URL, {
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
            `Transcript could not be saved. Server returned ${response.status}.`,
        });
        return;
      }

      form.reset();
      setState({ status: "success", summary: payload.summary });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Transcript could not be saved before the request completed: ${error.message}`
            : "Transcript could not be saved before the request completed.",
      });
    }
  }

  return (
    <form className="grid gap-3" noValidate onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Expert
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            name="expertId"
            required
          >
            <option value="">Select expert</option>
            {experts.map((expert) => (
              <option disabled={!expert.active} key={expert.id} value={expert.id}>
                {expert.name}
                {expert.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Publish Date
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            name="publishedAt"
            required
            type="date"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Video Title
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          name="title"
          placeholder="Week 1 starts, fades, sleepers..."
          required
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Video URL
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          name="url"
          placeholder="https://..."
          required
          type="url"
        />
      </label>

      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Transcript
        <textarea
          className="min-h-52 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          name="transcript"
          placeholder="Paste transcript text here."
          required
        />
      </label>

      <button
        className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 md:w-fit"
        disabled={state.status === "loading"}
        type="submit"
      >
        {state.status === "loading" ? "Saving Transcript" : "Save Transcript"}
      </button>

      {state.status === "success" ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Saved {state.summary.videoTitle} from {state.summary.expertName}.
          Created {state.summary.segmentsCreated} segments,{" "}
          {state.summary.takesCreated} takes, and matched{" "}
          {state.summary.playersMentioned} players.
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

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function validateManualTranscriptPayload(payload: {
  expertId: string;
  title: string;
  url: string;
  publishedAt: string;
  transcript: string;
}) {
  if (!payload.expertId) return "Select an expert before saving.";
  if (!payload.title) return "Enter a video title before saving.";
  if (!payload.url) return "Enter the video URL before saving.";
  if (!isValidHttpUrl(payload.url)) {
    return "Enter a valid video URL that starts with http:// or https://.";
  }
  if (!payload.publishedAt) return "Choose the publish date before saving.";
  if (!payload.transcript) return "Paste transcript text before saving.";

  return null;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
