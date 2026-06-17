import type { ProjectionProvider } from "@/domain/fantasy";

export class FantasyDataProvider implements ProjectionProvider {
  readonly name = "FANTASYDATA" as const;

  constructor(private readonly apiKey?: string) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async getPlayerProjections(): Promise<unknown[]> {
    throw new Error("FantasyData projection provider is not implemented yet.");
  }
}
