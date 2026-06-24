import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { FantasyNerdsProvider } from "@/providers/projections/fantasy-nerds-provider";

export async function GET() {
  const provider = new FantasyNerdsProvider({
    apiKey: env.fantasyNerdsApiKey,
    baseUrl: env.fantasyNerdsBaseUrl,
  });

  const diagnostic = await provider.testAuthentication();

  return NextResponse.json({
    provider: "FANTASY_NERDS",
    diagnostic,
  });
}
