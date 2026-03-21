/**
 * Get the number of decimal places for a currency's subunit.
 * Uses Intl.NumberFormat to avoid maintaining a manual mapping.
 */
export function subunitDecimals(currency: string): number {
  const fmt = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  });
  return fmt.resolvedOptions().maximumFractionDigits ?? 2;
}

/**
 * Format a subunit amount as a localized currency string.
 * e.g. formatMoney(1299, "USD") → "$12.99"
 *      formatMoney(1500, "JPY") → "¥1,500"
 */
export function formatMoney(subunits: number, currency: string): string {
  const decimals = subunitDecimals(currency);
  const value = subunits / Math.pow(10, decimals);
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).format(value);
}

/**
 * Format a subunit amount as a plain number string (no currency symbol).
 * e.g. formatMoneyRaw(1299, "USD") → "12.99"
 *      formatMoneyRaw(1500, "JPY") → "1500"
 */
export function formatMoneyRaw(subunits: number, currency: string): string {
  const decimals = subunitDecimals(currency);
  const value = subunits / Math.pow(10, decimals);
  return decimals === 0 ? String(value) : value.toFixed(decimals);
}

/**
 * Get the symbol for a currency code.
 * e.g. "USD" → "$", "EUR" → "€"
 */
export function currencySymbol(currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currency;
}

/**
 * Infer a default currency from a locale string (e.g. "en-US" → "USD").
 * Falls back to "USD" if the locale can't be resolved.
 */
export function defaultCurrencyFromLocale(locale: string): string {
  try {
    const region = locale.split("-")[1]?.toUpperCase();
    if (!region) return "USD";

    const regionCurrencyMap: Record<string, string> = {
      US: "USD", GB: "GBP", JP: "JPY", EU: "EUR", CA: "CAD", AU: "AUD",
      CN: "CNY", KR: "KRW", IN: "INR", MX: "MXN", BR: "BRL", CH: "CHF",
      SE: "SEK", NO: "NOK", DK: "DKK", NZ: "NZD", SG: "SGD", HK: "HKD",
      TW: "TWD", TH: "THB", PH: "PHP", MY: "MYR", ID: "IDR", VN: "VND",
      AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY", ZA: "ZAR", EG: "EGP",
      NG: "NGN", KE: "KES", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
      BG: "BGN", HR: "EUR", RU: "RUB", UA: "UAH", CL: "CLP", CO: "COP",
      AR: "ARS", PE: "PEN", BH: "BHD", KW: "KWD", QA: "QAR",
      DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
      AT: "EUR", PT: "EUR", FI: "EUR", IE: "EUR", GR: "EUR", SK: "EUR",
      SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", MT: "EUR",
      CY: "EUR",
    };
    return regionCurrencyMap[region] ?? "USD";
  } catch {
    return "USD";
  }
}
