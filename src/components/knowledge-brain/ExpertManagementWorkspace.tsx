"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ManagedExpert = {
  id: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  youtubeChannelUrl: string | null;
  active: boolean;
  tags: string[];
  createdAt: Date;
  transcriptCount: number;
  takeCount: number;
};

type RequestState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function ExpertManagementWorkspace({
  experts,
}: {
  experts: ManagedExpert[];
}) {
  const router = useRouter();
  const [state, setState] = useState<RequestState>({ status: "idle" });
  const activeExperts = experts.filter((expert) => expert.active);
  const archivedExperts = experts.filter((expert) => !expert.active);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "loading", message: "Creating expert..." });

    const form = event.currentTarget;
    const requestBody = readExpertForm(form);

    try {
      const response = await fetch("/api/knowledge-brain/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Expert could not be created.",
        });
        return;
      }

      form.reset();
      setState({
        status: "success",
        message: `Created ${payload.summary?.expertName ?? "expert"}.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Expert could not be created: ${error.message}`
            : "Expert could not be created.",
      });
    }
  }

  async function handleEdit(
    event: FormEvent<HTMLFormElement>,
    expertId: string,
  ) {
    event.preventDefault();
    setState({ status: "loading", message: "Saving expert..." });

    try {
      const response = await fetch(`/api/knowledge-brain/experts/${expertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(readExpertForm(event.currentTarget)),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Expert could not be saved.",
        });
        return;
      }

      setState({
        status: "success",
        message: `Saved ${payload.summary?.expertName ?? "expert"}.`,
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Expert could not be saved: ${error.message}`
            : "Expert could not be saved.",
      });
    }
  }

  async function handleArchive(expert: ManagedExpert) {
    setState({ status: "loading", message: `Archiving ${expert.name}...` });

    try {
      const response = await fetch(`/api/knowledge-brain/experts/${expert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Expert could not be archived.",
        });
        return;
      }

      setState({ status: "success", message: `Archived ${expert.name}.` });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Expert could not be archived: ${error.message}`
            : "Expert could not be archived.",
      });
    }
  }

  async function handleReactivate(expert: ManagedExpert) {
    setState({ status: "loading", message: `Reactivating ${expert.name}...` });

    try {
      const response = await fetch(`/api/knowledge-brain/experts/${expert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Expert could not be reactivated.",
        });
        return;
      }

      setState({ status: "success", message: `Reactivated ${expert.name}.` });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Expert could not be reactivated: ${error.message}`
            : "Expert could not be reactivated.",
      });
    }
  }

  async function handleDelete(expert: ManagedExpert) {
    const hasHistory = expert.transcriptCount > 0 || expert.takeCount > 0;
    const message = hasHistory
      ? `Delete ${expert.name} and its ${expert.transcriptCount} transcript(s) and ${expert.takeCount} take(s)? This cannot be undone.`
      : `Delete ${expert.name}? This cannot be undone.`;

    if (!window.confirm(message)) return;

    setState({ status: "loading", message: `Deleting ${expert.name}...` });

    try {
      const response = await fetch(`/api/knowledge-brain/experts/${expert.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmHistory: hasHistory }),
      });
      const payload = await readJsonResponse(response);

      if (!response.ok) {
        setState({
          status: "error",
          message: payload.error ?? "Expert could not be deleted.",
        });
        return;
      }

      setState({ status: "success", message: `Deleted ${expert.name}.` });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? `Expert could not be deleted: ${error.message}`
            : "Expert could not be deleted.",
      });
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Add Expert</h2>
        <form className="mt-4 grid gap-3" onSubmit={handleCreate}>
          <ExpertFields />
          <button
            className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400 md:w-fit"
            disabled={state.status === "loading"}
            type="submit"
          >
            Add Expert
          </button>
        </form>
      </section>

      {state.status !== "idle" ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            state.status === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : state.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-zinc-200 bg-zinc-50 text-zinc-700"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Active Experts</h2>
        <ExpertList
          emptyMessage="No active experts found."
          experts={activeExperts}
          handleArchive={handleArchive}
          handleDelete={handleDelete}
          handleEdit={handleEdit}
          handleReactivate={handleReactivate}
          loading={state.status === "loading"}
        />
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-zinc-950">Archived Experts</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Archived experts stay in the database and can be reactivated later.
        </p>
        <ExpertList
          emptyMessage="No archived experts found."
          experts={archivedExperts}
          handleArchive={handleArchive}
          handleDelete={handleDelete}
          handleEdit={handleEdit}
          handleReactivate={handleReactivate}
          loading={state.status === "loading"}
        />
      </section>
    </div>
  );
}

function ExpertList({
  emptyMessage,
  experts,
  handleArchive,
  handleDelete,
  handleEdit,
  handleReactivate,
  loading,
}: {
  emptyMessage: string;
  experts: ManagedExpert[];
  handleArchive: (expert: ManagedExpert) => void;
  handleDelete: (expert: ManagedExpert) => void;
  handleEdit: (
    event: FormEvent<HTMLFormElement>,
    expertId: string,
  ) => void;
  handleReactivate: (expert: ManagedExpert) => void;
  loading: boolean;
}) {
  if (experts.length === 0) {
    return (
      <div className="mt-4 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4">
      {experts.map((expert) => (
        <form
          className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
          key={expert.id}
          onSubmit={(event) => handleEdit(event, expert.id)}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-zinc-950">{expert.name}</h3>
                <StatusBadge active={expert.active} />
              </div>
              <p className="mt-1 text-sm text-zinc-600">
                {expert.transcriptCount} transcript
                {expert.transcriptCount === 1 ? "" : "s"}, {expert.takeCount}{" "}
                take{expert.takeCount === 1 ? "" : "s"} - created{" "}
                {formatDate(expert.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
                disabled={loading}
                type="submit"
              >
                Edit Expert
              </button>
              {expert.active ? (
                <button
                  className="h-9 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
                  disabled={loading}
                  onClick={() => handleArchive(expert)}
                  type="button"
                >
                  Archive
                </button>
              ) : (
                <button
                  className="h-9 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  disabled={loading}
                  onClick={() => handleReactivate(expert)}
                  type="button"
                >
                  Reactivate
                </button>
              )}
              <button
                className="h-9 rounded-md border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-800 transition hover:bg-red-100"
                disabled={loading}
                onClick={() => handleDelete(expert)}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
          <ExpertFields expert={expert} />
        </form>
      ))}
    </div>
  );
}

function ExpertFields({ expert }: { expert?: ManagedExpert }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Name
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={expert?.name ?? ""}
          name="name"
          placeholder="Example: Reception Perception"
          required
        />
      </label>
      <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700">
        <input
          className="h-4 w-4"
          defaultChecked={expert?.active ?? true}
          name="active"
          type="checkbox"
        />
        Active
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700 lg:col-span-2">
        Description
        <textarea
          className="min-h-20 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={expert?.description ?? ""}
          name="description"
          placeholder="What this expert is known for."
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Website URL
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={expert?.websiteUrl ?? ""}
          name="websiteUrl"
          placeholder="https://..."
          type="url"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        YouTube Channel URL
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={expert?.youtubeChannelUrl ?? ""}
          name="youtubeChannelUrl"
          placeholder="https://youtube.com/..."
          type="url"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700 lg:col-span-2">
        Specialty Tags
        <input
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={expert?.tags.join(", ") ?? ""}
          name="tags"
          placeholder="rankings, film, dynasty"
        />
      </label>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs font-semibold ${
        active
          ? "bg-emerald-100 text-emerald-800"
          : "bg-zinc-200 text-zinc-700"
      }`}
    >
      {active ? "Active" : "Archived"}
    </span>
  );
}

function readExpertForm(form: HTMLFormElement) {
  const formData = new FormData(form);

  return {
    name: getFormString(formData, "name"),
    description: getFormString(formData, "description"),
    websiteUrl: getFormString(formData, "websiteUrl"),
    youtubeChannelUrl: getFormString(formData, "youtubeChannelUrl"),
    active: formData.get("active") === "on",
    tags: getFormString(formData, "tags"),
  };
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}
