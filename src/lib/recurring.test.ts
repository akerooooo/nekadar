import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueDates } from './recurring.ts';

test('gunu gelmemis ay eklenmez', () => {
  assert.deepEqual(dueDates({ day: 10, lastMonth: '2026-10' }, '2026-11-05'), []);
  assert.deepEqual(dueDates({ day: 5, lastMonth: '2026-10' }, '2026-11-05'), ['2026-11-05']);
});

test('kacirilan aylarin hepsi eklenir, yil gecisi dahil', () => {
  assert.deepEqual(dueDates({ day: 1, lastMonth: '2025-11' }, '2026-02-15'), [
    '2025-12-01',
    '2026-01-01',
    '2026-02-01',
  ]);
});

test('gun 28 ile sinirlanir', () => {
  assert.deepEqual(dueDates({ day: 31, lastMonth: '2026-01' }, '2026-02-28'), ['2026-02-28']);
});

test('ayni ay icin tekrar calisinca bos doner', () => {
  assert.deepEqual(dueDates({ day: 1, lastMonth: '2026-11' }, '2026-11-30'), []);
});
