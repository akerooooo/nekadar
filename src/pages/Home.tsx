import { useLiveQuery } from 'dexie-react-hooks';
import { CircleAlert, HardDriveDownload, ReceiptText } from 'lucide-react';
import MonthPicker from '../components/MonthPicker';
import { db, type Transaction } from '../db';
import { getLastBackup } from '../lib/backup';
import { expenseByCategory, totals, useBudgets, useCategoryMap, useMonthTransactions, useTotalBudget } from '../lib/data';
import { formatDay, formatTL } from '../lib/format';
import { CategoryIcon } from '../lib/icons';
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

  const split = [...byCat]
    .map(([id, value]) => ({ id, value, cat: cats.get(id) }))
    .sort((a, b) => b.value - a.value);

  const warnings = budgets
    .map((b) => ({ b, spent: byCat.get(b.categoryId) ?? 0, cat: cats.get(b.categoryId) }))
    .filter((x) => x.cat && x.b.limit > 0 && x.spent >= x.b.limit * 0.8)
    .sort((a, z) => z.spent / z.b.limit - a.spent / a.b.limit);

  const needsBackup = useLiveQuery(
    async () => {
      const last = await getLastBackup();
      if (!last) return (await db.transactions.count()) >= 5 ? 'Henüz yedek almadın. Ayarlar\'dan yedek al.' : null;
      const newSince = await db.transactions.filter((t) => t.createdAt > last.getTime()).count();
      const due = newSince >= 20 || (newSince > 0 && Date.now() - last.getTime() > 7 * 24 * 3600 * 1000);
      return due ? `Son yedekten sonra ${newSince} yeni kayıt var. Ayarlar'dan yedek al.` : null;
    },
    [],
    null,
  );

  const totalBudget = useTotalBudget();
  const totalRatio = totalBudget > 0 ? expense / totalBudget : 0;

  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const groups = new Map<string, Transaction[]>();
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  return (
    <>
      <header className="page-head">
        <h1 className="brand">nekadar</h1>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="hero" aria-label="Aylık özet">
        <p className="hero-label">Bu ay harcadığın</p>
        <p className="hero-amount">{formatTL(expense)}</p>

        <div className="split-bar" aria-hidden>
          {split.length === 0 ? (
            <span className="split-empty" />
          ) : (
            split.map((s) => (
              <span key={s.id} style={{ flexGrow: s.value, background: s.cat?.color ?? 'var(--line)' }} />
            ))
          )}
        </div>

        <dl className="hero-meta">
          <div>
            <dt>Gelir</dt>
            <dd>{formatTL(income)}</dd>
          </div>
          <div>
            <dt>Kalan</dt>
            <dd className={balance < 0 ? 'neg' : ''}>{formatTL(balance)}</dd>
          </div>
        </dl>
      </section>

      {(warnings.length > 0 || needsBackup || totalRatio >= 0.8) && (
        <ul className="notices">
          {totalRatio >= 0.8 && (
            <li className={totalRatio >= 1 ? 'over' : ''}>
              <CircleAlert size={16} strokeWidth={1.75} />
              <span>
                {totalRatio >= 1
                  ? `Aylık toplam bütçeni ${formatTL(expense - totalBudget)} aştın`
                  : `Aylık toplam bütçe: %${Math.round(totalRatio * 100)} kullanıldı`}
              </span>
            </li>
          )}
          {warnings.map(({ b, spent, cat }) => (
            <li key={b.categoryId} className={spent >= b.limit ? 'over' : ''}>
              <CircleAlert size={16} strokeWidth={1.75} />
              <span>
                {cat!.name}{' '}
                {spent >= b.limit
                  ? `bütçesini ${formatTL(spent - b.limit)} aştın`
                  : `bütçesi: %${Math.round((spent / b.limit) * 100)} kullanıldı`}
              </span>
            </li>
          ))}
          {needsBackup && (
            <li>
              <HardDriveDownload size={16} strokeWidth={1.75} />
              <span>{needsBackup}</span>
            </li>
          )}
        </ul>
      )}

      {sorted.length === 0 ? (
        <div className="empty">
          <ReceiptText size={32} strokeWidth={1.25} />
          <p>Bu ay henüz kayıt yok</p>
          <p className="muted">İlk harcamanı eklemek için + düğmesine dokun.</p>
        </div>
      ) : (
        [...groups].map(([date, list]) => (
          <section key={date} className="day">
            <h2 className="day-title">{formatDay(date)}</h2>
            <ul className="list">
              {list.map((t) => {
                const c = cats.get(t.categoryId);
                return (
                  <li key={t.id}>
                    <button className="row" onClick={() => onEdit({ id: t.id })}>
                      <span className="cat-icon" style={{ color: c?.color }}>
                        <CategoryIcon name={c?.icon} />
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
