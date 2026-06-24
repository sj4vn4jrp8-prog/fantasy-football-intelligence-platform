export type TranscriptSourceKind = "MANUAL" | "YOUTUBE" | "TRANSCRIPT_API";

export type ManualTranscriptInput = {
  expertId: string;
  title: string;
  url?: string;
  publishedAt?: Date | null;
  transcript: string;
};

export type TranscriptSourceResult = {
  active: boolean;
  source: TranscriptSourceKind;
  message: string;
};

export interface TranscriptSource {
  readonly source: TranscriptSourceKind;
  getStatus(): TranscriptSourceResult;
}

export class ManualTranscriptSource implements TranscriptSource {
  readonly source = "MANUAL" as const;

  getStatus(): TranscriptSourceResult {
    return {
      active: true,
      source: this.source,
      message: "Manual transcript paste is active.",
    };
  }

  normalizeInput(input: ManualTranscriptInput) {
    return {
      expertId: input.expertId.trim(),
      title: input.title.trim(),
      url: normalizeOptionalText(input.url),
      publishedAt: input.publishedAt ?? null,
      transcript: input.transcript.trim(),
    };
  }
}

export class YouTubeTranscriptSource implements TranscriptSource {
  readonly source = "YOUTUBE" as const;

  getStatus(): TranscriptSourceResult {
    return {
      active: false,
      source: this.source,
      message:
        "YouTube discovery and transcript ingestion are scaffolded but not active.",
    };
  }
}

export class TranscriptApiSource implements TranscriptSource {
  readonly source = "TRANSCRIPT_API" as const;

  getStatus(): TranscriptSourceResult {
    return {
      active: false,
      source: this.source,
      message:
        "Third-party transcript API ingestion is scaffolded but not active.",
    };
  }
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}
