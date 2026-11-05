import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchEntry } from './search.ts';

const e = { note: 'Migros alışveriş', amount: 250.5 };

test('not ve kategori adi, Turkce harf duyarsiz', () => {
  assert.ok(matchEntry(e, 'MİGROS'));
  assert.ok(matchEntry(e, 'alış'));
  assert.ok(matchEntry(e, 'mark', 'Market'));
  assert.ok(!matchEntry(e, 'netflix', 'Market'));
  assert.ok(matchEntry(e, '  '));
});

test('tutar', () => {
  assert.ok(matchEntry(e, '250'));
  assert.ok(matchEntry(e, '250,50'));
  assert.ok(matchEntry(e, '250.5'));
  assert.ok(!matchEntry(e, '250,00'));
  assert.ok(matchEntry({ note: '', amount: 1250 }, '1.250'));
  assert.ok(!matchEntry({ note: '', amount: 1250 }, '125'));
});
