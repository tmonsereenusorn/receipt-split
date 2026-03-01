# Receipt Tape UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the 3-page white-card UI into a single-page dark-mode "receipt tape" interface.

**Architecture:** Convert from multi-route Next.js app to a single-page progressive-disclosure layout. Keep all business logic (context, reducer, calculator, parser, OCR) unchanged. Redesign every visual component. Replace Card-based layout with a centered narrow "receipt tape" strip on a dark background.

**Tech Stack:** Next.js (App Router), Tailwind CSS 4, Geist Sans + Geist Mono fonts, React Context + useReducer (unchanged).

---

### Task 1: Dark mode foundation — globals.css and layout

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Update globals.css with dark theme**

Replace the entire file:

```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --tape-bg: #18181b;
  --accent: #f59e0b;
  --muted: #71717a;
  --separator: #3f3f46;
  --surface: #27272a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-tape: var(--tape-bg);
  --color-accent: var(--accent);
  --color-muted: var(--muted);
  --color-separator: var(--separator);
  --color-surface: var(--surface);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
}

@media print {
  .no-print {
    display: none !important;
  }

  body {
    background: white;
    color: black;
    font-size: 11pt;
  }

  main {
    padding: 0 !important;
    max-width: 100% !important;
  }
}
```

**Step 2: Update layout.tsx for receipt tape container**

Change the `<main>` wrapper from `max-w-5xl` to a receipt-tape-appropriate container:

```tsx
// layout.tsx — change the <main> className and add dark background
<html lang="en" className="dark">
  <body
    className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
  >
    <ReceiptProvider>
      <main className="mx-auto min-h-screen max-w-md px-4 py-6">
        {children}
      </main>
    </ReceiptProvider>
  </body>
</html>
```

Key change: `max-w-5xl` → `max-w-md` (28rem / ~448px — receipt-width).

**Step 3: Build and verify**

Run: `npm run build`
Expected: Builds successfully. Page is now dark background with narrow centered column.

**Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: dark mode foundation with receipt-tape layout"
```

---

### Task 2: Redesign UI primitives — Button, Input, CurrencyInput

**Files:**
- Modify: `src/components/ui/Button.tsx`
- Modify: `src/components/ui/Input.tsx`
- Modify: `src/components/ui/CurrencyInput.tsx`
- Delete: `src/components/ui/Card.tsx` (no longer needed — receipt tape replaces cards)
- Delete: `src/components/ui/Badge.tsx` (replaced by inline person chips)
- Delete: `src/components/ui/ProgressBar.tsx` (replaced by mono progress)

**Step 1: Redesign Button for dark theme**

```tsx
"use client";

import { clsx } from "clsx";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:bg-amber-600 font-semibold",
  secondary:
    "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700",
  danger: "text-red-400 hover:text-red-300 hover:bg-red-950/50",
  ghost: "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:opacity-40 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
```

**Step 2: Redesign Input for dark theme**

```tsx
"use client";

import { clsx } from "clsx";
import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={clsx(
          "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 transition-colors placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500",
          className
        )}
        {...props}
      />
    </div>
  );
}
```

**Step 3: Update CurrencyInput styles**

The CurrencyInput component itself has no hardcoded styles (it receives `className` from parents), so no changes are needed to the component itself. Parents will pass dark-themed classes.

**Step 4: Delete Card, Badge, ProgressBar**

These components are being replaced:
- Card → sections within the receipt tape (just divs with separators)
- Badge → inline colored chips in PeopleManager
- ProgressBar → mono-styled progress display

Delete the files:
```bash
rm src/components/ui/Card.tsx src/components/ui/Badge.tsx src/components/ui/ProgressBar.tsx
```

**Step 5: Commit**

```bash
git add -A src/components/ui/
git commit -m "feat: redesign UI primitives for dark receipt-tape theme"
```

---

### Task 3: Create ReceiptTape container and ReceiptHeader

**Files:**
- Create: `src/components/receipt/ReceiptTape.tsx`
- Create: `src/components/receipt/ReceiptHeader.tsx`
- Create: `src/components/receipt/Section.tsx`

**Step 1: Create Section component (receipt section separator)**

```tsx
interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  return (
    <div className={`border-b border-dashed border-zinc-700 py-5 last:border-0 ${className ?? ""}`}>
      {children}
    </div>
  );
}
```

**Step 2: Create ReceiptHeader**

```tsx
export function ReceiptHeader() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="py-6 text-center">
      <h1 className="font-mono text-lg font-bold uppercase tracking-[0.25em] text-zinc-100">
        Receipt Split
      </h1>
      <div className="mt-1 font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ================================
      </div>
      <p className="mt-2 font-mono text-xs text-zinc-500">
        {dateStr} {timeStr}
      </p>
    </div>
  );
}
```

**Step 3: Create ReceiptTape wrapper**

```tsx
interface ReceiptTapeProps {
  children: React.ReactNode;
}

