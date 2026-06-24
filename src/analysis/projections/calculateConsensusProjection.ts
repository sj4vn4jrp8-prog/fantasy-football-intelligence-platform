import type { ProjectionContext } from "./selectProjection";

export interface ConsensusProjectionInput<TProjection extends ConsensusProjectionSource> {
  projections: TProjection[];
  playerId: string;
  context: ProjectionContext;
}

export interface ConsensusProjectionSource {
  id: string;
  playerId: string;
  season: number;
  week: number;
  provider: string;
  projectedFantasyPoints?: number | null;
  confidence?: number | null;
}

export interface ConsensusProjection {
  playerId: string;
  season: number;
  week: number;
  providerCount: number;
  consensusProjectedFantasyPoints: number;
  minProjection: number;
  maxProjection: number;
  projectionSpread: number;
  providerAgreementScore: number;
  consensusConfidence: number;
  providers: string[];
  limitedBySingleProvider: boolean;
}

export function calculateConsensusProjection<
  TProjection extends ConsensusProjectionSource,
>({
  projections,
  playerId,
  context,
}: ConsensusProjectionInput<TProjection>): ConsensusProjection | undefined {
  const weekProjections = projections
    .filter(
      (projection) =>
        projection.playerId === playerId &&
        projection.season === context.season &&
        projection.week === context.week &&
        isUsableNumber(projection.projectedFantasyPoints),
    )
    .sort(
      (projectionA, projectionB) =>
        projectionA.provider.localeCompare(projectionB.provider) ||
        projectionA.id.localeCompare(projectionB.id),
    );

  if (weekProjections.length === 0) {
    return undefined;
  }

  const latestProjectionByProvider = new Map<string, TProjection>();

  for (const projection of weekProjections) {
    latestProjectionByProvider.set(projection.provider, projection);
  }

  const providerProjections = Array.from(latestProjectionByProvider.values());
  const pointValues = providerProjections.map(
    (projection) => projection.projectedFantasyPoints as number,
  );
  const providerCount = providerProjections.length;
  const consensusProjectedFantasyPoints = round(average(pointValues));
  const minProjection = round(Math.min(...pointValues));
  const maxProjection = round(Math.max(...pointValues));
  const projectionSpread = round(maxProjection - minProjection);
  const providerAgreementScore = calculateProviderAgreementScore({
    consensusProjectedFantasyPoints,
    projectionSpread,
  });
  const consensusConfidence = calculateConsensusConfidence({
    providerCount,
    providerAgreementScore,
    providerConfidenceValues: providerProjections.map(
      (projection) => projection.confidence,
    ),
  });

  return {
    playerId,
    season: context.season,
    week: context.week,
    providerCount,
    consensusProjectedFantasyPoints,
    minProjection,
    maxProjection,
    projectionSpread,
    providerAgreementScore,
    consensusConfidence,
    providers: providerProjections.map((projection) => projection.provider),
    limitedBySingleProvider: providerCount === 1,
  };
}

function calculateProviderAgreementScore({
  consensusProjectedFantasyPoints,
  projectionSpread,
}: {
  consensusProjectedFantasyPoints: number;
  projectionSpread: number;
}) {
  if (projectionSpread === 0) return 100;

  const spreadRatio =
    projectionSpread / Math.max(Math.abs(consensusProjectedFantasyPoints), 1);

  return round(clamp(100 - spreadRatio * 100, 0, 100));
}

function calculateConsensusConfidence({
  providerCount,
  providerAgreementScore,
  providerConfidenceValues,
}: {
  providerCount: number;
  providerAgreementScore: number;
  providerConfidenceValues: Array<number | null | undefined>;
}) {
  const providerConfidence = getAverageProviderConfidence(
    providerConfidenceValues,
  );

  if (providerCount === 1) {
    return round(Math.min(60, providerConfidence));
  }

  const providerCountBonus = Math.min(15, (providerCount - 1) * 5);

  return round(
    clamp(
      (providerAgreementScore + providerConfidence) / 2 + providerCountBonus,
      0,
      95,
    ),
  );
}

function getAverageProviderConfidence(
  values: Array<number | null | undefined>,
) {
  const usableValues = values
    .filter(isUsableNumber)
    .map((value) => (value <= 1 ? value * 100 : value));

  if (usableValues.length === 0) {
    return 60;
  }

  return average(usableValues);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
