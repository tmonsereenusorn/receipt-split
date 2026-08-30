#!/usr/bin/env node
/**
 * One-off migration: convert stored receipts to the keyed-item shape.
 *
 *   items: [{id, name, quantity, priceCents, assignedTo}]   ->  items:       {id: {name, quantity, priceCents}}
 *                                                               itemOrder:   [id, ...]
 *                                                               assignments: {id: [personId, ...]}
 *   taxTip: {tax*, tip*}                                    ->  charges:     [{id, label, amountCents}]
 *                                                               tip:         {cents, isPercent, percent}
 *
 * Run the dry run first; it writes nothing and prints exactly what would change:
 *
 *   node scripts/migrate-to-keyed-items.mjs            # dry run
 *   node scripts/migrate-to-keyed-items.mjs --apply    # write
 *
 * Idempotent: a receipt already in the keyed shape is skipped, so re-running is
 * safe and a partial run can simply be resumed.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");

const env = Object.fromEntries(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const PROJECT = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const KEY = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Firestore REST value -> plain JS. */
function decode(v) {
  if (v === undefined || v === null) return null;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields ?? {});
  // Throws rather than returning null. The write below replaces the whole
  // document, so an unrecognised type — timestampValue, bytesValue,
  // referenceValue, geoPointValue — would be silently nulled. Today's schema has
  // none, but a field added later, or written by another client, must fail the
  // run rather than quietly erase data.
  throw new Error(`Unsupported Firestore value type: ${Object.keys(v).join(",")}`);
}
const decodeFields = (f) =>
  Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

/** Plain JS -> Firestore REST value. */
function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  // Every number is written as a double, matching what the Firestore JS SDK
  // does, so a migrated document and one the app writes store the same field the
  // same way. It also sidesteps int64: two live receipts hold a priceCents of
  // 1.23e19 from digits mashed into a price field, which overflows integerValue
  // and Firestore rejects outright.
  if (typeof v === "number") return { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
}
const encodeFields = (o) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, encode(v)]));

const DEFAULT_TIP = { cents: 0, isPercent: true, percent: 20 };

/** Mirrors storedFromItems in src/lib/receiptDoc.ts. */
export function keyItems(items) {
  const keyed = {};
  const assignments = {};
  const itemOrder = [];
  // Counted, not just skipped: this is a destructive whole-document write, and a
  // silently dropped item would look identical to a receipt that never had it.
  const dropped = [];
  for (const item of items) {
    if (!item || typeof item.id !== "string") {
      dropped.push(item);
      continue;
    }
    keyed[item.id] = {
      name: String(item.name ?? ""),
      quantity: Number(item.quantity ?? 1),
      priceCents: Number(item.priceCents ?? 0),
    };
    itemOrder.push(item.id);
    if (Array.isArray(item.assignedTo) && item.assignedTo.length > 0) {
      assignments[item.id] = item.assignedTo;
    }
  }
  return { items: keyed, itemOrder, assignments, dropped };
}

/** Mirrors the migrateLegacy that used to live in src/lib/charges.ts. */
export function moneyFromTaxTip(taxTip, items) {
  if (!taxTip) return null;
  const subtotal = items.reduce(
    (s, i) => s + Number(i?.quantity ?? 1) * Number(i?.priceCents ?? 0),
    0
  );
  const charges = [];
  const taxCents = taxTip.taxIsPercent
    ? Math.round((subtotal * Number(taxTip.taxPercent ?? 0)) / 100)
    : Number(taxTip.taxCents ?? 0);
  if (taxCents > 0)
    charges.push({ id: "charge-tax", label: "Tax", amountCents: taxCents });

  const serviceCents = Number(taxTip.serviceCents ?? 0);
  if (serviceCents > 0)
    charges.push({
      id: "charge-service-charge",
      label: "Service Charge",
      amountCents: serviceCents,
    });

  return {
    charges,
    tip: {
      cents: Number(taxTip.tipCents ?? DEFAULT_TIP.cents),
      isPercent: taxTip.tipIsPercent ?? DEFAULT_TIP.isPercent,
      percent: Number(taxTip.tipPercent ?? DEFAULT_TIP.percent),
    },
  };
}

export async function main() {
  const res = await fetch(`${BASE}/receipts?key=${KEY}&pageSize=300`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message);
  const docs = body.documents ?? [];
  if (body.nextPageToken) {
    throw new Error("More than one page of receipts; add pagination first.");
  }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    const id = doc.name.split("/").pop();
    const data = decodeFields(doc.fields ?? {});

    if (!Array.isArray(data.items)) {
      skipped++;
      continue; // already keyed
    }

    const { items, itemOrder, assignments, dropped } = keyItems(data.items);
    const money = moneyFromTaxTip(data.taxTip, data.items);

    // Refuse rather than write a lossy document. The operator can inspect and
    // decide; the alternative is a summary that reports only the survivors.
    if (dropped.length > 0) {
      console.error(
        `  SKIPPED        ${id}: ${dropped.length} of ${data.items.length} items have no usable id`
      );
      failed++;
      continue;
    }

    const next = { ...data, items, itemOrder, assignments };
    if (money) {
      next.charges = Array.isArray(data.charges) ? data.charges : money.charges;
      next.tip = data.tip ?? money.tip;
    } else {
      next.charges = Array.isArray(data.charges) ? data.charges : [];
      next.tip = data.tip ?? DEFAULT_TIP;
    }
    delete next.taxTip;

    const summary = `${id}  ${itemOrder.length}/${data.items.length} items, ${
      Object.keys(assignments).length
    } assigned, ${next.charges.length} charges`;

    if (!APPLY) {
      console.log(`  would migrate  ${summary}`);
      migrated++;
      continue;
    }

    // A full-document PATCH with no updateMask replaces the document, which is
    // what drops the old taxTip and items array in one write.
    const put = await fetch(`${BASE}/receipts/${id}?key=${KEY}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: encodeFields(next) }),
    });
    if (put.ok) {
      console.log(`  migrated       ${summary}`);
      migrated++;
    } else {
      const err = await put.text();
      console.error(`  FAILED         ${id}: ${err.slice(0, 200)}`);
      failed++;
    }
  }

  console.log(
    `\n${APPLY ? "Applied" : "Dry run"}: ${migrated} to migrate, ${skipped} already keyed, ${failed} failed.`
  );
  if (!APPLY) console.log("Re-run with --apply to write.");
  if (failed > 0) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("migrate-to-keyed-items.mjs")) main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
