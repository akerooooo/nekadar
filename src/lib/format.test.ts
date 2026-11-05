import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareRange, parseAmount } from './format.ts';

test('parseAmount Turkce ve Ingilizce yazimlari okur', () => {
  const cases: [string, number][] = [
    ['1.250,50', 1250.5],
    ['1250.5', 1250.5],
    ['1.250', 1250],
    ['12.50', 12.5],
    ['1,5', 1.5],
    ['1.000.000', 1000000],
    ['1,000,000', 1000000],
    ['1.000.000,99', 1000000.99],
    ['1,000,000.50', 1000000.5],
    ['₺ 250', 250],
    ['250 TL', 250],
    ['1 250', 1250],
    ['100.00', 100],
  ];
  for (const [input, expected] of cases) assert.equal(parseAmount(input), expected, input);
});

test('parseAmount anlamsiz girisi reddeder', () => {
  for (const input of ['', 'abc', '12,5,3', '1.2.3', '-50', ' -1,5']) assert.ok(Number.isNaN(parseAmount(input)), input);
});

test('kiyas araligi: bu ay ise gecen ayin ayni donemi', () => {
  assert.deepEqual(compareRange('2026-11', '2026-11-06'), { from: '2026-10-01', to: '2026-10-06', partial: true });
  assert.deepEqual(compareRange('2026-10', '2026-11-06'), { from: '2026-09-01', to: '2026-09-31', partial: false });
  assert.deepEqual(compareRange('2026-01', '2026-01-31'), { from: '2025-12-01', to: '2025-12-31', partial: true });
});
