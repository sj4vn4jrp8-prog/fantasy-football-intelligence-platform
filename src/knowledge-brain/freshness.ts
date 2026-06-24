export type ContentFreshnessLabel =
  | "CURRENT"
  | "RECENT"
  | "STALE"
  | "HISTORICAL"
  | "ARCHIVED";

export type FreshnessContext = {
  targetSeason?: number;
  now?: Date;
  archived?: boolean;
};

export type FreshnessResult = {
  publishDate: Date | null;
  contentSeason: number | null;
  freshnessLabel: ContentFreshnessLabel;
  includeInCurrentAnalysis: boolean;
};

const RECENT_DAYS = 90;
const HISTORICAL_DAYS = 365;

export function getDefaultTargetSeason(now = new Date()) {
  return now.getFullYear();
}

export function normalizeTargetSeason(value?: number | string | null) {
  const parsedValue =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  const currentSeason = getDefaultTargetSeason();

  if (!Number.isInteger(parsedValue)) return currentSeason;
  if (parsedValue < 2000 || parsedValue > currentSeason + 2) {
    return currentSeason;
  }

  return parsedValue;
}

export function calculateContentFreshness(
  publishDateInput: Date | string | null | undefined,
  context: FreshnessContext = {},
): FreshnessResult {
  const now = context.now ?? new Date();
  const targetSeason = normalizeTargetSeason(context.targetSeason);
  const publishDate = normalizePublishDate(publishDateInput);
  const contentSeason = publishDate?.getFullYear() ?? null;

  if (context.archived) {
    return {
      publishDate,
      contentSeason,
      freshnessLabel: "ARCHIVED",
      includeInCurrentAnalysis: false,
    };
  }

  if (!publishDate) {
    return {
      publishDate: null,
      contentSeason: null,
      freshnessLabel: "STALE",
      includeInCurrentAnalysis: false,
    };
  }

  const targetSeasonStart = new Date(Date.UTC(targetSeason, 0, 1));
  const ageInDays = getAgeInDays(publishDate, now);
  let freshnessLabel: ContentFreshnessLabel;

  if (publishDate >= targetSeasonStart) {
    freshnessLabel = "CURRENT";
  } else if (ageInDays <= RECENT_DAYS) {
    freshnessLabel = "RECENT";
  } else if (ageInDays > HISTORICAL_DAYS) {
    freshnessLabel = "HISTORICAL";
  } else {
    freshnessLabel = "STALE";
  }

  return {
    publishDate,
    contentSeason,
    freshnessLabel,
    includeInCurrentAnalysis:
      freshnessLabel === "CURRENT" || freshnessLabel === "RECENT",
  };
}

export function getFreshnessOptions() {
  return ["CURRENT", "RECENT", "STALE", "HISTORICAL", "ARCHIVED"] as const;
}

export function shouldIncludeFreshnessLabel({
  label,
  selectedFreshness,
}: {
  label: ContentFreshnessLabel;
  selectedFreshness?: string | null;
}) {
  if (!selectedFreshness || selectedFreshness === "ALL") return true;

  return label === selectedFreshness;
}

function normalizePublishDate(value: Date | string | null | undefined) {
  if (!value) return null;

  const parsedDate = value instanceof Date ? value : new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getAgeInDays(publishDate: Date, now: Date) {
  return Math.floor(
    (startOfDayUtc(now).getTime() - startOfDayUtc(publishDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );
}

function startOfDayUtc(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
