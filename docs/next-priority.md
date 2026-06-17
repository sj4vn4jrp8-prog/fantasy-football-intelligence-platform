# Next Priority

## Recommended Next Feature

Build the real projection import pipeline, starting with one provider integration behind the existing provider-neutral projection interface.

The best first target is FantasyPros if API access is available. If FantasyPros access is not available yet, keep the same importer shape and continue using the mock provider as the test provider until a real key is ready.

## Why It Matters

The app now has the analysis path in place:

1. Import league structure.
2. Import or generate projections.
3. Convert projections into league-adjusted fantasy points.
4. Optimize starters.
5. Compare weekly matchups.
6. Add confidence and variance context.

The biggest current gap is data quality. Real projections will make every existing feature more useful without requiring a new user-facing workflow.

This also unlocks the next layer of product value: consensus projections, provider disagreement, variance, and recommendation confidence that reflects real market uncertainty instead of mock ranges.

## Suggested Implementation Order

1. Confirm provider access and terms.

   Decide which real provider is available first, verify API terms, and confirm what data can legally be stored and displayed.

2. Finalize a normalized projection import shape.

   Keep the provider response isolated inside `src/providers/projections/`. Convert provider-specific fields into the existing `PlayerProjection` shape before saving.

3. Add provider-side player matching.

   Match provider player IDs to internal `Player` records through `PlayerExternalIdentity`. Use conservative fallback matching by name, team, and position only when there is no exact external identity.

4. Add an API route or server action for real projection import.

   Follow the same pattern as mock projection import: choose league and week, import projections only for rostered players first, and save with provider, season, week, source timestamp, floor, median, ceiling, confidence, and projected stats.

5. Preserve provider disagreement.

   Do not overwrite mock or other provider projections. Store one row per player, season, week, and provider so the UI can compare providers later.

6. Add provider comparison UI.

   Extend the existing projection tables to show provider count, spread, variance, and confidence when multiple providers exist for the same player/week.

7. Make matchup and optimizer views week-aware.

   Ensure the league detail page can select a week and use projections for that week instead of always using the preferred/latest projection.

## Architecture Notes

- Keep league platforms and projection providers separate.
- Keep API keys server-side only.
- Continue using internal player IDs as the analysis key.
- Continue storing external provider IDs in identity tables.
- Avoid full-catalog imports unless a provider requires a licensed player mapping sync.
