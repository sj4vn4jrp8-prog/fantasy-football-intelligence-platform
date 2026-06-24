import type { ProjectionProvider } from "@/domain/fantasy";

export interface FantasyNerdsProviderConfig {
  apiKey?: string;
  baseUrl?: string;
}

export interface FantasyNerdsAuthDiagnostic {
  configured: boolean;
  ok: boolean;
  targetUrl: string;
  httpStatus: number | null;
  responseSnippet?: string;
  errorMessage?: string;
}

const DEFAULT_FANTASY_NERDS_BASE_URL =
  "https://api.fantasynerds.com/v1/nfl";

export class FantasyNerdsProvider implements ProjectionProvider {
  readonly name = "FANTASY_NERDS" as const;

  constructor(private readonly config: FantasyNerdsProviderConfig = {}) {}

  isConfigured() {
    return Boolean(this.config.apiKey?.trim());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      baseUrl: getBaseUrl(this.config),
      baseUrlConfigured: Boolean(this.config.baseUrl?.trim()),
    };
  }

  async testAuthentication(): Promise<FantasyNerdsAuthDiagnostic> {
    const targetUrl = buildDiagnosticUrl(this.config);

    if (!this.isConfigured()) {
      return {
        configured: false,
        ok: false,
        targetUrl: redactApiKey(targetUrl.toString()),
        httpStatus: null,
        responseSnippet: "FANTASY_NERDS_API_KEY is not configured.",
      };
    }

    try {
      const response = await fetch(targetUrl, {
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      });
      const responseText = await response.text().catch(() => "");

      return {
        configured: true,
        ok: response.ok,
        targetUrl: redactApiKey(targetUrl.toString()),
        httpStatus: response.status,
        responseSnippet: getSafeSnippet(responseText),
      };
    } catch (error) {
      return {
        configured: true,
        ok: false,
        targetUrl: redactApiKey(targetUrl.toString()),
        httpStatus: null,
        errorMessage: getSafeSnippet(getErrorMessage(error)),
      };
    }
  }

  async getPlayerProjections(): Promise<unknown[]> {
    throw new Error("Fantasy Nerds projection import is not implemented yet.");
  }
}

function buildDiagnosticUrl(config: FantasyNerdsProviderConfig) {
  const url = new URL(`${getBaseUrl(config)}/byes`);
  url.searchParams.set("apikey", config.apiKey?.trim() ?? "");

  return url;
}

function getBaseUrl(config: FantasyNerdsProviderConfig) {
  return (config.baseUrl?.trim() || DEFAULT_FANTASY_NERDS_BASE_URL).replace(
    /\/$/,
    "",
  );
}

function getSafeSnippet(value: string) {
  return redactApiKey(value).slice(0, 500);
}

function redactApiKey(value: string) {
  return value.replace(/([?&]apikey=)[^&\s"']*/gi, "$1[REDACTED]");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
