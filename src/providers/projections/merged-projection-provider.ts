import type { PlayerProjection, ProjectionProvider } from "@/domain/fantasy";

export class MergedProjectionProvider {
  constructor(private readonly providers: ProjectionProvider[]) {}

  async getMergedProjections(week: number, season?: number) {
    const projectionsByProvider = await Promise.all(
      this.providers.map(async (provider) => ({
        provider: provider.name,
        projections: (await provider.getPlayerProjections(
          week,
          season,
        )) as PlayerProjection[],
      })),
    );

    const grouped = new Map<string, PlayerProjection[]>();

    for (const { projections } of projectionsByProvider) {
      for (const projection of projections) {
        grouped.set(projection.playerId, [
          ...(grouped.get(projection.playerId) ?? []),
          projection,
        ]);
      }
    }

    return Array.from(grouped.values()).map((projections) =>
      mergeProjectionDisagreement(projections),
    );
  }
}

function mergeProjectionDisagreement(
  projections: PlayerProjection[],
): PlayerProjection {
  const primary = projections[0];
  const providerPoints = Object.fromEntries(
    projections
      .filter((projection) => projection.projectedFantasyPoints !== undefined)
      .map((projection) => [
        projection.source.provider,
        projection.projectedFantasyPoints,
      ]),
  );
  const pointValues = Object.values(providerPoints).filter(
    (value): value is number => typeof value === "number",
  );
  const variance = calculateVariance(pointValues);

  return {
    ...primary,
    providerPoints,
    projectionVariance: variance,
    confidence: pointValues.length > 1 ? Math.max(0.35, 1 - variance / 25) : 0.6,
  };
}

function calculateVariance(values: number[]) {
  if (values.length <= 1) return 0;

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
    values.length;

  return Number(variance.toFixed(2));
}
