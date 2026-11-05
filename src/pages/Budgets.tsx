import { useState } from 'react';
import MonthPicker from '../components/MonthPicker';
import { db } from '../db';
import { expenseByCategory, useBudgets, useCategories, useMonthTransactions } from '../lib/data';
import { formatTL, parseAmount } from '../lib/format';

export default function Budgets({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const cats = useCategories().filter((c) => c.type === 'expense');
  const budgets = useBudgets();
  const spentMap = expenseByCategory(useMonthTransactions(month));
  const [editing, setEditing] = useState<number | null>(null);
  const [value, setValue] = useState('');

  const limitOf = (id: number) => budgets.find((b) => b.categoryId === id)?.limit ?? 0;
  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpentInBudgeted = budgets.reduce((s, b) => s + (spentMap.get(b.categoryId) ?? 0), 0);

  async function saveLimit(categoryId: number) {
    const n = parseAmount(value);
    if (!value.trim() || !n || n <= 0) await db.budgets.delete(categoryId);
    else await db.budgets.put({ categoryId, limit: n });
    setEditing(null);
  }

  return (
    <>
      <header className="page-head">
        <h1>Bütçe</h1>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      {totalLimit > 0 && (
        <section className="card">
          <div className="budget-top">
            <span className="muted">Toplam bütçe</span>
            <b>
              {formatTL(totalSpentInBudgeted)} / {formatTL(totalLimit)}
            </b>
          </div>
          <Progress ratio={totalSpentInBudgeted / totalLimit} />
        </section>
      )}

      <p className="muted small pad-x">Kategoriye dokunup aylık limit koy. %80'e gelince ve aşınca uyarı alırsın.</p>

      <ul className="card list">
        {cats.map((c) => {
          const limit = limitOf(c.id!);
          const spent = spentMap.get(c.id!) ?? 0;
          const isEditing = editing === c.id;
          return (
            <li key={c.id} className="budget-item">
              <button
                className="row"
                onClick={() => {
                  setEditing(c.id!);
                  setValue(limit ? String(limit).replace('.', ',') : '');
                }}
              >
                <span className="cat-dot" style={{ background: `${c.color}22` }}>{c.icon}</span>
                <span className="row-text">
                  <span>{c.name}</span>
                  <span className="muted small">
                    {limit ? `${formatTL(spent)} / ${formatTL(limit)}` : `${formatTL(spent)} · limit yok`}
                  </span>
                </span>
                {limit > 0 && (
                  <span className={`small ${spent >= limit ? 'neg' : 'muted'}`}>
                    {spent >= limit ? 'Aşıldı' : `${formatTL(limit - spent)} kaldı`}
                  </span>
                )}
              </button>
              {limit > 0 && !isEditing && (
                <div className="pad-x">
                  <Progress ratio={spent / limit} />
                </div>
              )}
              {isEditing && (
                <div className="limit-edit">
                  <input
                    autoFocus
                    inputMode="decimal"
                    placeholder="Aylık limit (₺)"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveLimit(c.id!)}
                    aria-label={`${c.name} aylık limit`}
                  />
                  <button className="primary small-btn" onClick={() => saveLimit(c.id!)}>Kaydet</button>
                  <button className="link" onClick={() => setEditing(null)}>İptal</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Progress({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.round(ratio * 100));
  const level = ratio >= 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok';
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`progress-bar ${level}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
