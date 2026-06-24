import { env } from "@/lib/env";
import { FantasyNerdsProvider } from "./fantasy-nerds-provider";
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
  const fantasyNerds = new FantasyNerdsProvider({
    apiKey: env.fantasyNerdsApiKey,
    baseUrl: env.fantasyNerdsBaseUrl,
  });
  const fantasyNerdsStatus = fantasyNerds.getStatus();

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
      status: fantasyNerdsStatus.configured ? "Configured" : "Not configured",
      detail: fantasyNerdsStatus.configured
        ? "API key found server-side"
        : "Add FANTASY_NERDS_API_KEY to enable diagnostics",
    },
    {
      name: "FantasyData",
      status: "Not configured",
      detail: "Placeholder for future projection enrichment",
    },
  ];
}
