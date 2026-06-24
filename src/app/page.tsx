import Link from "next/link";
import { SleeperImportForm } from "@/components/league/SleeperImportForm";
import { getProjectionProviderStatuses } from "@/providers/projections/provider-status";

export default function Home() {
  const projectionProviderStatuses = getProjectionProviderStatuses();

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Free mode
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Fantasy Matchup Analyzer
              </h1>
            </div>
            <div className="grid gap-3">
              <Link
                className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                href="/knowledge-brain"
              >
                Open Knowledge Brain
              </Link>
              <SleeperImportForm />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-md border border-zinc-200 bg-white p-4">
          <nav className="grid gap-1 text-sm font-medium text-zinc-700">
            {[
              "Setup",
              "Matchups",
              "Optimizer",
              "Scoring",
              "Providers",
              "Audit Log",
            ].map((item, index) => (
              <a
                className={`rounded-md px-3 py-2 ${
                  index === 0
                    ? "bg-emerald-50 text-emerald-800"
                    : "hover:bg-zinc-100"
                }`}
                href="#"
                key={item}
              >
                {item}
              </a>
            ))}
          </nav>
        </aside>

        <div className="grid gap-4">
          <section className="grid gap-4 md:grid-cols-3">
            <Metric label="League source" value="Sleeper" tone="emerald" />
            <Metric label="Provider tier" value="Free" tone="sky" />
            <Metric label="MVP focus" value="Weekly starters" tone="amber" />
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-zinc-950">
                  Weekly Matchup
                </h2>
                <span className="text-sm font-medium text-zinc-500">
                  Awaiting import
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {[
                  ["QB", "Starter slot", "Projection pending"],
                  ["RB", "Starter slot", "Projection pending"],
                  ["WR", "Starter slot", "Projection pending"],
                  ["TE", "Starter slot", "Projection pending"],
                  ["FLEX", "Starter slot", "Projection pending"],
                ].map(([slot, label, status]) => (
                  <div
                    className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-zinc-200 px-3 py-3"
                    key={slot}
                  >
                    <span className="text-sm font-semibold text-zinc-950">
                      {slot}
                    </span>
                    <span className="truncate text-sm text-zinc-600">
                      {label}
                    </span>
                    <span className="text-xs font-medium text-zinc-500">
                      {status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-zinc-950">
                Recommendation
              </h2>
              <div className="mt-5 grid gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500">
                    Confidence
                  </p>
                  <div className="mt-2 h-3 rounded-full bg-zinc-100">
                    <div className="h-3 w-[62%] rounded-full bg-emerald-600" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <RangeValue label="Floor" value="--" />
                  <RangeValue label="Median" value="--" />
                  <RangeValue label="Ceiling" value="--" />
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Import a league to generate lineup explanations from scoring,
                  injury risk, bye weeks, and matchup context.
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-zinc-200 bg-white p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-zinc-950">
                Provider Status
              </h2>
              <span className="text-sm font-medium text-zinc-500">
                Keys stored server-side only
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {projectionProviderStatuses.map((provider) => (
                <ProviderStatus
                  detail={provider.detail}
                  key={provider.name}
                  name={provider.name}
                  status={provider.status}
                />
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "sky" | "amber";
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    sky: "border-sky-200 bg-sky-50 text-sky-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
  };

  return (
    <div className={`rounded-md border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function RangeValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function ProviderStatus({
  name,
  status,
  detail,
}: {
  name: string;
  status: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-zinc-950">{name}</p>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{detail}</p>
    </div>
  );
}
