# Architecture Decision Records (ADR)

This directory contains Architecture Decision Records (ADRs) for the MMR Project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## Why ADRs?

- **Documentation**: Provides historical context for architectural decisions
- **Onboarding**: Helps new team members understand why the system is built the way it is
- **Knowledge Sharing**: Makes implicit knowledge explicit
- **Decision Review**: Allows team to review and validate decisions over time

## ADR Format

Each ADR follows this structure:

1. **Title**: Short descriptive title
2. **Status**: Proposed, Accepted, Deprecated, Superseded
3. **Context**: What is the issue we're seeing that motivates this decision?
4. **Decision Drivers**: What factors influence the decision?
5. **Considered Options**: What alternatives did we consider?
6. **Decision Outcome**: What did we decide and why?
7. **Consequences**: What becomes easier or harder as a result?
8. **Implementation Plan**: How will this be implemented?

## ADR Index

- [ADR 001: Multi-Tenant Identity Architecture](./001-multi-tenant-identity-architecture.md) - Proposed
  - Decouples identity from game data and introduces tenant isolation
  - Enables seamless Supabase → Clerk migration
  - Prepares architecture for multi-tenancy support

## Creating a New ADR

1. Copy the template from an existing ADR
2. Use the next sequential number (e.g., `002-my-decision.md`)
3. Fill in all sections with relevant information
4. Submit as part of your PR for review
5. Update this README with the new ADR entry

## Updating ADR Status

When an ADR's status changes:

- **Proposed → Accepted**: Decision has been approved and implementation has started
- **Accepted → Deprecated**: Decision is no longer valid but kept for historical reference
- **Accepted → Superseded by ADR XXX**: A new ADR replaces this one

Update the status in both the ADR document and this README.
