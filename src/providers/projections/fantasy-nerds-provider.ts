import type { ProjectionProvider } from "@/domain/fantasy";

export class FantasyNerdsProvider implements ProjectionProvider {
  readonly name = "FANTASY_NERDS" as const;

  constructor(private readonly apiKey?: string) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async getPlayerProjections(): Promise<unknown[]> {
    throw new Error("Fantasy Nerds projection provider is not implemented yet.");
  }
}
