import type { Category, Transaction } from '../db';
import { formatDay, formatTL } from '../lib/format';
import { CategoryIcon } from '../lib/icons';

/** Gun basliklarina gore gruplu kayit listesi (Ozet ve Arama) */
export default function EntryList(p: { txs: Transaction[]; cats: Map<string, Category>; onEdit: (id: string) => void }) {
  const sorted = [...p.txs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const groups = new Map<string, Transaction[]>();
  for (const t of sorted) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  return [...groups].map(([date, list]) => (
    <section key={date} className="day">
      <h2 className="day-title">{formatDay(date)}</h2>
      <ul className="list">
        {list.map((t) => {
          const c = p.cats.get(t.categoryId);
          return (
            <li key={t.id}>
              <button className="row" onClick={() => p.onEdit(t.id!)}>
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
  ));
}
