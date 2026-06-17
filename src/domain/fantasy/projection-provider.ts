import type { ProjectionProviderName } from "./models";

export interface ProjectionProvider {
  readonly name: ProjectionProviderName;

  getPlayerProjections(...args: unknown[]): Promise<unknown[]>;
  getRankings?(...args: unknown[]): Promise<unknown[]>;
  getInjuries?(...args: unknown[]): Promise<unknown[]>;
  getNews?(...args: unknown[]): Promise<unknown[]>;
}
