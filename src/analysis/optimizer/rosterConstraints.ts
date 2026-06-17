import type { Position } from "@/domain/fantasy";

export type RosterSettingsInput = {
  qb?: number | null;
  rb?: number | null;
  wr?: number | null;
  te?: number | null;
  flex?: number | null;
  superflex?: number | null;
  twoQb?: boolean | null;
  k?: number | null;
  dst?: number | null;
  idp?: number | null;
};

export interface LineupSlot {
  id: string;
  label: string;
  eligiblePositions: Array<Position | string>;
}

export function buildLineupSlots(
  settings?: RosterSettingsInput | null,
): LineupSlot[] {
  const qbCount = getSlotCount(settings?.qb) + (settings?.twoQb ? 1 : 0);

  return [
    ...repeatSlot("QB", qbCount, ["QB"]),
    ...repeatSlot("RB", settings?.rb, ["RB"]),
    ...repeatSlot("WR", settings?.wr, ["WR"]),
    ...repeatSlot("TE", settings?.te, ["TE"]),
    ...repeatSlot("FLEX", settings?.flex, ["RB", "WR", "TE"]),
    ...repeatSlot("SUPER_FLEX", settings?.superflex, [
      "QB",
      "RB",
      "WR",
      "TE",
    ]),
    ...repeatSlot("K", settings?.k, ["K", "PK"]),
    ...repeatSlot("DST", settings?.dst, ["DST", "DEF", "D/ST"]),
    ...repeatSlot("IDP", settings?.idp, ["DL", "LB", "DB", "IDP"]),
  ];
}

function repeatSlot(
  label: string,
  count: number | null | undefined,
  eligiblePositions: Array<Position | string>,
): LineupSlot[] {
  return Array.from({ length: getSlotCount(count) }, (_, index) => ({
    id: `${label}-${index + 1}`,
    label,
    eligiblePositions,
  }));
}

function getSlotCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}
