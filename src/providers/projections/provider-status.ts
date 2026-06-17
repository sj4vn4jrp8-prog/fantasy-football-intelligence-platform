import { env } from "@/lib/env";
import { FantasyProsProvider } from "./fantasypros-provider";

export type ProjectionProviderStatus = {
  name: string;
  status: "Configured" | "Not configured";
  detail: string;
};

export function getProjectionProviderStatuses(): ProjectionProviderStatus[] {
  const fantasyPros = new FantasyProsProvider({
    apiKey: env.fantasyProsApiKey,
    baseUrl: env.fantasyProsBaseUrl,
  });
  const fantasyProsStatus = fantasyPros.getStatus();

  return [
    {
      name: "FantasyPros",
      status: fantasyProsStatus.configured ? "Configured" : "Not configured",
      detail: fantasyProsStatus.configured
        ? "API key found server-side"
        : "Add FANTASYPROS_API_KEY to enable later imports",
    },
    {
      name: "Fantasy Nerds",
      status: "Not configured",
      detail: "Placeholder for future projection enrichment",
    },
    {
      name: "FantasyData",
      status: "Not configured",
      detail: "Placeholder for future projection enrichment",
    },
  ];
}
