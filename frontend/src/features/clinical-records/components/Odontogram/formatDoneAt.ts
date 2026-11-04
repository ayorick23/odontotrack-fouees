const DONE_DATE = new Intl.DateTimeFormat("es-SV", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** "2026-11-01" → "1 nov 2026" (sin desfase de zona horaria). */
export function formatDoneAt(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return DONE_DATE.format(new Date(year, month - 1, day)).replace(".", "");
}
