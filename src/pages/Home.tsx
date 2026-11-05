import MonthPicker from '../components/MonthPicker';
import { expenseByCategory, totals, useBudgets, useCategoryMap, useMonthTransactions } from '../lib/data';
import { formatDay, formatTL } from '../lib/format';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '../db';
import { getLastBackup } from '../lib/backup';
import type { EntryDraft } from './AddEntry';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (d: EntryDraft) => void;
}

export default function Home({ month, setMonth, onEdit }: Props) {
  const txs = useMonthTransactions(month);
  const cats = useCategoryMap();
  const budgets = useBudgets();
  const { income, expense, balance } = totals(txs);
  const byCat = expenseByCategory(txs);

  const warnings = budgets
    .map((b) => ({ b, spent: byCat.get(b.categoryId) ?? 0, cat: cats.get(b.categoryId) }))
    .filter((x) => x.cat && x.b.limit > 0 && x.spent >= x.b.limit * 0.8)
    .sort((a, z) => z.spent / z.b.limit - a.spent / a.b.limit);

  const needsBackup = useLiveQuery(async () => {
    if ((await db.transactions.count()) < 15) return false;
    const last = await getLastBackup();
    return !last || Date.now() - last.getTime() > 30 * 24 * 3600 * 1000;
  }, [], false);

  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const groups = new Map<string, Transaction[]>();
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  return (
    <>
      <header className="page-head">
        <h1>Nekadar</h1>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="card summary">
        <div className="summary-main">
          <span className="muted">Bu ay harcanan</span>
          <strong className="big">{formatTL(expense)}</strong>
        </div>
        <div className="summary-row">
          <div>
            <span className="muted">Gelir</span>
            <b className="pos">{formatTL(income)}</b>
          </div>
          <div>
            <span className="muted">Kalan</span>
            <b className={balance < 0 ? 'neg' : 'pos'}>{formatTL(balance)}</b>
          </div>
        </div>
      </section>

      {warnings.map(({ b, spent, cat }) => (
        <div key={b.categoryId} className={`alert ${spent >= b.limit ? 'over' : 'near'}`}>
          {cat!.icon} <b>{cat!.name}</b>{' '}
          {spent >= b.limit
            ? `bütçesini ${formatTL(spent - b.limit)} aştın`
            : `bütçesinin %${Math.round((spent / b.limit) * 100)}'ini kullandın`}
        </div>
      ))}

      {needsBackup && (
        <div className="alert near">💾 Uzun süredir yedek almadın. Ayarlar → Yedek al ile verilerini koru.</div>
      )}

      {sorted.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🧾</div>
          <p>Bu ay henüz kayıt yok.</p>
          <p className="muted">Aşağıdaki + düğmesiyle ilk harcamanı ekle.</p>
        </div>
      ) : (
        [...groups].map(([date, list]) => (
          <section key={date} className="day">
            <h2 className="day-title">{formatDay(date)}</h2>
            <ul className="card list">
              {list.map((t) => {
                const c = cats.get(t.categoryId);
                return (
                  <li key={t.id}>
                    <button className="row" onClick={() => onEdit({ id: t.id })}>
                      <span className="cat-dot" style={{ background: `${c?.color ?? '#999999'}22` }}>
                        {c?.icon ?? '❔'}
                      </span>
                      <span className="row-text">
                        <span>{c?.name ?? 'Silinmiş kategori'}</span>
                        {t.note && <span className="muted small">{t.note}</span>}
                      </span>
                      <span className={`row-amount ${t.type === 'income' ? 'pos' : ''}`}>
                        {t.type === 'income' ? '+' : '−'}
                        {formatTL(t.amount)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
