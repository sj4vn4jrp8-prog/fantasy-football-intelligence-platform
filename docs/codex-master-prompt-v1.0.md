# Fantasy Football Intelligence Platform
# Codex Master Prompt

This document defines the permanent development philosophy for the Fantasy Football Intelligence Platform.

Every Codex session should read this file before making recommendations or implementing features.

This document should be treated as authoritative unless superseded by newer documentation.

---

# Required Reading Order

Before making any recommendations or implementing changes, read these documents in the following order:

1. docs/product-principles.md
2. docs/product-blueprint-v1.md
3. docs/architecture.md
4. docs/project-status.md
5. docs/next-priority.md
6. docs/decision-journal.md

Treat these documents as the source of truth.

If documentation conflicts:

Product Principles
↓

Product Blueprint
↓

Architecture
↓

Project Status
↓

Next Priority

---

# Product Mission

Build the world's most trusted Fantasy Football Decision Engine.

The purpose of every intelligence system is to help fantasy football managers make better decisions while hiding unnecessary complexity.

The platform is not a transcript analyzer.

It is not an expert ranking site.

It is not a projection website.

It is a Decision Intelligence Platform.

---

# Development Philosophy

Always optimize for the user experience before exposing technical capability.

Recommendations are the product.

Infrastructure exists to support recommendations.

Whenever possible:

Recommendation

↓

Explanation

↓

Evidence

↓

Raw Intelligence

Never reverse this order.

---

# Primary Product Goal

Every feature should ultimately improve one or more of these decisions:

• Draft
• Trade
• Waiver
• Start/Sit
• Roster Management
• Playoff Strategy

If a feature does not improve a fantasy football decision, reconsider whether it belongs in Version 1.

---

# Current Product Milestone

Current Milestone:

Milestone 2 — Draft Experience

Until this milestone is complete, prioritize features that improve:

• Draft Command Center
• Decision Engine
• Draft workflow
• Recommendation quality
• Recommendation explainability
• User experience

Avoid expanding into unrelated areas unless they directly support the draft experience.

---

# Product Principles

Always follow the Product Principles document.

Especially:

• Recommendations first.
• Invisible Intelligence.
• Progressive Disclosure.
• Reduce user work.
• Explain everything.
• Simplicity beats feature count.
• Product Blueprint wins over architecture.

---

# Invisible Intelligence Principle

Users should rarely interact directly with:

• Transcript Intelligence
• Trust Engine
• Expert Memory
• Intelligence Snapshots
• Consensus
• Transcript Review
• Quality Review

These systems power recommendations.

They are not the product.

---

# Decision Hierarchy

Every user-facing recommendation should answer:

1. What should I do?

2. Why?

3. What are the risks?

4. What evidence supports this?

5. Where did the evidence come from?

Do not expose lower levels unless requested.

---

# Coding Philosophy

Prefer deterministic logic before AI.

AI should augment existing logic—not replace it.

Avoid unnecessary complexity.

Prefer reusable systems.

Prefer composition over duplication.

Keep modules small and focused.

Optimize readability over cleverness.

---

# Architecture Philosophy

The platform consists of reusable layers.

Transcript Intelligence

↓

Quality Reviewer

↓

Expert Memory

↓

Trust Engine

↓

Player Intelligence

↓

Decision Engine

↓

User Experiences

Never bypass existing layers unless there is a compelling architectural reason.

---

# Decision Engine Philosophy

Decision Score is the flagship metric.

Trust Score is one contributor.

Trust Score ≠ Decision Score.

Decision Engine should eventually consume:

• Trust Engine
• Expert Memory
• Player Intelligence
• League Context
• Market Value
• ADP
• Roster Construction
• Position Scarcity
• Risk
• Strategy
• Future Injury Intelligence

The Decision Engine should not depend on a specific fantasy platform.

---

# Multi-Platform Philosophy

Design every feature to support multiple fantasy providers.

Never tightly couple core logic to:

• Sleeper
• ESPN
• Yahoo
• RT Sports
• MyFantasyLeague

Platform adapters should isolate provider-specific logic.

Core intelligence should remain platform-agnostic.

---

# UX Philosophy

Whenever implementing UI:

Reduce clicks.

Reduce cognitive load.

Prefer guided workflows.

Hide advanced functionality until needed.

Make the product feel like an assistant—not software.

Always ask:

"What does the user need right now?"

---

# Draft Experience Philosophy

The Draft Command Center is currently the flagship experience.

Future recommendations should prioritize improving:

• Draft recommendations
• Draft workflow
• Available player pool
• League context
• Recommendation explanations
• Draft speed
• Confidence

---

# Coding Standards

Whenever practical:

Prefer complete file rewrites over partial snippets.

Keep naming consistent.

Avoid dead code.

Avoid duplicated logic.

Prefer strongly typed models.

Keep business logic separate from UI.

---

# Validation Requirements

Before considering a sprint complete, run:

npm run prisma:generate

npm run prisma:validate

npm run lint

npm run build

If Prisma schema changes:

Clearly tell the user whether:

npm run db:push

is required.

Never assume database changes have already been applied.

---

# Documentation Requirements

Whenever a meaningful feature is completed:

Update:

• docs/architecture.md

• docs/project-status.md

• docs/next-priority.md

If a significant product decision was made:

Update:

• docs/decision-journal.md

If a milestone changes:

Update:

• docs/product-blueprint-v1.md

Documentation is part of the implementation.

---

# Code Review Checklist

Before finishing a sprint, ask:

Does this align with Product Principles?

Does this improve the Draft Experience?

Does this reduce user effort?

Is the feature explainable?

Does it fit the architecture?

Does it improve decision quality?

Would a first-time user understand it?

If not:

Improve the implementation before considering it complete.

---

# Response Format

After implementation always summarize:

1. Files changed.

2. Prisma schema changes.

3. Whether db:push is required.

4. Architecture impact.

5. User-facing improvements.

6. Remaining limitations.

7. Future integration points.

8. Validation results.

---

# Reasoning Guidance

Use reasoning efficiently.

Low

Small UI tweaks.

Copy changes.

Documentation edits.

Bug fixes.

Medium

Single-page features.

Small backend additions.

New UI components.

High

Multi-file features.

Decision Engine enhancements.

Knowledge Brain enhancements.

Workflow improvements.

Cross-module integrations.

Extra High

Architecture changes.

New platform capabilities.

Major workflow redesigns.

Database redesigns.

Core intelligence systems.

Decision Engine redesign.

Use the lowest reasoning level that can confidently complete the task.

---

# Long-Term Vision

The long-term goal is not simply to build another fantasy football application.

The goal is to build the world's most trusted Fantasy Football Decision Engine.

Every intelligence system should ultimately help fantasy managers make better decisions with less effort.

Whenever choosing between:

Adding another feature

or

Making recommendations simpler and more useful

Prefer the better user experience.

The product should feel like a knowledgeable fantasy football coach—not a collection of tools.