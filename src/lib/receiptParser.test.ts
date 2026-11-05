import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReceipt } from './receiptParser.ts';

test('TOPLAM satirini nakit odemeye tercih eder', () => {
  const r = parseReceipt(
    'MIGROS TICARET A.S.\nTARIH : 03.11.2026 SAAT: 18:42\nSUT 1 LT  *32,50\nTOPKDV  *23,64\nTOPLAM  *237,40\nNAKIT  *250,00\nPARA USTU  *12,60',
  );
  assert.deepEqual(r, { amount: 237.4, date: '2026-11-03', merchant: 'MIGROS TICARET A.S.' });
});

test('toplam alt satirdaysa onu okur', () => {
  const r = parseReceipt('A101 YENI MAGAZACILIK\n12/10/2026\nURUN A 1.049,90\nKDV 130,00\nGENEL TOPLAM\n1.300,00');
  assert.equal(r.amount, 1300);
  assert.equal(r.date, '2026-10-12');
});

test('toplam yoksa en buyuk tutari alir', () => {
  const r = parseReceipt('KAFE MOLA\n05-11-26\nLATTE 85,00\nKEK 65,00');
  assert.equal(r.amount, 85);
  assert.equal(r.date, '2026-11-05');
});
