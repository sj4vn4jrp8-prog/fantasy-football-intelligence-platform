import Link from "next/link";
import type { ReactNode } from "react";
import { MarkdownTranscriptImportForm } from "@/components/knowledge-brain/MarkdownTranscriptImportForm";

export const dynamic = "force-dynamic";

export default function MarkdownTranscriptImportPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/knowledge-brain"
            >
              Back to Knowledge Brain
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/import-markdown/bulk"
            >
              Bulk Markdown Import
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
              Local Transcript Import
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Import Markdown Transcript
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-zinc-600">
              Paste a Markdown transcript created locally. The app does not call
              YouTube or transcript providers from this page.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <Card title="Paste Markdown">
          <MarkdownTranscriptImportForm />
        </Card>

        <div className="grid gap-4">
          <Card title="Expected Header">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-700">
              <p>---</p>
              <p>expert: &quot;Fantasy Footballers&quot;</p>
              <p>channel: &quot;The Fantasy Footballers&quot;</p>
              <p>title: &quot;Example Video&quot;</p>
              <p>date: &quot;2026-06-23&quot;</p>
              <p>runtime: &quot;1:02:14&quot;</p>
              <p>url: &quot;https://www.youtube.com/watch?v=...&quot;</p>
              <p>video_id: &quot;abc123...&quot;</p>
              <p>source_platform: &quot;YouTube&quot;</p>
              <p>---</p>
            </div>
          </Card>

          <Card title="Compliance Notes">
            <div className="grid gap-3 text-sm text-zinc-600">
              <p>
                This importer treats Markdown as user-provided local content.
              </p>
              <p>
                YouTube discovery and transcript fetching should happen only
                from the local Python companion script.
              </p>
              <p>
                Do not run the fetcher from deployed app servers, API routes,
                cloud notebooks, or serverless jobs.
              </p>
            </div>
          </Card>

          <Card title="Have Multiple Files?">
            <Link
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              href="/knowledge-brain/import-markdown/bulk"
            >
              Open Bulk Import
            </Link>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
