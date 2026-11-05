import Dexie, { type DBCore, type DBCoreMutateRequest, type EntityTable, type Transaction as DexieTx } from 'dexie';
import { normalizeColor, normalizeIcon } from './lib/icons';
import { startDate, type RecurringRule } from './lib/recurring';

export type TxType = 'expense' | 'income';

export interface Transaction {
  id?: string;
  type: TxType;
  amount: number; // TL, pozitif
  categoryId: string;
  date: string; // YYYY-MM-DD
  note: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Category {
  id?: string;
  name: string;
  icon: string;
  color: string;
  type: TxType;
  updatedAt?: number;
}

export interface Budget {
  categoryId: string; // birincil anahtar
  limit: number; // aylik TL
  updatedAt?: number;
}

export interface Meta {
  key: string;
  value: string;
  updatedAt?: number;
}

/** Eşitleme kuyrugu: bulutla eşitlenmeyi bekleyen kayitlarin "tablo/anahtar"i */
export interface OutboxItem {
  key: string;
  at: number;
}

export const db = new Dexie('nekadar') as Dexie & {
  entries: EntityTable<Transaction, 'id'>;
  cats: EntityTable<Category, 'id'>;
  budgets: EntityTable<Budget, 'categoryId'>;
  meta: EntityTable<Meta, 'key'>;
  subs: EntityTable<RecurringRule, 'id'>;
  outbox: EntityTable<OutboxItem, 'key'>;
};

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

// Varsayilan kategoriler her cihazda ayni kimlige sahip; eşitlemede cift olmaz
const defId = (i: number) => `def-${String(i).padStart(2, '0')}`;
export const defaultCategories = (): Category[] => DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: defId(i) }));

db.version(1).stores({
  transactions: '++id, type, categoryId, date',
  categories: '++id, type',
  budgets: 'categoryId',
  meta: 'key',
});

// v2: emoji ikonlar yerine ikon adlari, sade renk paleti
db.version(2)
  .stores({})
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
  .stores({ recurring: '++id' })
  .upgrade(async (tx) => {
    const cats: { id: number; name: string; type: TxType }[] = await tx.table('categories').toArray();
    const ids = new Set(cats.map((c) => c.id));
    const orphans: { id: number; type: TxType }[] = await tx
      .table('transactions')
      .filter((t) => !ids.has(t.categoryId))
      .toArray();
    for (const type of ['expense', 'income'] as const) {
      const list = orphans.filter((t) => t.type === type);
      if (!list.length) continue;
      const name = type === 'expense' ? 'Diğer' : 'Diğer gelir';
      let target = cats.find((c) => c.type === type && c.name === name)?.id;
      if (target == null) target = await tx.table('categories').add({ ...DEFAULT_CATEGORIES.find((c) => c.name === name)! });
      await tx.table('transactions').where('id').anyOf(list.map((t) => t.id)).modify({ categoryId: target });
    }
  });

/** Eski sayisal kimlikli veriyi (v3 ve eski yedekler) metin kimlige cevirir */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertLegacy(old: { categories: any[]; transactions: any[]; budgets: any[]; recurring?: any[] }) {
  const idMap = new Map<unknown, string>();
  const cats: Category[] = old.categories.map((c) => {
    const i = DEFAULT_CATEGORIES.findIndex((d) => d.name === c.name && d.type === c.type);
    const id = i >= 0 && ![...idMap.values()].includes(defId(i)) ? defId(i) : crypto.randomUUID();
    idMap.set(c.id, id);
    return { name: c.name, type: c.type, icon: normalizeIcon(c.icon), color: normalizeColor(c.color), id };
  });
  const cat = (id: unknown) => idMap.get(id) ?? String(id);
  return {
    cats,
    entries: old.transactions.map(({ id: _, ...t }) => ({ ...t, id: crypto.randomUUID(), categoryId: cat(t.categoryId) })) as Transaction[],
    budgets: old.budgets.map((b) => ({ categoryId: cat(b.categoryId), limit: b.limit })) as Budget[],
    subs: (old.recurring ?? []).map(({ id: _, day, lastMonth, ...r }) => {
      const [y, m] = String(lastMonth).split('-').map(Number);
      const next = new Date(Date.UTC(y, m, Math.min(Math.max(day, 1), 28))).toISOString().slice(0, 10);
      return { ...r, id: crypto.randomUUID(), categoryId: cat(r.categoryId), freq: 'monthly', next: startDate(next, 'monthly') };
    }) as RecurringRule[],
  };
}

