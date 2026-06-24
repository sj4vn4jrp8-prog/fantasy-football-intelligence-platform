import Link from "next/link";
import type { ReactNode } from "react";
import { BulkMarkdownTranscriptImportForm } from "@/components/knowledge-brain/BulkMarkdownTranscriptImportForm";

export const dynamic = "force-dynamic";

export default function BulkMarkdownTranscriptImportPage() {
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
              href="/knowledge-brain/import-markdown"
            >
              Single Markdown Import
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
              Local Transcript Import
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Bulk Markdown Import
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-zinc-600">
              Upload Markdown transcript files saved by the local fetcher. The
              app reads the files you choose and does not call YouTube.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <Card title="Upload Markdown Files">
          <BulkMarkdownTranscriptImportForm />
        </Card>

        <div className="grid gap-4">
          <Card title="How Duplicates Work">
            <div className="grid gap-3 text-sm text-zinc-600">
              <p>
                Bulk import skips files whose YouTube video ID or URL already
                exists in the Knowledge Brain.
              </p>
              <p>
                This keeps reruns safe when you select a folder of transcripts
                that overlaps with previously imported files.
              </p>
            </div>
          </Card>

          <Card title="Safety Notes">
            <div className="grid gap-3 text-sm text-zinc-600">
              <p>Only `.md` files are accepted.</p>
              <p>Import up to 25 files at a time.</p>
              <p>No scraping, YouTube calls, or paid APIs run from this page.</p>
            </div>
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
