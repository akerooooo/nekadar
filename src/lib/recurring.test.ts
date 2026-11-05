import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, catchUp, monthlyCost, startDate } from './recurring.ts';

test('gunu gelmemis odeme eklenmez', () => {
  assert.deepEqual(catchUp({ next: '2026-11-10', freq: 'monthly' }, '2026-11-05'), { dates: [], next: '2026-11-10' });
  assert.deepEqual(catchUp({ next: '2026-11-05', freq: 'monthly' }, '2026-11-05'), {
    dates: ['2026-11-05'],
    next: '2026-12-05',
  });
});

test('kacirilan aylarin hepsi eklenir, yil gecisi dahil', () => {
  assert.deepEqual(catchUp({ next: '2025-12-01', freq: 'monthly' }, '2026-02-15').dates, [
    '2025-12-01',
    '2026-01-01',
    '2026-02-01',
  ]);
});

test('haftalik ve yillik', () => {
  assert.equal(advance('2026-12-29', 'weekly'), '2027-01-05');
  assert.equal(advance('2026-02-28', 'yearly'), '2027-02-28');
  assert.deepEqual(catchUp({ next: '2026-11-01', freq: 'weekly' }, '2026-11-15').dates, [
    '2026-11-01',
    '2026-11-08',
    '2026-11-15',
  ]);
});

test('aylik/yillik gun 28 ile sinirlanir', () => {
  assert.equal(startDate('2026-01-31', 'monthly'), '2026-01-28');
  assert.equal(startDate('2026-01-31', 'weekly'), '2026-01-31');
});

test('aylik esdeger', () => {
  assert.equal(monthlyCost({ amount: 120, freq: 'yearly' }), 10);
  assert.equal(monthlyCost({ amount: 12, freq: 'weekly' }), 52);
});
