/* Βοηθητικά για μορφοποίηση κειμένου/χρόνου (ελληνικά locale). */

const MONTHS = [
  "Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν",
  "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ",
];

/** 4920 → "1:22:00" | 3120 → "52:00" */
export function timecode(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 4920 → "82 λεπτά" */
export function durationLabel(seconds) {
  const minutes = Math.round((seconds || 0) / 60);
  if (minutes < 60) return `${minutes} λεπτά`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}ω ${m}λ` : `${h} ώρες`;
}

/** "2026-07-23" → "23 Ιουλ 2026" */
export function dateLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-07-23" → "πριν 9 ημέρες" (χονδρικά, για badges) */
export function relativeLabel(iso) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return "σήμερα";
  if (days === 1) return "χθες";
  if (days < 7) return `πριν ${days} ημέρες`;
  if (days < 30) return `πριν ${Math.floor(days / 7)} εβδομάδες`;
  if (days < 365) return `πριν ${Math.floor(days / 30)} μήνες`;
  return `πριν ${Math.floor(days / 365)} χρόνια`;
}

/** 148000 → "148χιλ." */
export function compactNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(".0", "")}εκ.`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")}χιλ.`;
  return String(n);
}

/** Escape για ασφαλή εισαγωγή σε innerHTML. */
export function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Αφαιρεί τόνους ώστε "Μανιάτης" να βρίσκεται και ως "μανιατης". */
export function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
