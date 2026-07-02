# Fantasy Football Intelligence Platform
# Technical Debt Register

Version: v1.0

Purpose:

This document tracks intentional technical debt accepted during development.

Technical debt is not inherently bad.

Many items in this register are deliberate tradeoffs made to accelerate delivery of Version 1.0.

The goal is not to eliminate technical debt.

The goal is to ensure it is:

• Visible
• Intentional
• Prioritized
• Eventually resolved

---

# Priority Definitions

🔴 Critical

Must be resolved before Version 1.0 launches.

---

🟠 High

Should be resolved shortly after launch.

---

🟡 Medium

Improves quality but does not block launch.

---

🔵 Low

Long-term improvement.

---

⚪ Vision

Future architecture.

Not considered technical debt.

---

# Current Technical Debt Summary

| Category | Items |
|-----------|------:|
| Draft Experience | 6 |
| Data Sources | 7 |
| Decision Engine | 5 |
| Intelligence | 5 |
| UX | 7 |
| Performance | 6 |
| Infrastructure | 5 |

---

# Draft Experience

## Manual Draft Board

Priority

🟠 High

Current

Players are manually marked as drafted.

Reason

Allows rapid development before live integrations.

Future

Automatically consume live draft events.

Target

Milestone 3

---

## Manual Draft Session

Priority

🟠 High

Current

Draft state is represented as a query-string backed `DraftSessionState` with recent events and one-step undo.

Future

Persistent draft sessions.

Resume drafts.

Cloud sync.

Target

Milestone 3

---

## No Snake Draft Logic

Priority

🟡 Medium

Current

Draft progression is simplified.

Future

True snake draft support.

Draft order tracking.

Pick ownership.

---

## Manual League Setup

Priority

🟡 Medium

Future

Automatic import from fantasy providers.

---

# Data Sources

## Manual ADP

Priority

🟠 High

Current

User pastes ADP.

Future

FantasyPros

Fantasy Nerds

Sleeper

Target

Milestone 3

---

## Placeholder Market Values

Priority

🟡 Medium

Current

Market Value is calculated from manual ADP.

Future

Dynamic market values.

---

## No Injury Feed

Priority

🟠 High

Future

NFL injury integration.

---

## No Bye Week Feed

Priority

🟡 Medium

Future

Automatic bye week intelligence.

---

## No News Feed

Priority

🟡 Medium

Future

Real-time news ingestion.

---

## No Position Scarcity Model

Priority

🟠 High

Current

Neutral.

Future

Dynamic scarcity calculations.

---

# Decision Engine

## Placeholder Context Weights

Priority

🟡 Medium

Current

Some decision weights are conservative placeholders.

Future

Data-driven optimization.

---

## Limited Recommendation Factors

Priority

🟠 High

Future

League tendencies.

Playoff schedules.

Weather.

Vegas lines.

Roster construction.

---

## Static Strategy Profiles

Priority

🟡 Medium

Future

Adaptive draft strategies.

---

## No Historical Validation Loop

Priority

🟠 High

Future

Continuously tune Decision Score using historical outcomes.

---

# Intelligence

## Manual Transcript Review

Priority

🟠 High

Current

Human review required.

Future

Automatic quality review.

Exception-only workflow.

---

## Deterministic Transcript Extraction

Priority

🟡 Medium

Current

Rule-based extraction.

Future

Hybrid AI extraction.

---

## Snapshot Generation

Priority

🟡 Medium

Current

Synchronous.

Future

Background jobs.

---

## Expert Memory

Priority

🟡 Medium

Future

Persisted rollups.

---

## Player Thesis Calibration

Priority

High

Current

Player Thesis/Draft Case is deterministic and computed from approved evidence, but claim/risk weights and warning thresholds have not been calibrated against real draft decisions or fantasy outcomes.

Future

Review a sample of generated Draft Cases.

Tune claim quality, risk severity, recency, source count, and attribution thresholds.

Add QA reports for provisional, low-evidence, and mixed-opinion theses.

---

# User Experience

## Navigation

Priority

🟠 High

Current

Growing organically.

Future

Workflow-first navigation.

---

## Too Many Administrative Pages

Priority

🟠 High

Future

Hide Intelligence Operations.

Expose only recommendations.

---

## Draft Workflow

Priority

🔴 Critical

Current

Draft now has a guided manual flow with Draft Mode header, confirmations, event log, and one-step undo. Setup and draft session state are still split across `/draft/setup` and query parameters.

Future

Single guided experience.

---

## Mobile Optimization

Priority

🟠 High

Future

Responsive layouts.

---

## Empty States

Priority

🟡 Medium

Future

Helpful onboarding.

---

## Loading States

Priority

🟡 Medium

Future

Skeleton loaders.

---

## Accessibility

Priority

🟡 Medium

Future

Keyboard navigation.

Screen readers.

---

# Performance

## Recommendation Generation

Priority

🟡 Medium

Future

Caching.

---

## Trust Calculations

Priority

🟡 Medium

Future

Snapshot reuse.

---

## Large Transcript Processing

Priority

🟠 High

Future

Background processing.

Queues.

---

## Search Optimization

Priority

🟡 Medium

Future

Indexed search.

---

## Database Queries

Priority

🟡 Medium

Future

Query tuning.

---

## Build Performance

Priority

🔵 Low

Future

Incremental optimization.

---

# Infrastructure

## Single Deployment Target

Priority

🟡 Medium

Future

Production deployment pipeline.

---

## No Automated Testing

Priority

🔴 Critical

Future

Unit tests.

Integration tests.

End-to-end draft simulations.

---

## Limited Monitoring

Priority

🟡 Medium

Future

Application monitoring.

Logging.

Alerts.

---

## No CI/CD Pipeline

Priority

🟠 High

Future

GitHub Actions.

Automated validation.

---

## Secrets Management

Priority

🟡 Medium

Future

Production secret storage.

---

# Intentional MVP Decisions

These are not considered technical debt.

They are deliberate Version 1 choices.

✓ Manual ADP import

✓ Manual draft board

✓ Conservative recommendation weights

✓ Deterministic transcript extraction

✓ Progressive provider integrations

These should remain until they become the highest-value improvement.

---

# Before Adding New Technical Debt

Ask:

Is this a temporary shortcut?

Why is it necessary?

What replaces it?

When should it be revisited?

If those questions cannot be answered, reconsider the implementation.

---

# Retirement Rule

Technical debt should be removed when:

• It blocks user experience.

• It slows development.

• A reusable solution exists.

• The replacement clearly improves the product.

Do not eliminate technical debt simply because it exists.

Eliminate it when the value exceeds the cost.

---

# Guiding Principle

Technical debt is acceptable.

Untracked technical debt is not.

Every intentional shortcut should appear in this register with a reason, a priority, and a future plan.
