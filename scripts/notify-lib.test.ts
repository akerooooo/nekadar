import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, istanbulToday, nextSent, type UserData } from './notify-lib.ts';

const base: UserData = {
  today: '2026-11-05',
  subs: [],
  cats: [{ id: 'def-01', name: 'Yemek' }],
  budgets: [],
  totalBudget: 0,
  monthTxs: [],
  sent: {},
};

test('yarin odenecek abonelik bildirilir, eski tarihli kural ilerletilir', () => {
  const subs = [
    { id: 'a', type: 'expense', amount: 99, categoryId: 'def-01', note: 'Netflix', freq: 'monthly', next: '2026-10-06' },
    { id: 'b', type: 'expense', amount: 10, categoryId: 'def-01', note: 'Spotify', freq: 'monthly', next: '2026-11-20' },
    { id: 'c', type: 'income', amount: 10, categoryId: 'def-01', note: 'Maaş', freq: 'monthly', next: '2026-11-06' },
  ] as UserData['subs'];
  const m = buildMessages({ ...base, subs });
  assert.deepEqual(m.map((x) => x.title), ['Yarın Netflix ödemen var']);
  assert.equal(m[0].key, 'sub:a:2026-11-06');
});

test('butce %80 ve asim, ayni uyari iki kez gitmez', () => {
  const u = {
    ...base,
    totalBudget: 1000,
    budgets: [{ categoryId: 'def-01', limit: 100 }],
    monthTxs: [{ type: 'expense', amount: 850, categoryId: 'def-01' }],
  };
  const m = buildMessages(u);
  assert.deepEqual(m.map((x) => x.key), ['budget:total:80:2026-11', 'budget:def-01:100:2026-11']);
  assert.match(m[0].title, /%85/);
  assert.deepEqual(buildMessages({ ...u, sent: nextSent(u, m) }), []);
});

test('eski ayin gonderim kayitlari temizlenir', () => {
  assert.deepEqual(nextSent({ ...base, sent: { 'budget:total:80:2026-09': true } }, []), {});
});

test('Istanbul tarihi', () => {
  assert.equal(istanbulToday(new Date('2026-11-05T22:30:00Z')), '2026-11-06');
});
