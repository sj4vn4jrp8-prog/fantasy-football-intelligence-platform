export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
            Draft preferences and integrations
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
            This page will become the home for league preferences, draft
            strategy defaults, user preferences, and provider connections. For
            now, the controls remain lightweight while the draft workflow takes
            shape.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-6 sm:px-6 md:grid-cols-2 lg:px-8">
        <SettingsCard
          detail="Default scoring format, roster requirements, and league-specific draft assumptions will live here."
          title="League Preferences"
        />
        <SettingsCard
          detail="Strategy defaults such as balanced, upside, safe floor, Zero RB, and Hero RB will live here."
          title="Draft Strategy"
        />
        <SettingsCard
          detail="Future personalization controls can tune risk tolerance, preferred experts, and explanation depth."
          title="User Preferences"
        />
        <SettingsCard
          detail="Projection providers, ADP sources, and platform connections will be managed here as integrations mature."
          title="Integrations"
        />
      </section>
    </main>
  );
}

function SettingsCard({ detail, title }: { detail: string; title: string }) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{detail}</p>
      <span className="mt-4 inline-flex rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
        Placeholder
      </span>
    </section>
  );
}