export function ReceiptTape({ children }: ReceiptTapeProps) {
  return (
    <div className="relative mx-auto w-full rounded-sm bg-zinc-900 shadow-2xl shadow-black/50">
      {/* Torn top edge */}
      <div
        className="h-3 w-full bg-zinc-900"
        style={{
          clipPath:
            "polygon(0% 100%, 2% 40%, 4% 100%, 6% 40%, 8% 100%, 10% 40%, 12% 100%, 14% 40%, 16% 100%, 18% 40%, 20% 100%, 22% 40%, 24% 100%, 26% 40%, 28% 100%, 30% 40%, 32% 100%, 34% 40%, 36% 100%, 38% 40%, 40% 100%, 42% 40%, 44% 100%, 46% 40%, 48% 100%, 50% 40%, 52% 100%, 54% 40%, 56% 100%, 58% 40%, 60% 100%, 62% 40%, 64% 100%, 66% 40%, 68% 100%, 70% 40%, 72% 100%, 74% 40%, 76% 100%, 78% 40%, 80% 100%, 82% 40%, 84% 100%, 86% 40%, 88% 100%, 90% 40%, 92% 100%, 94% 40%, 96% 100%, 98% 40%, 100% 100%)",
        }}
        aria-hidden="true"
      />

      <div className="px-5">
        {children}
      </div>

      {/* Torn bottom edge */}
      <div
        className="h-3 w-full bg-zinc-900"
        style={{
          clipPath:
            "polygon(0% 0%, 2% 60%, 4% 0%, 6% 60%, 8% 0%, 10% 60%, 12% 0%, 14% 60%, 16% 0%, 18% 60%, 20% 0%, 22% 60%, 24% 0%, 26% 60%, 28% 0%, 30% 60%, 32% 0%, 34% 60%, 36% 0%, 38% 60%, 40% 0%, 42% 60%, 44% 0%, 46% 60%, 48% 0%, 50% 60%, 52% 0%, 54% 60%, 56% 0%, 58% 60%, 60% 0%, 62% 60%, 64% 0%, 66% 60%, 68% 0%, 70% 60%, 72% 0%, 74% 60%, 76% 0%, 78% 60%, 80% 0%, 82% 60%, 84% 0%, 86% 60%, 88% 0%, 90% 60%, 92% 0%, 94% 60%, 96% 0%, 98% 60%, 100% 0%)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/receipt/
git commit -m "feat: add ReceiptTape container, header, and section components"
```

---

### Task 4: Redesign ScanSection for receipt tape

**Files:**
- Create: `src/components/receipt/ScanSection.tsx`
- Modify: `src/components/scan/ImageCapture.tsx`
- Modify: `src/components/scan/ImagePreview.tsx`
- Modify: `src/components/scan/OcrProgress.tsx`

**Step 1: Redesign ImageCapture for dark theme**

```tsx
"use client";

import { useRef } from "react";

interface ImageCaptureProps {
  onCapture: (file: File, dataUrl: string) => void;
}

export function ImageCapture({ onCapture }: ImageCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onCapture(file, reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-label="Capture receipt image"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-lg border-2 border-dashed border-amber-500/50 px-6 py-8 text-center transition-colors hover:border-amber-500 hover:bg-amber-500/5"
      >
        <div className="font-mono text-sm text-amber-500">[ SCAN RECEIPT ]</div>
        <div className="mt-1 text-xs text-zinc-500">tap to take a photo</div>
      </button>
      <button
        type="button"
        onClick={() => {
          if (inputRef.current) {
            inputRef.current.removeAttribute("capture");
            inputRef.current.click();
            setTimeout(() => {
              inputRef.current?.setAttribute("capture", "environment");
            }, 1000);
          }
        }}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        or choose from gallery
      </button>
    </div>
  );
}
```

**Step 2: Redesign ImagePreview for dark theme**

```tsx
"use client";

interface ImagePreviewProps {
  dataUrl: string;
  onRetake: () => void;
}

export function ImagePreview({ dataUrl, onRetake }: ImagePreviewProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt="Captured receipt"
        className="max-h-48 rounded border border-zinc-700 object-contain"
      />
      <button
        type="button"
        onClick={onRetake}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        retake
      </button>
    </div>
  );
}
```

**Step 3: Redesign OcrProgress with mono block characters**

```tsx
"use client";

import { OcrProgress as OcrProgressType } from "@/types";

interface OcrProgressProps {
  progress: OcrProgressType | null;
}

const STATUS_LABELS: Record<string, string> = {
  loading: "Loading OCR engine...",
  "loading tesseract core": "Loading OCR engine...",
  "initializing tesseract": "Initializing...",
  "loading language traineddata": "Loading language data...",
  "initializing api": "Preparing...",
  "recognizing text": "Reading receipt...",
};

export function OcrProgressDisplay({ progress }: OcrProgressProps) {
  if (!progress) return null;

  const label =
    STATUS_LABELS[progress.status] || progress.status || "Processing...";
  const pct = Math.round(progress.progress * 100);
  const filled = Math.round(progress.progress * 20);
  const empty = 20 - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  return (
    <div className="w-full space-y-2 py-4 text-center">
      <div className="font-mono text-sm text-amber-500">
        [{bar}] {pct}%
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}
```

**Step 4: Create ScanSection that orchestrates scan flow**

```tsx
"use client";

import { useState } from "react";
import { useReceipt } from "@/hooks/useReceipt";
import { useOcr } from "@/hooks/useOcr";
import { parseReceiptText } from "@/lib/parser";
import { ImageCapture } from "@/components/scan/ImageCapture";
import { ImagePreview } from "@/components/scan/ImagePreview";
import { OcrProgressDisplay } from "@/components/scan/OcrProgress";
import { Section } from "./Section";
import { formatCents } from "@/lib/format";

interface ScanSectionProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function ScanSection({ onComplete, onSkip }: ScanSectionProps) {
  const receipt = useReceipt();
  const ocr = useOcr();
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  async function handleCapture(file: File, dataUrl: string) {
    setImageDataUrl(dataUrl);
    receipt.setImage(dataUrl);

    const text = await ocr.recognize(file);
    if (text) {
      receipt.setOcrText(text);
      const items = parseReceiptText(text);
      if (items.length > 0) {
        receipt.setItems(items);
      }
      onComplete();
    }
  }

  function handleRetake() {
    setImageDataUrl(null);
  }

  return (
    <Section>
      {!imageDataUrl && !ocr.isProcessing && (
        <ImageCapture onCapture={handleCapture} />
      )}

      {imageDataUrl && !ocr.isProcessing && !ocr.result && (
        <ImagePreview dataUrl={imageDataUrl} onRetake={handleRetake} />
      )}

      {ocr.isProcessing && (
        <OcrProgressDisplay progress={ocr.progress} />
      )}

      {ocr.error && (
        <p className="py-2 text-center font-mono text-xs text-red-400">{ocr.error}</p>
      )}

      {ocr.result && !ocr.isProcessing && (
        <div className="space-y-2 py-2">
          <div className="font-mono text-xs text-green-500">
            ✓ {receipt.items.length} item{receipt.items.length !== 1 ? "s" : ""} detected
          </div>
          {receipt.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between font-mono text-xs text-zinc-400"
            >
              <span className="truncate">{item.name}</span>
              <span className="ml-2 text-zinc-300">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
      )}

      {!ocr.isProcessing && !ocr.result && (
        <button
          type="button"
          onClick={onSkip}
          className="block w-full py-1 text-center text-xs text-zinc-600 hover:text-zinc-400"
        >
          skip scan, enter items manually →
        </button>
      )}
    </Section>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/scan/ src/components/receipt/ScanSection.tsx
git commit -m "feat: redesign scan section with dark theme and mono progress bar"
```

---

### Task 5: Redesign PeopleSection

**Files:**
- Create: `src/components/receipt/PeopleSection.tsx`

**Step 1: Create PeopleSection**

Compact row of colored chips with inline add/edit. Replaces PeopleManager + Card wrapper.

```tsx
"use client";

import { useState } from "react";
import { Person } from "@/types";
import { Section } from "./Section";

interface PeopleSectionProps {
  people: Person[];
  onAdd: (name: string) => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function PeopleSection({ people, onAdd, onUpdate, onDelete }: PeopleSectionProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setNewName("");
  }

  function startEdit(person: Person) {
    setEditingId(person.id);
    setEditName(person.name);
  }

  function saveEdit() {
    if (editingId && editName.trim()) {
      onUpdate(editingId, editName.trim());
    }
    setEditingId(null);
  }

  return (
    <Section>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
        People
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        {people.map((person) => (
          <div key={person.id} className="group relative">
            {editingId === person.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-20 rounded-full border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  autoFocus
                  onBlur={saveEdit}
                />
              </form>
            ) : (
              <button
                type="button"
                onClick={() => startEdit(person)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{ backgroundColor: `${person.color}20`, color: person.color, border: `1px solid ${person.color}40` }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
                {person.name}
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(person.id);
                  }}
                  className="ml-0.5 opacity-0 transition-opacity group-hover:opacity-100 cursor-pointer hover:opacity-70"
                  role="button"
                  aria-label={`Remove ${person.name}`}
                >
                  ×
                </span>
              </button>
            )}
          </div>
        ))}
        <form onSubmit={handleAdd} className="flex items-center">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="+ add"
            className="w-20 rounded-full border border-dashed border-zinc-700 bg-transparent px-3 py-1 text-xs text-zinc-400 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          />
        </form>
      </div>
    </Section>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/receipt/PeopleSection.tsx
git commit -m "feat: add dark-themed PeopleSection with colored chips"
```

---

### Task 6: Redesign ItemsSection with expandable rows

**Files:**
- Create: `src/components/receipt/ItemsSection.tsx`
- Create: `src/components/receipt/ItemRow.tsx`

This is the biggest component change. Items show as compact receipt lines that expand on tap to reveal person assignment chips.

**Step 1: Create ItemRow with expandable assignment**

```tsx
"use client";

import { useState } from "react";
import { ReceiptItem, Person } from "@/types";
import { formatCents } from "@/lib/format";
import { CurrencyInput } from "@/components/ui/CurrencyInput";

interface ItemRowProps {
  item: ReceiptItem;
  people: Person[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
}

export function ItemRow({
  item,
  people,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onToggleAssignment,
}: ItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const total = item.quantity * item.priceCents;
  const isUnassigned = people.length > 0 && item.assignedTo.length === 0;
  const allAssigned = people.length > 0 && people.every((p) => item.assignedTo.includes(p.id));

  return (
    <div
      className={`transition-colors ${isUnassigned ? "border-l-2 border-l-amber-500/60" : "border-l-2 border-l-transparent"}`}
    >
      {/* Collapsed row: receipt line */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/50"
      >
        {/* Quantity */}
        <span className="w-6 shrink-0 font-mono text-xs text-zinc-500">
          {item.quantity}×
        </span>

        {/* Name + dot leader */}
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
          {item.name}
        </span>

        {/* Assigned dots */}
        {!isExpanded && item.assignedTo.length > 0 && (
          <span className="flex shrink-0 gap-0.5">
            {item.assignedTo.map((pid) => {
              const person = people.find((p) => p.id === pid);
              return person ? (
                <span
                  key={pid}
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: person.color }}
                />
              ) : null;
            })}
          </span>
        )}

        {/* Price */}
        <span className="shrink-0 font-mono text-sm text-zinc-300">
          {formatCents(total)}
        </span>
      </button>

      {/* Expanded: edit + assignment */}
      {isExpanded && (
        <div className="space-y-3 bg-zinc-800/30 px-3 pb-3">
          {/* Edit fields */}
          <div className="flex items-center gap-3 pt-1">
            <input
              value={item.name}
              onChange={(e) => onUpdate(item.id, { name: e.target.value })}
              className="min-w-0 flex-1 border-b border-amber-500/50 bg-transparent py-1 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              aria-label="Item name"
            />
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              qty
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  onUpdate(item.id, {
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  })
                }
                className="w-10 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center font-mono text-xs text-zinc-300"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-zinc-500">
              $
              <CurrencyInput
                cents={item.priceCents}
                onChangeCents={(cents) =>
                  onUpdate(item.id, { priceCents: cents })
                }
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 font-mono text-xs text-zinc-300"
              />
            </label>
          </div>

          {/* Person assignment chips */}
          {people.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const toToggle = allAssigned
                    ? people.map((p) => p.id)
                    : people.filter((p) => !item.assignedTo.includes(p.id)).map((p) => p.id);
                  toToggle.forEach((pid) => onToggleAssignment(item.id, pid));
                }}
                className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800"
              >
                {allAssigned ? "none" : "all"}
              </button>
              {people.map((person) => {
                const assigned = item.assignedTo.includes(person.id);
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onToggleAssignment(item.id, person.id)}
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                    style={
                      assigned
                        ? { backgroundColor: person.color, color: "#18181b" }
                        : { border: `1px solid ${person.color}60`, color: person.color }
                    }
                    aria-pressed={assigned}
                    aria-label={`${assigned ? "Unassign" : "Assign"} ${person.name}`}
                  >
                    {person.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Delete */}
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            delete item
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create ItemsSection**

```tsx
"use client";

import { useState } from "react";
import { ReceiptItem, Person } from "@/types";
import { Section } from "./Section";
import { ItemRow } from "./ItemRow";

interface ItemsSectionProps {
  items: ReceiptItem[];
  people: Person[];
  onUpdate: (id: string, updates: Partial<Omit<ReceiptItem, "id">>) => void;
  onDelete: (id: string) => void;
  onToggleAssignment: (itemId: string, personId: string) => void;
  onReorder: (items: ReceiptItem[]) => void;
  onAddItem: () => void;
}

export function ItemsSection({
  items,
  people,
  onUpdate,
  onDelete,
  onToggleAssignment,
  onReorder,
  onAddItem,
}: ItemsSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Items ({items.length})
        </h3>
        <button
          type="button"
          onClick={onAddItem}
          className="text-xs text-amber-500 hover:text-amber-400"
        >
          + add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-center font-mono text-xs text-zinc-600">
          no items yet
        </p>
      ) : (
        <div className="-mx-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              people={people}
              isExpanded={expandedId === item.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onUpdate={onUpdate}
              onDelete={onDelete}
              onToggleAssignment={onToggleAssignment}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/receipt/ItemsSection.tsx src/components/receipt/ItemRow.tsx
git commit -m "feat: add expandable ItemRow and ItemsSection for receipt tape"
```

---

### Task 7: Redesign TaxTipSection

**Files:**
- Create: `src/components/receipt/TaxTipSection.tsx`

**Step 1: Create compact TaxTipSection**

```tsx
"use client";

import { useState } from "react";
import { TaxTip } from "@/types";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { Section } from "./Section";

interface TaxTipSectionProps {
  taxTip: TaxTip;
  onChange: (updates: Partial<TaxTip>) => void;
}

const TAX_PRESETS = [5, 7, 8, 10];
const TIP_PRESETS = [15, 18, 20, 25];

function PercentOrDollarInput({
  label,
  isPercent,
  percent,
  cents,
  presets,
  onToggleMode,
  onChangePercent,
  onChangeCents,
}: {
  label: string;
  isPercent: boolean;
  percent: number;
  cents: number;
  presets: number[];
  onToggleMode: (isPercent: boolean) => void;
  onChangePercent: (pct: number) => void;
  onChangeCents: (cents: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayValue = isPercent ? `${percent}%` : `$${(cents / 100).toFixed(2)}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-1 text-sm"
      >
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-200">{displayValue}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pb-2 pt-1">
          {/* Mode toggle */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggleMode(true)}
              className={`rounded px-2 py-0.5 font-mono text-xs ${
                isPercent ? "bg-amber-500/20 text-amber-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              %
            </button>
            <button
              type="button"
              onClick={() => onToggleMode(false)}
              className={`rounded px-2 py-0.5 font-mono text-xs ${
                !isPercent ? "bg-amber-500/20 text-amber-500" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              $
            </button>
          </div>

          {isPercent ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {presets.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => onChangePercent(pct)}
                    className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                      percent === pct
                        ? "bg-amber-500 text-zinc-950 font-semibold"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={percent}
                  onChange={(e) =>
                    onChangePercent(
                      Math.max(0, parseFloat(e.target.value) || 0)
                    )
                  }
                  className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
                />
                <span className="font-mono text-xs text-zinc-500">%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="font-mono text-xs text-zinc-500">$</span>
              <CurrencyInput
                cents={cents}
                onChangeCents={onChangeCents}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs text-zinc-300 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaxTipSection({ taxTip, onChange }: TaxTipSectionProps) {
  return (
    <Section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        Tax & Tip
      </h3>
      <div className="space-y-1">
        <PercentOrDollarInput
          label="Tax"
          isPercent={taxTip.taxIsPercent}
          percent={taxTip.taxPercent}
          cents={taxTip.taxCents}
          presets={TAX_PRESETS}
          onToggleMode={(isPercent) => onChange({ taxIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ taxPercent: pct })}
          onChangeCents={(cents) => onChange({ taxCents: cents })}
        />
        <PercentOrDollarInput
          label="Tip"
          isPercent={taxTip.tipIsPercent}
          percent={taxTip.tipPercent}
          cents={taxTip.tipCents}
          presets={TIP_PRESETS}
          onToggleMode={(isPercent) => onChange({ tipIsPercent: isPercent })}
          onChangePercent={(pct) => onChange({ tipPercent: pct })}
          onChangeCents={(cents) => onChange({ tipCents: cents })}
        />
      </div>
    </Section>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/receipt/TaxTipSection.tsx
git commit -m "feat: add compact TaxTipSection with expandable presets"
```

---

### Task 8: Create TotalsSection and SplitSection

**Files:**
- Create: `src/components/receipt/TotalsSection.tsx`
- Create: `src/components/receipt/SplitSection.tsx`

**Step 1: Create TotalsSection (receipt-style totals)**

```tsx
"use client";

import { ReceiptItem, TaxTip } from "@/types";
import { formatCents } from "@/lib/format";
import { getSubtotalCents, getEffectiveTaxCents, getEffectiveTipCents } from "@/lib/calculator";
import { Section } from "./Section";

interface TotalsSectionProps {
  items: ReceiptItem[];
  taxTip: TaxTip;
}

export function TotalsSection({ items, taxTip }: TotalsSectionProps) {
  const subtotal = getSubtotalCents(items);
  const tax = getEffectiveTaxCents(taxTip, subtotal);
  const tip = getEffectiveTipCents(taxTip, subtotal);
  const total = subtotal + tax + tip;

  if (items.length === 0) return null;

  return (
    <Section>
      <div className="space-y-1.5 font-mono text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>SUBTOTAL</span>
          <span className="text-zinc-300">{formatCents(subtotal)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>
            TAX{taxTip.taxIsPercent ? ` (${taxTip.taxPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tax)}</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>
            TIP{taxTip.tipIsPercent ? ` (${taxTip.tipPercent}%)` : ""}
          </span>
          <span className="text-zinc-300">{formatCents(tip)}</span>
        </div>
        <div className="text-xs text-zinc-600 select-none" aria-hidden="true">
          ================================
        </div>
        <div className="flex justify-between text-base font-bold text-zinc-100">
          <span>TOTAL</span>
          <span>{formatCents(total)}</span>
        </div>
      </div>
    </Section>
  );
}
```

**Step 2: Create SplitSection (per-person breakdowns)**

```tsx
"use client";

import { PersonBreakdown } from "@/types";
import { formatCents } from "@/lib/format";
import { Section } from "./Section";

interface SplitSectionProps {
  breakdowns: PersonBreakdown[];
}

export function SplitSection({ breakdowns }: SplitSectionProps) {
  if (breakdowns.length === 0 || breakdowns.every((b) => b.totalCents === 0)) {
    return null;
  }

  return (
    <Section>
      <div className="mb-3 text-center font-mono text-xs text-zinc-600 select-none" aria-hidden="true">
        ——— SPLIT ———
      </div>
      <div className="space-y-4">
        {breakdowns.map((breakdown) => (
          <PersonSplit key={breakdown.person.id} breakdown={breakdown} />
        ))}
      </div>
    </Section>
  );
}

function PersonSplit({ breakdown }: { breakdown: PersonBreakdown }) {
  const { person, items, subtotalCents, taxShareCents, tipShareCents, totalCents } = breakdown;

  if (totalCents === 0) return null;

  return (
    <div className="space-y-1">
      {/* Person header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: person.color }}
          />
          <span className="text-sm font-semibold text-zinc-200">{person.name}</span>
        </div>
        <span className="font-mono text-sm font-bold text-zinc-100">
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Item breakdown */}
      <div className="space-y-0.5 pl-5">
        {items.map(({ item, shareCents, splitCount }) => (
          <div key={item.id} className="flex justify-between font-mono text-xs text-zinc-500">
            <span className="truncate">
              {item.name}
              {splitCount > 1 && (
                <span className="text-zinc-600"> (1/{splitCount})</span>
              )}
            </span>
            <span className="ml-2">{formatCents(shareCents)}</span>
          </div>
        ))}
        {taxShareCents > 0 && (
          <div className="flex justify-between font-mono text-xs text-zinc-500">
            <span>tax</span>
            <span>{formatCents(taxShareCents)}</span>
          </div>
        )}
        {tipShareCents > 0 && (
          <div className="flex justify-between font-mono text-xs text-zinc-500">
            <span>tip</span>
            <span>{formatCents(tipShareCents)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/receipt/TotalsSection.tsx src/components/receipt/SplitSection.tsx
git commit -m "feat: add receipt-style TotalsSection and SplitSection"
```

---

### Task 9: Create ShareSection

**Files:**
- Create: `src/components/receipt/ShareSection.tsx`

**Step 1: Create compact ShareSection with icon buttons**

```tsx
"use client";

import { useState } from "react";
import { Section } from "./Section";

interface ShareSectionProps {
  shareText: string;
  csvText: string;
  onStartOver: () => void;
}

export function ShareSection({ shareText, csvText, onStartOver }: ShareSectionProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch {
        // user cancelled
      }
    }
  }

  function handleExportCsv() {
    const blob = new Blob([csvText], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "receipt-split.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section className="no-print">
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            type="button"
            onClick={handleShare}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            share
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          pdf
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
        >
          csv
        </button>
      </div>
      <button
        type="button"
        onClick={onStartOver}
        className="mt-4 block w-full text-center text-xs text-zinc-600 hover:text-red-400 transition-colors"
      >
        start over
      </button>
    </Section>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/receipt/ShareSection.tsx
git commit -m "feat: add compact ShareSection with dark-themed action buttons"
```

---

### Task 10: Assemble single-page app and update person colors

**Files:**
- Modify: `src/app/page.tsx` — replace with full single-page receipt tape
- Modify: `src/hooks/useReceipt.ts` — update person colors to dark-friendly palette
- Delete: `src/app/assign/page.tsx`
- Delete: `src/app/summary/page.tsx`

**Step 1: Update person colors in useReceipt.ts**

Replace the COLORS array:

```ts
const COLORS = [
  "#22d3ee", // cyan-400
  "#a78bfa", // violet-400
  "#fb7185", // rose-400
  "#34d399", // emerald-400
  "#fb923c", // orange-400
  "#38bdf8", // sky-400
  "#e879f9", // fuchsia-400
  "#a3e635", // lime-400
];
```

**Step 2: Rewrite page.tsx as single-page receipt tape**

```tsx
"use client";

import { useReceipt } from "@/hooks/useReceipt";
import { calculateBreakdowns } from "@/lib/calculator";
import { generateShareText, generateCsv } from "@/lib/format";
import { ReceiptTape } from "@/components/receipt/ReceiptTape";
import { ReceiptHeader } from "@/components/receipt/ReceiptHeader";
import { ScanSection } from "@/components/receipt/ScanSection";
import { PeopleSection } from "@/components/receipt/PeopleSection";
import { ItemsSection } from "@/components/receipt/ItemsSection";
import { TaxTipSection } from "@/components/receipt/TaxTipSection";
import { TotalsSection } from "@/components/receipt/TotalsSection";
import { SplitSection } from "@/components/receipt/SplitSection";
import { ShareSection } from "@/components/receipt/ShareSection";

export default function ReceiptPage() {
  const receipt = useReceipt();

  const hasItems = receipt.items.length > 0;
  const hasPeople = receipt.people.length > 0;
  const allAssigned =
    hasItems && receipt.items.every((item) => item.assignedTo.length > 0);

  const breakdowns =
    hasItems && hasPeople
      ? calculateBreakdowns(receipt.items, receipt.people, receipt.taxTip)
      : [];

  const shareText =
    breakdowns.length > 0
      ? generateShareText(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const csvText =
    breakdowns.length > 0
      ? generateCsv(receipt.items, receipt.taxTip, breakdowns)
      : "";

  const unassignedCount = receipt.items.filter(
    (item) => item.assignedTo.length === 0
  ).length;

  function handleScanComplete() {
    // Items are already set via context — section just becomes visible
  }

  function handleSkipScan() {
    // Add a placeholder item to trigger items section visibility
    if (receipt.items.length === 0) {
      receipt.addItem("New Item", 1, 0);
    }
  }

  function handleStartOver() {
    receipt.reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <ReceiptTape>
      <ReceiptHeader />

      {/* Scan — always show if no items */}
      {!hasItems && (
        <ScanSection onComplete={handleScanComplete} onSkip={handleSkipScan} />
      )}

      {/* People — show once items exist */}
      {hasItems && (
        <PeopleSection
          people={receipt.people}
          onAdd={receipt.addPerson}
          onUpdate={receipt.updatePerson}
          onDelete={receipt.deletePerson}
        />
      )}

      {/* Items — show once items exist */}
      {hasItems && (
        <ItemsSection
          items={receipt.items}
          people={receipt.people}
          onUpdate={receipt.updateItem}
          onDelete={receipt.deleteItem}
          onToggleAssignment={receipt.toggleAssignment}
          onReorder={receipt.setItems}
          onAddItem={() => receipt.addItem("New Item", 1, 0)}
        />
      )}

      {/* Unassigned warning */}
      {hasItems && hasPeople && !allAssigned && unassignedCount > 0 && (
        <div className="py-2 text-center font-mono text-xs text-amber-500">
          {unassignedCount} item{unassignedCount !== 1 ? "s" : ""} unassigned
        </div>
      )}

      {/* Tax & Tip — show once items exist */}
      {hasItems && (
        <TaxTipSection taxTip={receipt.taxTip} onChange={receipt.setTaxTip} />
      )}

      {/* Totals — show once items exist */}
      {hasItems && (
        <TotalsSection items={receipt.items} taxTip={receipt.taxTip} />
      )}

      {/* Split — show once all assigned */}
      {allAssigned && hasPeople && (
        <SplitSection breakdowns={breakdowns} />
      )}

      {/* Share — show once split is visible */}
      {allAssigned && hasPeople && (
        <ShareSection
          shareText={shareText}
          csvText={csvText}
          onStartOver={handleStartOver}
        />
      )}
    </ReceiptTape>
  );
}
```

**Step 3: Delete old route pages**

```bash
rm src/app/assign/page.tsx src/app/summary/page.tsx
rmdir src/app/assign src/app/summary
```

**Step 4: Delete old assign and summary components (no longer imported)**

```bash
rm -r src/components/assign/ src/components/summary/
```

**Step 5: Build and verify**

Run: `npm run build`
Expected: Builds successfully with no import errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: assemble single-page receipt tape, remove old routes and components"
```

---

### Task 11: Verify tests still pass and fix any issues

**Files:**
- No new files — just verification

**Step 1: Run tests**

Run: `npm test`
Expected: All 23 tests pass. Tests cover parser and calculator logic which is unchanged.

**Step 2: Run build**

Run: `npm run build`
Expected: Clean build with no errors.

**Step 3: Commit (only if fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve any build/test issues from UI redesign"
```

---

### Task 12: Visual polish and final adjustments

**Files:**
- Potentially any of the `src/components/receipt/` files

**Step 1: Run dev server and visually inspect**

Run: `npm run dev`

Check each state:
1. Empty state (no items) — should show header + scan section
2. After skip/scan — items + people sections appear
3. Add people and assign items — chips work, expand/collapse works
4. Tax/tip — presets and custom input work
5. All assigned — totals + split + share appear
6. Share actions — copy, share, pdf, csv all work
7. Start over — resets and scrolls to top

**Step 2: Fix any visual issues found during inspection**

Adjust spacing, colors, or layout as needed based on visual review.

**Step 3: Commit**

```bash
git add -A
git commit -m "fix: visual polish after receipt-tape redesign review"
```
