import type { ProjectionProvider } from "@/domain/fantasy";

export interface FantasyProsProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class FantasyProsProvider implements ProjectionProvider {
  readonly name = "FANTASYPROS" as const;

  constructor(private readonly config: FantasyProsProviderConfig = {}) {}

  isConfigured() {
    return Boolean(this.config.apiKey?.trim());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      baseUrlConfigured: Boolean(this.config.baseUrl?.trim()),
    };
  }

  async getPlayerProjections(): Promise<unknown[]> {
    throw new Error("FantasyPros projection import is not implemented yet.");
  }
}
