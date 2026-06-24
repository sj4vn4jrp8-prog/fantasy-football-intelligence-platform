"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ExpertManagementItem = {
  id: string;
  name: string;
  active: boolean;
  notes: string | null;
  tags: string[];
  channels: Array<{
    id: string;
    url: string | null;
  }>;
  _count: {
    sourceVideos: number;
    expertTakes: number;
  };
};

type SaveState = Record<string, "idle" | "loading" | "success" | "error">;

export function ExpertManagementPanel({
  experts,
}: {
  experts: ExpertManagementItem[];
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<SaveState>({});

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    expertId: string,
  ) {
    event.preventDefault();
    setSaveState((current) => ({ ...current, [expertId]: "loading" }));

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/knowledge-brain/experts/${expertId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          active: formData.get("active") === "on",
          notes: formData.get("notes"),
          tags: formData.get("tags"),
          channelUrl: formData.get("channelUrl"),
        }),
      });

      if (!response.ok) {
        setSaveState((current) => ({ ...current, [expertId]: "error" }));
        return;
      }

      setSaveState((current) => ({ ...current, [expertId]: "success" }));
      router.refresh();
    } catch {
      setSaveState((current) => ({ ...current, [expertId]: "error" }));
    }
  }

  return (
    <div className="grid gap-3">
      {experts.map((expert) => (
        <form
          className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
          key={expert.id}
          onSubmit={(event) => handleSubmit(event, expert.id)}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-zinc-950">{expert.name}</h3>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    expert.active
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {expert.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {expert._count.sourceVideos} transcripts,{" "}
                {expert._count.expertTakes} takes
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4 rounded border-zinc-300"
                defaultChecked={expert.active}
                name="active"
                type="checkbox"
              />
              Active
            </label>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Notes
              <textarea
                className="min-h-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={expert.notes ?? ""}
                name="notes"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Tags
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={expert.tags.join(", ")}
                name="tags"
                placeholder="podcast, rankings"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Channel URL
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={expert.channels[0]?.url ?? ""}
                name="channelUrl"
                placeholder="https://..."
                type="url"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="h-9 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              disabled={saveState[expert.id] === "loading"}
              type="submit"
            >
              {saveState[expert.id] === "loading" ? "Saving" : "Save Expert"}
            </button>
            {saveState[expert.id] === "success" ? (
              <span className="text-sm font-medium text-emerald-700">
                Saved
              </span>
            ) : null}
            {saveState[expert.id] === "error" ? (
              <span className="text-sm font-medium text-red-700">
                Could not save
              </span>
            ) : null}
          </div>
        </form>
      ))}
    </div>
  );
}
