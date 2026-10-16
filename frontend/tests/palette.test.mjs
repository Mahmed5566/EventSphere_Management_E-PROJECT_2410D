// Unit tests for the command-palette search helpers.
// Run with: cd frontend && npm test   (Node's built-in test runner)
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PALETTE_MAX_RESULTS,
  navToItems,
  eventToItems,
  buildPaletteItems,
  filterPalette,
} from '../src/lib/palette.js';

const NAV = [
  ['overview', 'Overview', 'fa-gauge-high'],
  ['events', 'My Events', 'fa-calendar-days'],
  ['reports', 'Reports', 'fa-chart-pie'],
];

const EVENTS = [
  { _id: 'e1', title: 'Tech Summit 2026', location: 'Lahore Expo Center', date: '2026-12-31T09:00:00.000Z', status: 'published' },
  { _id: 'e2', title: 'Design Night', location: 'Karachi', status: 'draft' },
];

test('navToItems maps nav tuples to palette items', () => {
  const items = navToItems(NAV);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    key: 'nav:overview',
    label: 'Overview',
    detail: 'Workspace',
    group: 'Navigate',
    icon: 'fa-gauge-high',
    target: 'overview',
    keywords: 'overview overview',
  });
});

test('navToItems tolerates empty input', () => {
  assert.deepEqual(navToItems(), []);
  assert.deepEqual(navToItems(null), []);
});

test('eventToItems maps events and is resilient to missing fields', () => {
  const items = eventToItems(EVENTS);
  assert.equal(items.length, 2);
  assert.equal(items[0].group, 'Events');
  assert.equal(items[0].target, 'events');
  assert.match(items[0].detail, /Lahore Expo Center/);

  const sparse = eventToItems([{}]);
  assert.equal(sparse[0].label, 'Untitled event');
  assert.equal(sparse[0].detail, 'Event');
  assert.ok(sparse[0].key.startsWith('event:'));
});

test('buildPaletteItems concatenates nav then events', () => {
  const items = buildPaletteItems(NAV, EVENTS);
  assert.equal(items.length, 5);
  assert.equal(items[0].group, 'Navigate');
  assert.equal(items[items.length - 1].group, 'Events');
});

test('filterPalette returns the first destinations for an empty query', () => {
  const items = buildPaletteItems(NAV, EVENTS);
  const out = filterPalette(items, '   ');
  assert.equal(out.length, Math.min(items.length, PALETTE_MAX_RESULTS));
  assert.equal(out[0].key, 'nav:overview');
});

test('filterPalette matches on label, detail and keywords, case-insensitively', () => {
  const items = buildPaletteItems(NAV, EVENTS);
  assert.deepEqual(filterPalette(items, 'reports').map((x) => x.key), ['nav:reports']);
  assert.deepEqual(filterPalette(items, 'lahore').map((x) => x.key), ['event:e1']);
  assert.deepEqual(filterPalette(items, 'DRAFT').map((x) => x.key), ['event:e2']);
});

test('filterPalette prefers label-prefix matches over mid-string matches', () => {
  const items = [
    { key: 'a', label: 'Reports', detail: '', group: 'g', keywords: 'reports' },
    { key: 'b', label: 'Weekly reports digest', detail: '', group: 'g', keywords: 'digest' },
  ];
  assert.deepEqual(filterPalette(items, 'reports').map((x) => x.key), ['a', 'b']);
});

test('filterPalette caps the result count', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    key: `k${i}`,
    label: `Item ${i} match`,
    detail: '',
    group: 'g',
    keywords: 'match',
  }));
  assert.equal(filterPalette(many, 'match').length, PALETTE_MAX_RESULTS);
});

test('filterPalette returns nothing when there is no match', () => {
  const items = buildPaletteItems(NAV, EVENTS);
  assert.deepEqual(filterPalette(items, 'zzzzz-not-here'), []);
});

test('filterPalette handles missing/odd input', () => {
  assert.deepEqual(filterPalette(undefined, 'x'), []);
  assert.equal(filterPalette(buildPaletteItems(NAV, EVENTS), null).length, 5);
});
