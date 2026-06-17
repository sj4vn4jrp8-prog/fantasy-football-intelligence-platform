import type { ProjectionProvider } from "@/domain/fantasy";

export class SportsDataIOProvider implements ProjectionProvider {
  readonly name = "SPORTSDATAIO" as const;

  constructor(private readonly apiKey?: string) {}

  isEnabled() {
    return Boolean(this.apiKey);
  }

  async getPlayerProjections(): Promise<unknown[]> {
    throw new Error("SportsDataIO projection provider is not implemented yet.");
  }
}
