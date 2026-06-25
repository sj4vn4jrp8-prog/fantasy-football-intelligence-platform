import Link from "next/link";
import { ExpertManagementWorkspace } from "@/components/knowledge-brain/ExpertManagementWorkspace";
import { getExpertManagementDashboard } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

export default async function ExpertManagementPage() {
  const experts = await getExpertManagementDashboard();

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/knowledge-brain/experts"
            >
              Back to Expert Directory
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain"
            >
              Knowledge Brain
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Expert Management
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Manage Knowledge Brain Experts
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem label="Experts" value={String(experts.length)} />
              <SummaryItem
                label="Active"
                value={String(experts.filter((expert) => expert.active).length)}
              />
              <SummaryItem
                label="Archived"
                value={String(experts.filter((expert) => !expert.active).length)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <ExpertManagementWorkspace experts={experts} />
      </section>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}
