# React Patterns

## Optimistic input state
When an input is backed by Firestore, keep local state while focused and sync from props when not focused. No `prev*` ref needed:
```ts
const [localValue, setLocalValue] = useState(propValue);
const isFocused = useRef(false);
useEffect(() => {
  if (!isFocused.current) setLocalValue(propValue);
}, [propValue]);
```

## Derive, don't sync
Compute values inline from state/props. Don't store derived data in state and sync with effects.

## No effects as event handlers
If something happens in response to a user action, handle it in the callback. Effects are for synchronization with external systems (subscriptions, DOM APIs).

## No side effects in setState updaters
React strict mode double-invokes updaters. Keep them pure. Do side effects in effects or event handlers.

## Refs in JSX
Don't read `ref.current` in JSX for values that affect rendering. Ref changes don't trigger re-renders — use state instead.

## Use `<label htmlFor>` over refs for file inputs
```tsx
<label htmlFor="file-input" className="...">Upload</label>
<input id="file-input" type="file" className="hidden" onChange={...} />
```
