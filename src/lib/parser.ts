import { ReceiptItem } from "@/types";

let nextId = 1;
function makeId(): string {
  return `item-${nextId++}`;
}

/** Reset ID counter (for testing) */
export function resetIdCounter(): void {
  nextId = 1;
}

/**
 * Parse cents from a price string like "12.99", "$12.99", "1,299"
 */
function parseCents(priceStr: string): number | null {
  // Remove dollar signs, spaces
  let cleaned = priceStr.replace(/[$\s]/g, "");
  // Handle comma as thousands separator (1,299 -> 1299) or decimal (1,99 -> 1.99)
  if (/^\d{1,3},\d{3}/.test(cleaned)) {
    // Thousands separator
    cleaned = cleaned.replace(/,/g, "");
  } else if (/,\d{2}$/.test(cleaned)) {
    // European decimal
    cleaned = cleaned.replace(",", ".");
  }
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0) return null;
  return Math.round(num * 100);
}

/**
 * Lines to skip — common receipt noise
 */
const SKIP_PATTERNS = [
  /^\s*$/,
  /subtotal/i,
  /sub\s*total/i,
  /^total/i,
  /\btax\b/i,
  /\btip\b/i,
  /\bgratuity\b/i,
  /\bchange\b/i,
  /\bbalance\b/i,
  /\bamount\s*due\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bcash\b/i,
  /\bdebit\b/i,
  /\bcredit\b/i,
  /\bcard\b/i,
  /\bpayment\b/i,
  /thank\s*you/i,
  /\bguest\b/i,
  /\bserver\b/i,
  /\bcheck\s*#/i,
  /\btable\b/i,
  /\bdate\b/i,
  /\btime\b/i,
  /\border\s*#/i,
  /\bphone\b/i,
  /\baddress\b/i,
  /www\./i,
  /\.com/i,
  /^\d{1,2}[/:]\d{2}/,  // timestamps
  /^\d{1,2}-\d{1,2}-\d{2,4}/, // dates
  /^\*+$/,
  /^-+$/,
  /^=+$/,
];

function shouldSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(line.trim()));
}

/**
 * Multi-pattern receipt line parser.
 * Intentionally lenient — better to include a dubious line than miss a real item.
 */
export function parseReceiptText(text: string): ReceiptItem[] {
  resetIdCounter();
  const lines = text.split("\n");
  const items: ReceiptItem[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || shouldSkipLine(line)) continue;

    let match: RegExpMatchArray | null;

    // Pattern 1: qty x name ... price (e.g., "2 x Burger 12.99" or "2x Burger $12.99")
    match = line.match(
      /^(\d+)\s*[xX×]\s+(.+?)\s+\$?([\d,]+\.\d{2})\s*$/
    );
    if (match) {
      const qty = parseInt(match[1], 10);
      const cents = parseCents(match[3]);
      if (cents !== null) {
        items.push({
          id: makeId(),
          name: match[2].trim(),
          quantity: qty,
          priceCents: cents,
          assignedTo: [],
        });
        continue;
      }
    }

    // Pattern 2: qty name ... price (e.g., "2 Burger 12.99")
    match = line.match(
      /^(\d+)\s+([A-Za-z].+?)\s+\$?([\d,]+\.\d{2})\s*$/
    );
    if (match) {
      const qty = parseInt(match[1], 10);
      if (qty >= 1 && qty <= 99) {
        const cents = parseCents(match[3]);
        if (cents !== null) {
          items.push({
            id: makeId(),
            name: match[2].trim(),
            quantity: qty,
            priceCents: cents,
            assignedTo: [],
          });
          continue;
        }
      }
    }

    // Pattern 3: name ... price (e.g., "Burger $12.99" or "Burger 12.99")
    match = line.match(
      /^([A-Za-z].+?)\s+\$?([\d,]+\.\d{2})\s*$/
    );
    if (match) {
      const cents = parseCents(match[2]);
      if (cents !== null) {
        items.push({
          id: makeId(),
          name: match[1].trim(),
          quantity: 1,
          priceCents: cents,
          assignedTo: [],
        });
        continue;
      }
    }
  }

  return items;
}
