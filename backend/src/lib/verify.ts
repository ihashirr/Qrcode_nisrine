/**
 * External verification helpers for the Validation-First workflow.
 * Before printing, every GTIN can be manually confirmed against the
 * International Barcodes Database — the URL pre-fills the number so one
 * click shows whether it is unassigned or already owned by the company.
 */
export function verificationUrl(gtin: string): string {
  return `https://barcodesdatabase.org/?s=${encodeURIComponent(gtin)}`;
}

/** Google fallback — surfaces the barcodesdatabase.org listing even if the
 * site's own search misbehaves (this is how registrations usually appear). */
export function googleVerificationUrl(gtin: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(gtin)}`;
}
