Fantasy Football Intelligence Platform
Draft Command Center v2

Version: 2.0 Product Design Specification

Status: Product Design (Pre-Implementation)

Purpose

The Draft Command Center is the flagship experience of the Fantasy Football Intelligence Platform.

It is the primary interface fantasy managers use during a live draft.

Every intelligence system built within the platform ultimately exists to improve this experience.

The Draft Command Center should feel less like software and more like having an elite fantasy football analyst sitting beside you throughout the draft.

Product Mission

Help fantasy managers make the best possible draft decision in under 30 seconds.

Users should never need to understand the Trust Engine, Transcript Intelligence, Expert Memory, or any other internal system.

They simply need confidence that the recommendation is trustworthy.

Primary User Question

At every moment during a draft, the application should answer one question:

Who should I draft next?

Everything else is secondary.

Design Philosophy
Recommendations First

The recommendation is the product.

Do not require users to navigate through multiple pages to reach it.

Progressive Disclosure

Information should be revealed in layers.

Level 1

What should I do?

Level 2

Why?

Level 3

Show me the evidence.

Level 4

Show me the raw intelligence.

Very few users should ever reach Level 4.

Invisible Intelligence

The following systems should power recommendations but remain largely invisible:

Knowledge Brain
Trust Engine
Expert Memory
Transcript Intelligence
Consensus Engine
Intelligence Snapshots
Quality Reviewer

These are infrastructure—not products.

Primary Layout
----------------------------------------------------------
Fantasy Football Intelligence

League: Home League

Round: 6

Pick: 68

Roster Needs:
RB
WR

----------------------------------------------------------

⭐ RECOMMENDED PICK

TreVeyon Henderson

Decision Score: 94

Confidence: High

Draft Recommendation:
DRAFT NOW

----------------------------------------------------------

Why?

✓ Highest value remaining

✓ Fits current roster

✓ Multiple trusted experts upgraded him

✓ Market says he is a value

----------------------------------------------------------

Risks

• Rookie volatility

• Committee concerns

----------------------------------------------------------

Alternatives

1. Omarion Hampton

2. Tetairoa McMillan

3. Quinshon Judkins

----------------------------------------------------------

[ Draft Player ]

[ Compare ]

[ Why? ]

----------------------------------------------------------

Nothing else should compete visually with this section.

Information Hierarchy
Level 1 (Always Visible)
Recommendation
Decision Score
Draft Action
Confidence
Top 3 Reasons
Risks
Alternatives

This is all many users will ever need.

Level 2 (One Click)

"Why?"

Displays:

Expanded reasoning
Strategy fit
Roster fit
League fit
Market value
Position scarcity
Level 3 (Two Clicks)

"Supporting Evidence"

Displays:

Expert opinions
Trust signals
Consensus
Historical trends
Level 4 (Admin / Power User)

"Intelligence"

Displays:

Transcript summaries
Transcript excerpts
Expert Memory
Trust calculations
Quality Reviewer
Snapshot history

This level should not be part of the normal draft workflow.

Draft Workflow
Before Draft

Select league.

↓

Import league settings.

↓

Import ADP.

↓

Select strategy.

↓

Ready.

During Draft

Player drafted.

↓

Board updates.

↓

Decision recalculates.

↓

Recommendation updates automatically.

↓

User drafts player.

↓

Repeat.

The user should never need to manually refresh recommendations.

Recommendation Card

Every recommendation must answer:

What should I do?

Example:

Draft TreVeyon Henderson.

Why?

Three concise bullet points.

Never more than five.

Risks

Clear.

Honest.

Never hidden.

Alternatives

Always show three.

Never only one.

Confidence

Expressed in plain English.

Examples:

Very High

High

Moderate

Low

Avoid percentages unless users explicitly request them.

Decision Score

Decision Score becomes the flagship metric.

Trust Score remains internal.

Users care about:

Should I draft this player?

Not:

How was this score calculated?

Trust

Trust should influence recommendations.

It should rarely become the focus of the screen.

Only expose Trust when it helps answer:

Why should I believe this recommendation?

Search

Search should answer natural questions.

Examples:

Who should I draft?

Who is the best WR left?

Who is the safest RB?

Who has the highest upside?

Who is being undervalued?

Avoid exposing implementation terminology.

Navigation

The public application should contain only:

Home

Draft

Players

Settings

Everything else should move under:

Administration

or

Intelligence Operations

Examples:

Knowledge Brain

Trust

Consensus

Review Queue

History

Decision Engine

Quality Reviewer

Snapshots

These are operational tools.

User Personas
Casual Fantasy Manager

Needs:

One recommendation.

Simple explanation.

Competitive Fantasy Manager

Needs:

Alternatives.

Risk.

Evidence.

Power User

Needs:

Access to supporting intelligence.

Should explicitly request it.

Visual Principles

Large recommendation card.

Minimal clutter.

High contrast.

One primary action.

No unnecessary tables.

No walls of text.

Whitespace is encouraged.

Performance Goals

Recommendation updates:

<2 seconds

Decision explanation:

<10 seconds to understand

Primary action:

<3 clicks

User should never feel overwhelmed.

Version 1 Scope

Required:

Draft recommendations
Decision Score
League context
Manual draft board
Manual ADP
Recommendation explanations
Alternatives
Risks

Optional:

Position scarcity
Tier builder
Bye week optimization
Team stack analysis

Deferred:

Trade Assistant
Waiver Assistant
Start/Sit Assistant
Dynasty tools
Success Metrics

A successful Draft Command Center should achieve:

Recommendation understood in under 10 seconds.
Draft decision completed in under 30 seconds.
Fewer than three clicks for common actions.
Users rarely need to access raw intelligence.
Users trust the recommendation without needing to inspect the underlying machinery.
Guiding Principle

The Draft Command Center is not a dashboard.

It is not a reporting tool.

It is not an intelligence explorer.

It is a decision-making companion.

Every feature should answer one question:

Does this help the user confidently draft the right player?

If the answer is no, the feature should be simplified, hidden, or deferred.

Product Vision

The user should leave every draft feeling that they had a knowledgeable fantasy football expert sitting beside them—not because they saw more data than everyone else, but because the platform transformed thousands of pieces of evidence into one clear, trustworthy recommendation at exactly the right moment.