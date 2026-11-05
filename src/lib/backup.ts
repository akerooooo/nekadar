import { db, type Budget, type Category, type Transaction } from '../db';
import { toISODate } from './format';
import { normalizeColor, normalizeIcon } from './icons';

interface BackupFile {
  app: 'nekadar';
  version: 1;
  exportedAt: string;
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
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
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  await deliverFile(`nekadar-yedek-${toISODate(new Date())}.json`, blob);
  await markBackedUp();
}

export async function exportCSV() {
  const cats = new Map((await db.categories.toArray()).map((c) => [c.id, c.name]));
  const txs = (await db.transactions.toArray()).sort((a, b) => a.date.localeCompare(b.date));
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
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
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n');
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
  await db.transaction('rw', [db.categories, db.transactions, db.budgets], async () => {
    await Promise.all([db.categories.clear(), db.transactions.clear(), db.budgets.clear()]);
    // Eski surum yedeklerindeki emoji ikonlari yeni ikonlara cevir
    await db.categories.bulkAdd(
      parsed.categories.map((c) => ({ ...c, icon: normalizeIcon(c.icon), color: normalizeColor(c.color) })),
    );
    await db.transactions.bulkAdd(parsed.transactions);
    await db.budgets.bulkAdd(parsed.budgets);
  });
  return parsed.transactions.length;
}

export async function getLastBackup(): Promise<Date | null> {
  const m = await db.meta.get('lastBackup');
  return m ? new Date(m.value) : null;
}
