# Code Quality Review — 2026-03-01

## High Severity

### 1. Missing `snap.exists()` guard in all Firestore transactions
**File:** `src/lib/firestore.ts` (9 transaction functions)

Every transaction does `snap.data() as ReceiptDoc` without checking existence. If the doc is deleted between subscription and transaction read, `snap.data()` returns `undefined` and property access throws a `TypeError`.

**Fix:** Add a `requireData` helper:
```ts
function requireData(snap: DocumentSnapshot): ReceiptDoc {
  if (!snap.exists()) throw new Error("Receipt not found");
  return snap.data() as ReceiptDoc;
}
```

## Medium Severity

### 2. `useEffect` to clear `activePerson` is an event handler in disguise
**File:** `src/app/receipt/[id]/page.tsx:35-39`

Effect fires on every `receipt.people` change to check if the active person still exists. This should be derived inline:
```ts
const resolvedActivePerson = receipt.people.some(p => p.id === activePerson)
  ? activePerson : null;
```
Removes the effect and the extra render cycle.

### 3. Module-level mutable `nextId` in parser pollutes production code
**File:** `src/lib/parser.ts:3-10`

`nextId` counter and `resetIdCounter()` exist only for test determinism. Production code shouldn't export test utilities. Fix: use `Date.now() + Math.random()` like `useFirestoreReceipt` does, and mock `Date.now` in tests.

### 4. Firestore mutation errors silently swallowed
**File:** `src/hooks/useFirestoreReceipt.ts`

All mutation callbacks (`addItem`, `updateItem`, etc.) call `fs*` functions that return promises, but never await or catch them. Network failures produce no user feedback.

### 5. `response.json()` called before `!response.ok` in OCR client
**File:** `src/lib/ocr.ts:16-18`

If the server returns a non-JSON error (502, 504, HTML error page), `response.json()` throws a JSON parse error before the status check runs. Check `response.ok` first.

### 6. Color assignment uses stale `people.length` instead of Firestore snapshot
**File:** `src/hooks/useFirestoreReceipt.ts:99-109`

`addPerson` reads `people.length` from React state. Two clients adding simultaneously could pick the same color. Color should be assigned inside the Firestore transaction using `data.people.length`.

### 7. `fsSetItems` uses last-write-wins instead of transaction
**File:** `src/lib/firestore.ts:62-63`

`fsSetItems` uses `updateDoc` while all other mutations use `runTransaction`. Concurrent calls silently clobber each other.

### 8. `createReceipt` silently drops `partial.imageDataUrl`
**File:** `src/lib/firestore.ts:26-40`

The function accepts `Partial<ReceiptDoc>` but hardcodes `imageDataUrl: null`, discarding any passed value.

### 9. Stale closure risk in `handlePointerMove` window listener
**File:** `src/components/receipt/ItemRow.tsx:77-97`

`handleMouseDown` captures `handlePointerMove` at call time. The `isSwipeOpen` state dependency inside `handlePointerMove` can go stale during a drag. Fix: derive from `swipeOffsetRef.current` instead of `isSwipeOpen` state.

### 10. Non-null assertion on `canvas.getContext("2d")`
**File:** `src/lib/image.ts:50`

`getContext("2d")` returns `null` in privacy-hardened browsers or under certain CSP policies. Add a null guard.

## Low Severity

### 11. Unnecessary `prev*` refs in CurrencyInput, ReceiptHeader, TaxTipSection, ItemRow
**Files:** `CurrencyInput.tsx:22-30`, `ReceiptHeader.tsx:27-35`, `TaxTipSection.tsx:37-45`, `ItemRow.tsx:34-49`

All four components use a `prevValue` ref to detect "external change" vs "own commit echoed back". The guard only prevents a no-op `setState` (same value). Simpler: just check `isFocused` and always sync when not focused:
```ts
useEffect(() => {
  if (!isFocused.current) setLocalValue(propValue);
}, [propValue]);
```

### 12. Dead state: `isEditing` in ItemRow
**File:** `src/components/receipt/ItemRow.tsx:29`

`isEditing` is initialized to `false` and never set to `true`. Dead code.

### 13. `parsedItems` state in ScanSection is derived data
**File:** `src/components/receipt/ScanSection.tsx:28`

`parsedItems` can be computed inline: `const parsedItems = ocr.result ? parseReceiptText(ocr.result) : []`. Removes a `useState` and `setParsedItems`.

### 14. Side effect inside `setState` updater in useRecentReceipts
**File:** `src/hooks/useRecentReceipts.ts:38-48`

`writeRecents` (localStorage write) is called inside the `setRecents` updater. React strict mode double-invokes updaters. Move the side effect to a `useEffect` that syncs state to localStorage.

### 15. `useEffect` for `canShare` in ShareSection should be lazy initializer
**File:** `src/components/receipt/ShareSection.tsx:16-18`

Replace the effect with `useState(() => typeof navigator !== "undefined" && "share" in navigator)`.

### 16. File input ref can be replaced with `<label htmlFor>`
**Files:** `ScanSection.tsx:29,85-104`, `ImageCapture.tsx:10,33`

Standard HTML pattern removes the need for refs:
```tsx
<label htmlFor="gallery-input" ...>gallery</label>
<input id="gallery-input" type="file" ... className="hidden" />
```

### 17. No shape validation on localStorage JSON
**File:** `src/hooks/useRecentReceipts.ts:14-21`

`JSON.parse` result is typed as `RecentReceipt[]` without checking. Add: `return Array.isArray(parsed) ? parsed : []`.

### 18. Redundant skip patterns and dead code in parser
**File:** `src/lib/parser.ts:61-96, 194`

`/subtotal/i` and `/sub\s*total/i` overlap. `!/^\s*$/` never matches (lines are already trimmed). `!shouldSkipLine(line)` at line 194 is always true (already checked at line 128).

### 19. ID generation duplicated between hook and parser
**Files:** `useFirestoreReceipt.ts`, `parser.ts`

Two different ID schemes. Extract a shared `generateId()` utility.

### 20. `COLORS` array in hook file instead of shared constants
**File:** `src/hooks/useFirestoreReceipt.ts:26-29`

Domain constant belongs in `src/lib/colors.ts` or alongside types.

### 21. `upsertRecent` fires on every restaurant name keystroke
**File:** `src/app/receipt/[id]/page.tsx:29-33`

Effect depends on `receipt.restaurantName`, causing a localStorage write per keystroke. Intent is to record a visit, not live-sync the name.

### 22. `?? []` fallbacks create new array references every render
**File:** `src/hooks/useFirestoreReceipt.ts:55-60`

`data?.items ?? []` creates a new `[]` on every render when `data` is null, causing unnecessary child re-renders. Use `useMemo`.

### 23. Magic numbers without documentation
**Files:** `image.ts:1` (`MAX_WIDTH = 1500`), `image.ts:53` (quality `0.85`), `format.ts:32-33` (`"Shplit"`, `"─".repeat(30)`)
