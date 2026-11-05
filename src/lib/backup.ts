import { convertLegacy, db, type Budget, type Category, type Goal, type Meta, type Transaction } from '../db';
import { csvCell, toISODate } from './format';
import type { RecurringRule } from './recurring';

interface BackupFile {
  app: 'nekadar';
  version: 1 | 2; // 1: sayisal kimlikler (v1.2 ve oncesi)
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  recurring?: RecurringRule[]; // eski yedeklerde yok
  meta?: Meta[]; // yalnizca totalBudget
  goals?: Goal[]; // v1.4 oncesi yedeklerde yok
}

/** iPhone'da Paylas menusunu acar (Dosyalar'a kaydet, WhatsApp, Mail...), olmazsa indirir */
async function deliverFile(name: string, blob: Blob) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') throw e;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function markBackedUp() {
  await db.meta.put({ key: 'lastBackup', value: new Date().toISOString() });
}

export async function exportJSON() {
  const data: BackupFile = {
    app: 'nekadar',
    version: 2,
    exportedAt: new Date().toISOString(),
    categories: await db.cats.toArray(),
    transactions: await db.entries.toArray(),
    budgets: await db.budgets.toArray(),
    recurring: await db.subs.toArray(),
    meta: await db.meta.where('key').equals('totalBudget').toArray(),
    goals: await db.goals.toArray(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await deliverFile(`nekadar-yedek-${toISODate(new Date())}.json`, blob);
  await markBackedUp();
}

export async function exportCSV() {
  const cats = new Map((await db.cats.toArray()).map((c) => [c.id, c.name]));
  const txs = (await db.entries.toArray()).sort((a, b) => a.date.localeCompare(b.date));
  const rows = [
    ['Tarih', 'Tür', 'Kategori', 'Tutar', 'Not'],
    ...txs.map((t) => [
      t.date.split('-').reverse().join('.'),
      t.type === 'income' ? 'Gelir' : 'Gider',
      cats.get(t.categoryId) ?? '',
      t.amount.toFixed(2).replace('.', ','),
      t.note,
    ]),
  ];
  // Turkce Excel ; ayiraci ve BOM ile dogru acar
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  await deliverFile(`nekadar-${toISODate(new Date())}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

function isBackup(x: unknown): x is BackupFile {
  const b = x as BackupFile;
  return (
    !!b &&
    b.app === 'nekadar' &&
    Array.isArray(b.categories) &&
    Array.isArray(b.transactions) &&
    Array.isArray(b.budgets) &&
    b.transactions.every((t) => typeof t.amount === 'number' && typeof t.date === 'string')
  );
}

/** Yedegi geri yukler; mevcut verilerin yerine gecer. Kayit sayisini dondurur. */
export async function importJSON(file: File): Promise<number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Dosya okunamadı. Nekadar yedek dosyası (.json) seçtiğinden emin ol.');
  }
  if (!isBackup(parsed)) throw new Error('Bu dosya bir Nekadar yedeği değil.');
  const n =
    parsed.version === 2
      ? { cats: parsed.categories, entries: parsed.transactions, budgets: parsed.budgets, subs: parsed.recurring ?? [] }
      : convertLegacy(parsed); // eski yedek: kimlikleri cevir, emoji ikonlari duzelt
  await db.transaction('rw', [db.cats, db.entries, db.budgets, db.subs, db.meta, db.goals], async () => {
    await Promise.all([
      db.cats.clear(),
      db.entries.clear(),
      db.budgets.clear(),
      db.subs.clear(),
      db.goals.clear(),
      db.meta.delete('totalBudget'),
    ]);
    await db.meta.bulkPut((parsed.meta ?? []).filter((m) => m.key === 'totalBudget'));
    await db.cats.bulkAdd(n.cats);
    await db.entries.bulkAdd(n.entries);
    await db.budgets.bulkAdd(n.budgets);
    await db.subs.bulkAdd(n.subs);
    await db.goals.bulkAdd(parsed.goals ?? []);
  });
  return parsed.transactions.length;
}

export async function getLastBackup(): Promise<Date | null> {
  const m = await db.meta.get('lastBackup');
  return m ? new Date(m.value) : null;
}