// v4: eşitleme icin metin (UUID) kimlikler; eski tablolar yenilerine tasinir
db.version(4)
  .stores({
    transactions: null,
    categories: null,
    recurring: null,
    entries: 'id, categoryId, date',
    cats: 'id',
    subs: 'id',
    outbox: 'key',
  })
  .upgrade(async (tx) => {
    markRemote(tx); // tasinan kayitlar updatedAt almaz: ilk giriste buluttaki surum kazanir
    const old = {
      categories: await tx.table('categories').toArray(),
      transactions: await tx.table('transactions').toArray(),
      budgets: await tx.table('budgets').toArray(),
      recurring: await tx.table('recurring').toArray(),
    };
    const n = convertLegacy(old);
    await tx.table('cats').bulkAdd(n.cats);
    await tx.table('entries').bulkAdd(n.entries);
    await tx.table('subs').bulkAdd(n.subs);
    await tx.table('budgets').clear();
    await tx.table('budgets').bulkAdd(n.budgets);
  });

db.on('populate', (tx) => {
  markRemote(tx); // varsayilanlar buluttaki duzenlenmis hallerini ezmesin
  tx.table('cats').bulkAdd(defaultCategories());
});

// Yeni kayitlara UUID ver
for (const t of [db.entries, db.cats, db.subs]) t.hook('creating', (key) => (key == null ? crypto.randomUUID() : undefined));

/** Bulutla eşitlenen tablolar ve birincil anahtar alanlari */
export const SYNCED: Record<string, string> = { entries: 'id', cats: 'id', budgets: 'categoryId', subs: 'id', meta: 'key' };
const SYNCED_META = new Set(['totalBudget']); // digerleri (lastBackup, eşitleme durumu) cihaza ozel
export const syncState = { on: false };

/** Bu islemdeki yazmalar updatedAt almaz ve buluta geri gonderilmez */
export const markRemote = (tx: DexieTx) => ((tx.idbtrans as unknown as { remote: boolean }).remote = true);

/**
 * Her yazmada updatedAt koyar ve giris yapilmissa degisen anahtari outbox'a ekler.
 * Buluttan gelen yazmalar (idbtrans.remote) isaretlenmez, yoksa geri gonderilirdi.
 */
db.use({
  stack: 'dbcore',
  name: 'sync-outbox',
  create: (down: DBCore): DBCore => ({
    ...down,
    transaction: (stores, mode, opts) =>
      down.transaction(mode === 'readwrite' && stores.some((s) => s in SYNCED) ? [...new Set([...stores, 'outbox'])] : stores, mode, opts),
    table(name) {
      const table = down.table(name);
      if (!(name in SYNCED)) return table;
      return {
        ...table,
        async mutate(req: DBCoreMutateRequest) {
          const remote = (req.trans as unknown as { remote?: boolean }).remote;
          if (!remote && (req.type === 'add' || req.type === 'put')) {
            req = { ...req, values: req.values.map((v) => ({ ...v, updatedAt: Date.now() })) };
          }
          let keys: unknown[] = [];
          if (syncState.on && !remote && req.type === 'deleteRange') {
            keys = (await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } })).result;
          }
          const res = await table.mutate(req);
          if (!syncState.on || remote) return res;
          if (req.type === 'delete') keys = req.keys;
          else if (req.type === 'add' || req.type === 'put') keys = res.results ?? req.keys ?? [];
          if (name === 'meta') keys = keys.filter((k) => SYNCED_META.has(k as string));
          if (keys.length) {
            const at = Date.now();
            await down.table('outbox').mutate({ type: 'put', trans: req.trans, values: keys.map((k) => ({ key: `${name}/${k}`, at })) });
          }
          return res;
        },
      };
    },
  }),
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
