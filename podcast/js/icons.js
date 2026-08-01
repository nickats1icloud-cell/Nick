/*
 * Inline SVG icons (στυλ Lucide, stroke-based). Χωρίς emoji, χωρίς icon font,
 * χωρίς εξωτερικό request — απλά strings που μπαίνουν με innerHTML.
 */

const wrap = (paths, opts = {}) =>
  `<svg viewBox="0 0 24 24" fill="${opts.fill || "none"}" stroke="currentColor" ` +
  `stroke-width="${opts.sw || 2}" stroke-linecap="round" stroke-linejoin="round" ` +
  `aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = {
  play: wrap('<path d="M7 4.5v15l13-7.5-13-7.5z" fill="currentColor" stroke="none"/>'),
  pause: wrap(
    '<rect x="7" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>' +
      '<rect x="13" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>'
  ),
  back15: wrap(
    '<path d="M11 4 7 8l4 4"/><path d="M7 8h6a7 7 0 1 1-7 7"/>' +
      '<text x="12" y="17.5" font-size="7" font-family="monospace" fill="currentColor" stroke="none" text-anchor="middle">15</text>'
  ),
  fwd30: wrap(
    '<path d="M13 4l4 4-4 4"/><path d="M17 8h-6a7 7 0 1 0 7 7"/>' +
      '<text x="12" y="17.5" font-size="7" font-family="monospace" fill="currentColor" stroke="none" text-anchor="middle">30</text>'
  ),
  prev: wrap('<path d="M18 5v14L8 12l10-7z" fill="currentColor" stroke="none"/><path d="M6 5v14"/>'),
  next: wrap('<path d="M6 5v14l10-7L6 5z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>'),
  volume: wrap('<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
  mute: wrap('<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  close: wrap('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  menu: wrap('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
  moon: wrap('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
  sun: wrap(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>' +
      '<path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/>' +
      '<path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>'
  ),
  heart: wrap('<path d="M12 20s-7-4.5-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.5 12 20 12 20z"/>'),
  share: wrap('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4"/><path d="m8.6 13.4 6.8 4"/>'),
  link: wrap('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'),
  clock: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  calendar: wrap('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3 10h18"/>'),
  mic: wrap('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
  headphones: wrap('<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="2" y="14" width="5" height="7" rx="2"/><rect x="17" y="14" width="5" height="7" rx="2"/>'),
  check: wrap('<path d="m4 12 5 5L20 6"/>'),
  plus: wrap('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  arrowRight: wrap('<path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>'),
  arrowLeft: wrap('<path d="M19 12H5"/><path d="m11 19-7-7 7-7"/>'),
  rss: wrap('<circle cx="6" cy="18" r="1.6" fill="currentColor"/><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/>'),
  spotify: wrap(
    '<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-1 6.5-.8 9 .8"/>' +
      '<path d="M8 12.6c2.5-.8 5.3-.6 7.4.8"/><path d="M8.6 15.5c2-.6 4.1-.4 5.8.7"/>'
  ),
  apple: wrap('<circle cx="12" cy="12" r="9"/><rect x="10" y="7" width="4" height="7" rx="2"/><path d="M8 12a4 4 0 0 0 8 0"/>'),
  youtube: wrap('<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5-4.5-2.5z" fill="currentColor" stroke="none"/>'),
  discord: wrap('<path d="M8 6.5A14 14 0 0 1 16 6.5"/><path d="M6.5 8C5 10 4.5 13 5 16.5c1.5 1 3 1.5 4 1.5l.8-1.4"/><path d="M17.5 8c1.5 2 2 5 1.5 8.5-1.5 1-3 1.5-4 1.5l-.8-1.4"/><circle cx="9.5" cy="13" r="1.2" fill="currentColor"/><circle cx="14.5" cy="13" r="1.2" fill="currentColor"/>'),
  instagram: wrap('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.2" fill="currentColor"/>'),
  x: wrap('<path d="M4 4l16 16"/><path d="M20 4 4 20"/>'),
  mail: wrap('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  list: wrap('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>'),
  sliders: wrap('<path d="M4 6h10"/><path d="M18 6h2"/><path d="M4 12h4"/><path d="M12 12h8"/><path d="M4 18h12"/><path d="M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  flag: wrap('<path d="M5 21V4"/><path d="M5 5h11l-1.5 3.5L16 12H5"/>'),
  trophy: wrap('<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 3"/><path d="M16 6h3a3 3 0 0 1-3 3"/><path d="M12 13v4"/><path d="M9 20h6"/><path d="M10 17h4l1 3H9l1-3z"/>'),
  gauge: wrap('<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-4"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/>'),
  sparkles: wrap('<path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z"/><path d="M18 15.5 18.8 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8.8-2.5z"/>'),
  inbox: wrap('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l1.5 2.5h5L16 13h5"/>'),
  users: wrap('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 20a6 6 0 0 0-2.5-4.9"/>'),
};

/** Επιστρέφει το SVG string ενός icon (κενό αν δεν υπάρχει). */
export function icon(name) {
  return ICONS[name] || "";
}
