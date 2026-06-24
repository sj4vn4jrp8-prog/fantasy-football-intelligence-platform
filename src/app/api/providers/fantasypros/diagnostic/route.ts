import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { FantasyProsProvider } from "@/providers/projections/fantasypros-provider";

export async function GET() {
  const provider = new FantasyProsProvider({
    apiKey: env.fantasyProsApiKey,
    baseUrl: env.fantasyProsBaseUrl,
  });

  const diagnostic = await provider.testAuthentication();

  return NextResponse.json({
    provider: "FANTASYPROS",
    diagnostic,
  });
}
