import Dexie, { type EntityTable } from 'dexie';
import { normalizeColor, normalizeIcon } from './lib/icons';
import type { RecurringRule } from './lib/recurring';

export type TxType = 'expense' | 'income';

export interface Transaction {
  id?: number;
  type: TxType;
  amount: number; // TL, pozitif
  categoryId: number;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: number;
}

export interface Category {
  id?: number;
  name: string;
  icon: string;
  color: string;
  type: TxType;
}

export interface Budget {
  categoryId: number; // birincil anahtar
  limit: number; // aylik TL
}

export interface Meta {
  key: string;
  value: string;
}

export const db = new Dexie('nekadar') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  categories: EntityTable<Category, 'id'>;
  budgets: EntityTable<Budget, 'categoryId'>;
  meta: EntityTable<Meta, 'key'>;
  recurring: EntityTable<RecurringRule, 'id'>;
};

db.version(1).stores({
  transactions: '++id, type, categoryId, date',
  categories: '++id, type',
  budgets: 'categoryId',
  meta: 'key',
});

// v2: emoji ikonlar yerine ikon adlari, sade renk paleti
db.version(2)
  .stores({
    transactions: '++id, type, categoryId, date',
    categories: '++id, type',
    budgets: 'categoryId',
    meta: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('categories')
      .toCollection()
      .modify((c: Category) => {
        c.icon = normalizeIcon(c.icon);
        c.color = normalizeColor(c.color);
      }),
  );

// v3: tekrarlayan kayitlar; silinmis kategoride kalan kayitlar "Diger"e tasinir
db.version(3)
  .stores({
    transactions: '++id, type, categoryId, date',
    categories: '++id, type',
    budgets: 'categoryId',
    meta: 'key',
    recurring: '++id',
  })
  .upgrade(async (tx) => {
    const cats: Category[] = await tx.table('categories').toArray();
    const ids = new Set(cats.map((c) => c.id));
    const orphans: Transaction[] = await tx.table('transactions').filter((t) => !ids.has(t.categoryId)).toArray();
    for (const type of ['expense', 'income'] as const) {
      const list = orphans.filter((t) => t.type === type);
      if (!list.length) continue;
      const name = type === 'expense' ? 'Diğer' : 'Diğer gelir';
      let target = cats.find((c) => c.type === type && c.name === name)?.id;
      if (target == null) target = await tx.table('categories').add({ ...DEFAULT_CATEGORIES.find((c) => c.name === name)! });
      await tx.table('transactions').where('id').anyOf(list.map((t) => t.id!)).modify({ categoryId: target });
    }
  });

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Market', icon: 'cart', color: '#5b7f6b', type: 'expense' },
  { name: 'Yemek', icon: 'food', color: '#b5687a', type: 'expense' },
  { name: 'Ulaşım', icon: 'bus', color: '#4f6d9a', type: 'expense' },
  { name: 'Fatura', icon: 'bulb', color: '#b8913a', type: 'expense' },
  { name: 'Kira', icon: 'house', color: '#6e5e95', type: 'expense' },
  { name: 'Eğlence', icon: 'film', color: '#3f8c8c', type: 'expense' },
  { name: 'Giyim', icon: 'shirt', color: '#8a9a5b', type: 'expense' },
  { name: 'Sağlık', icon: 'health', color: '#a85454', type: 'expense' },
  { name: 'Diğer', icon: 'package', color: '#8c8f94', type: 'expense' },
  { name: 'Maaş', icon: 'briefcase', color: '#4e8a5e', type: 'income' },
  { name: 'Ek gelir', icon: 'coins', color: '#7a9a4e', type: 'income' },
  { name: 'Diğer gelir', icon: 'wallet', color: '#6b8f7a', type: 'income' },
];

db.on('populate', (tx) => {
  tx.table('categories').bulkAdd(DEFAULT_CATEGORIES);
});

// iOS'un verileri silmemesi icin kalici depolama iste
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    /* desteklenmiyorsa sorun degil */
  }
}
