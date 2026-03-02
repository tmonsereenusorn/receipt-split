# Shplit

## Principles
- Derive values from state/props inline — don't sync with effects
- Effects are for external system synchronization, not event responses
- Guard data at boundaries (Firestore snapshots, localStorage, API responses)
- Surface errors to the user — don't swallow promises

## Key docs
- `docs/code-quality-review.md` — known issues and patterns to fix
- `docs/conventions/` — specific rules (React patterns, Firestore, etc.)
