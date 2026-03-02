# General Conventions

## ID generation
```ts
const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
```
No module-level counters. No test-only exports.

## Check response.ok before parsing
```ts
if (!response.ok) throw new Error(`Request failed (${response.status})`);
const data = await response.json();
```

## Validate at boundaries
Data from localStorage, APIs, JSON.parse — validate shape before use.

## Name constants
Magic numbers get a name and a comment explaining the choice.
