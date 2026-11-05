import Dexie, { type EntityTable } from 'dexie';

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
};

db.version(1).stores({
  transactions: '++id, type, categoryId, date',
  categories: '++id, type',
  budgets: 'categoryId',
  meta: 'key',
});

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Market', icon: '🛒', color: '#0f766e', type: 'expense' },
  { name: 'Yemek', icon: '🍔', color: '#ea580c', type: 'expense' },
  { name: 'Ulaşım', icon: '🚌', color: '#2563eb', type: 'expense' },
  { name: 'Fatura', icon: '💡', color: '#ca8a04', type: 'expense' },
  { name: 'Kira', icon: '🏠', color: '#7c3aed', type: 'expense' },
  { name: 'Eğlence', icon: '🎬', color: '#db2777', type: 'expense' },
  { name: 'Giyim', icon: '👕', color: '#0891b2', type: 'expense' },
  { name: 'Sağlık', icon: '💊', color: '#dc2626', type: 'expense' },
  { name: 'Diğer', icon: '📦', color: '#64748b', type: 'expense' },
  { name: 'Maaş', icon: '💼', color: '#16a34a', type: 'income' },
  { name: 'Ek gelir', icon: '💰', color: '#65a30d', type: 'income' },
  { name: 'Diğer gelir', icon: '➕', color: '#4d7c0f', type: 'income' },
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
