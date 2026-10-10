const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** 1234.5 -> "1.234,50 €" */
export function formatEuro(amount: number): string {
  return euro.format(amount);
}

/** "2026-05-01" oder "2026-05-01T10:00:00+02:00" -> "01.05.2026" (ohne Zeitzonen-Verschiebung). */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
