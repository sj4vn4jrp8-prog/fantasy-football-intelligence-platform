export type ProjectionMode = "SELECTED_PROVIDER" | "CONSENSUS";

export interface ProjectionContext {
  season: number;
  week: number;
  provider?: string;
  mode?: ProjectionMode;
}

export interface SelectableProjection {
  id: string;
  playerId: string;
  season: number;
  week: number;
  provider: string;
  projectedFantasyPoints?: number | null;
}

export interface ProjectionSelectionInput<TProjection extends SelectableProjection> {
  projections: TProjection[];
  playerId: string;
  context: ProjectionContext;
  providerPreference?: string[];
}

export interface ProjectionSelectionResult<
  TProjection extends SelectableProjection,
> {
  projection: TProjection | undefined;
  availableProviders: string[];
  hasAnyProjectionForPlayer: boolean;
  hasProjectionForSelectedWeek: boolean;
}

const DEFAULT_PROVIDER_PREFERENCE = [
  "FANTASYPROS",
  "FANTASY_NERDS",
  "FANTASYDATA",
  "SPORTSDATAIO",
  "MOCK",
];

export function selectProjection<TProjection extends SelectableProjection>(
  input: ProjectionSelectionInput<TProjection>,
) {
  return getProjectionSelection(input).projection;
}

export function getProjectionSelection<
  TProjection extends SelectableProjection,
>({
  projections,
  playerId,
  context,
  providerPreference = DEFAULT_PROVIDER_PREFERENCE,
}: ProjectionSelectionInput<TProjection>): ProjectionSelectionResult<TProjection> {
  const playerProjections = projections.filter(
    (projection) => projection.playerId === playerId,
  );
  const weekProjections = playerProjections.filter(
    (projection) =>
      projection.season === context.season && projection.week === context.week,
  );
  const availableProviders = Array.from(
    new Set(weekProjections.map((projection) => projection.provider)),
  ).sort();

  if (context.provider) {
    return {
      projection: weekProjections.find(
        (projection) => projection.provider === context.provider,
      ),
      availableProviders,
      hasAnyProjectionForPlayer: playerProjections.length > 0,
      hasProjectionForSelectedWeek: weekProjections.length > 0,
    };
  }

  return {
    projection: [...weekProjections].sort((projectionA, projectionB) =>
      compareProviderPreference(projectionA, projectionB, providerPreference),
    )[0],
    availableProviders,
    hasAnyProjectionForPlayer: playerProjections.length > 0,
    hasProjectionForSelectedWeek: weekProjections.length > 0,
  };
}

function compareProviderPreference<TProjection extends SelectableProjection>(
  projectionA: TProjection,
  projectionB: TProjection,
  providerPreference: string[],
) {
  return (
    getProviderRank(projectionA.provider, providerPreference) -
      getProviderRank(projectionB.provider, providerPreference) ||
    (projectionB.projectedFantasyPoints ?? 0) -
      (projectionA.projectedFantasyPoints ?? 0) ||
    projectionA.provider.localeCompare(projectionB.provider) ||
    projectionA.id.localeCompare(projectionB.id)
  );
}

function getProviderRank(provider: string, providerPreference: string[]) {
  const index = providerPreference.indexOf(provider);
  return index === -1 ? providerPreference.length : index;
}
