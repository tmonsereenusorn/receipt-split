import { ReceiptItem } from "@/types";

function makeId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
 * Extract the restaurant name from the first few lines of OCR text.
 * Returns the first non-blank line that doesn't look like noise.
 */
export function parseRestaurantName(text: string): string | null {
  const lines = text.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (shouldSkipLine(line)) continue;
    // Phone number
    if (/^\d{3}[-.\s]?\d{3}/.test(line)) continue;
    // Address (number + street name + suffix)
    if (/^\d+\s+\w+\s+(st|ave|blvd|rd|dr|ln|ct|way|pkwy)/i.test(line)) continue;
    // Price-only line
    if (/^\$?[\d,]+\.\d{2}$/.test(line)) continue;
    // Must start with a letter
    if (!/^[A-Za-z]/.test(line)) continue;

    return line;
  }

  return null;
}

/**
 * Lines to skip — common receipt noise
 */
const SKIP_PATTERNS = [
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
 * Check if a line is just a price (e.g., "9.50", "$14.95")
 */
function isPriceLine(line: string): boolean {
  return /^\$?[\d,]+\.\d{2}\s*$/.test(line.trim());
}

/**
 * Check if a line looks like an item name (starts with a letter, no trailing price)
 */
function isNameLine(line: string): boolean {
  return /^[A-Za-z]/.test(line.trim()) && !isPriceLine(line);
}

/**
 * Multi-pattern receipt line parser.
 * Intentionally lenient — better to include a dubious line than miss a real item.
 * Supports both single-line (name + price) and multi-line (name on one line, price on next).
 */
export function parseReceiptText(text: string): ReceiptItem[] {
  const lines = text.split("\n");
  const items: ReceiptItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
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

    // Pattern 4: Multi-line — name on this line, price on next line
    // Google Vision often splits these across lines
    if (isNameLine(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (isPriceLine(nextLine)) {
        const cents = parseCents(nextLine.replace(/^\$/, ""));
        if (cents !== null) {
          items.push({
            id: makeId(),
            name: line,
            quantity: 1,
            priceCents: cents,
            assignedTo: [],
          });
          i++; // skip the price line
          continue;
        }
      }
    }
  }

  return items;
}
