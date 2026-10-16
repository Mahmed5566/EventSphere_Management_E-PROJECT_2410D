// Pure, dependency-free helpers for the Ctrl+K command palette.
//
// Kept separate from any React/socket/import.meta code so the search logic can
// be unit-tested with Node's built-in runner (see ../tests/palette.test.mjs).
// The palette only offers navigation destinations the current role's sidebar
// exposes (ROLE_NAV) plus events from the same GET /api/expos list the Events
// page already renders — it never invents destinations or data.

export const PALETTE_MAX_RESULTS = 12;

// Map ROLE_NAV entries ([id, label, icon]) into palette items.
export function navToItems(nav = []) {
  return (nav || []).map(([id, label, icon]) => ({
    key: `nav:${id}`,
    label: label || id,
    detail: 'Workspace',
    group: 'Navigate',
    icon: icon || 'fa-arrow-right',
    target: id,
    keywords: `${id} ${label}`.toLowerCase(),
  }));
}

// Map authorised events into palette items that open the Events page.
export function eventToItems(events = []) {
  return (events || []).map((e, i) => {
    const title = (e && e.title) || 'Untitled event';
    let when = '';
    if (e && e.date) {
      const d = new Date(e.date);
      if (!Number.isNaN(d.getTime())) when = d.toLocaleDateString();
    }
    const detail = [e && e.location, when].filter(Boolean).join(' · ') || 'Event';
    return {
      key: `event:${(e && e._id) || `${i}:${title}`}`,
      label: title,
      detail,
      group: 'Events',
      icon: 'fa-calendar-days',
      target: 'events',
      keywords: `${title} ${(e && e.location) || ''} ${(e && e.status) || ''}`.toLowerCase(),
    };
  });
}

export function buildPaletteItems(nav, events) {
  return [...navToItems(nav), ...eventToItems(events)];
}

// Filter + rank. An empty query returns the first few destinations (navigation
// first) so the palette is useful the instant it opens.
export function filterPalette(items, query) {
  const list = items || [];
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return list.slice(0, PALETTE_MAX_RESULTS);

  const ranked = [];
  for (const item of list) {
    const label = String(item.label || '').toLowerCase();
    const haystack = `${item.label} ${item.detail} ${item.keywords}`.toLowerCase();
    const index = haystack.indexOf(q);
    if (index === -1) continue;
    // Prefer matches that begin at the start of the label, then earlier hits.
    const score = (label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2) * 1000 + index;
    ranked.push({ item, score });
  }
  ranked.sort((a, b) => a.score - b.score);
  return ranked.slice(0, PALETTE_MAX_RESULTS).map((r) => r.item);
}
