# Next Priority

## Recommended Next Feature

Add Knowledge Brain review controls for extracted takes, then add archive/edit controls for source freshness.

The app can now save manual transcripts, bulk import locally fetched Markdown transcripts, filter stale content out of current intelligence, deterministically extract player mentions, aggregate those insights into player intelligence profiles, compare expert consensus, and surface low-sample early signals without weakening strict consensus rules. The next useful step is to let a human review, correct, approve, or dismiss extracted takes before they influence fantasy decisions.

## Why It Matters

The Knowledge Brain should preserve expert disagreement without pretending the first parser is perfect. A review workflow makes the system safer before connecting takes to start/sit recommendations, waivers, trades, or future AI summaries.

This also creates a cleaner foundation for connecting expert consensus to fantasy decisions later. The local fetcher can bring in volume, freshness controls prevent stale-season pollution, early signals keep small data sets useful, consensus shows where experts agree or split, and review controls keep player profiles and trend scores trustworthy.

## Suggested Implementation Order

1. Add review status to `ExpertTake`.

   Suggested states: Pending, Approved, Dismissed, Needs Edit.

2. Build a take review queue.

   Show extracted take, transcript excerpt, player match, sentiment, take type, and confidence.

3. Allow edits.

   Let the user correct sentiment, take type, player match, and summary.

4. Use only approved takes in player intelligence.

   Recompute trend signals, intelligence scores, and reasons from approved takes once review status exists.

5. Plan transcript source integration.

   Keep YouTube discovery local-only. Confirm terms, source availability, attribution, and rate limits before considering any server-side source integration.

6. Add source freshness edit controls.

   Let the user manually archive, re-include, or correct publish dates for individual source videos when metadata is missing or wrong.

## Architecture Notes

- Do not scrape YouTube pages from the Next.js app or deployed server.
- Keep `scripts/knowledge-brain/fetch_fantasy_transcripts.py` as a local companion workflow only.
- Keep source adapters behind `TranscriptSource`.
- Keep manual ingestion as the reliable baseline.
- Keep `/knowledge-brain/import-markdown` as the safe bridge between local transcript files and database ingestion.
- Keep current player intelligence filtered by `includeInCurrentAnalysis` by default.
- Preserve historical transcripts; archive or exclude them instead of deleting them.
- Keep expert consensus deterministic until extracted takes have human review controls.
- Keep strict consensus thresholds separate from low-sample early signals.
- Continue matching expert takes to internal `Player` IDs.
- Do not connect expert takes to lineup recommendations until review status exists.
