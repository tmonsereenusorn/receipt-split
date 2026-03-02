# Shplit — Code Conventions

## React Patterns

### Local state for controlled inputs (optimistic pattern)
When an input is backed by Firestore, keep local state while focused and sync from props when not focused. Do NOT use a `prev*` ref — just check the focus guard:
```ts
const [localValue, setLocalValue] = useState(propValue);
const isFocused = useRef(false);

useEffect(() => {
  if (!isFocused.current) setLocalValue(propValue);
}, [propValue]);
```

### No `useEffect` as event handlers
If something should happen in response to a user action, put it in the event handler — not in an effect that watches for state changes. Effects are for synchronization with external systems.

### Derive, don't sync
If a value can be computed from existing state/props, compute it inline. Don't store it in state and keep it in sync with effects.
```ts
// Bad: effect to clear activePerson when person is deleted
// Good: derive it inline
const resolvedActivePerson = people.some(p => p.id === activePerson)
  ? activePerson : null;
```

### No side effects in `setState` updaters
React may double-invoke updaters in strict mode. Keep `setState` updaters pure — do side effects (localStorage, API calls) in effects or event handlers.

### Refs in JSX are fragile
Don't read `ref.current` in JSX for values that affect rendering (e.g., CSS transitions). Ref changes don't trigger re-renders, so the rendered output can be stale. Use state instead if the value affects what the user sees.

## Firestore

### Always guard `snap.exists()` in transactions
```ts
const snap = await tx.get(ref);
if (!snap.exists()) throw new Error("Receipt not found");
const data = snap.data() as ReceiptDoc;
```

### Use transactions for read-modify-write
Don't use `updateDoc` (last-write-wins) when the write depends on current state. Use `runTransaction` to prevent clobbering concurrent edits.

### Surface mutation errors
Firestore writes can fail (network, permissions). Don't fire-and-forget — catch errors and surface them to the UI.

## General

### ID generation
Use `Date.now() + Math.random()` for IDs. Don't use module-level counters. Don't export test-only utilities like `resetIdCounter`.
```ts
const id = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
```

### No magic numbers
Name constants and add a brief comment explaining the choice:
```ts
// Google Vision performs well at 1500px; larger adds bandwidth without accuracy gain
const MAX_WIDTH = 1500;
```

### Check `response.ok` before parsing JSON
```ts
if (!response.ok) {
  const text = await response.text();
  throw new Error(`Request failed (${response.status}): ${text}`);
}
const data = await response.json();
```

### Validate external data at boundaries
Parse results from `localStorage`, API responses, and `JSON.parse` should be validated before use. At minimum: `Array.isArray(parsed) ? parsed : []`.
