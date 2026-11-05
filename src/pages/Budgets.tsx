import { useState } from 'react';
import MonthPicker from '../components/MonthPicker';
import { db } from '../db';
import {
  expenseByCategory,
  setTotalBudget,
  totals,
  useBudgets,
  useCategories,
  useMonthTransactions,
  useTotalBudget,
} from '../lib/data';
import { formatTL, parseAmount } from '../lib/format';
import { CategoryIcon } from '../lib/icons';
import Subs from './Subs';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  toast: (m: string) => void;
}

export default function Budgets({ month, setMonth, toast }: Props) {
  const [view, setView] = useState<'limits' | 'subs'>('limits');
  const cats = useCategories().filter((c) => c.type === 'expense');
  const budgets = useBudgets();
  const txs = useMonthTransactions(month);
  const spentMap = expenseByCategory(txs);
  const { expense } = totals(txs);
  const totalBudget = useTotalBudget();
  // null: duzenleme yok, 'total': toplam butce, sayi: kategori limiti
  const [editing, setEditing] = useState<string | 'total' | null>(null);
  const [value, setValue] = useState('');

  const limitOf = (id: string) => budgets.find((b) => b.categoryId === id)?.limit ?? 0;

  async function saveLimit(categoryId: string) {
    const n = parseAmount(value);
    if (!value.trim() || !n || n <= 0) await db.budgets.delete(categoryId);
    else await db.budgets.put({ categoryId, limit: n });
    setEditing(null);
  }

  async function saveTotal() {
    const n = parseAmount(value);
    await setTotalBudget(value.trim() && n > 0 ? n : 0);
    setEditing(null);
  }

  return (
    <>
      <header className="page-head">
        <h1>Bütçe</h1>
        {view === 'limits' && <MonthPicker month={month} setMonth={setMonth} />}
      </header>

      <div className="segmented">
        <button className={view === 'limits' ? 'on' : ''} onClick={() => setView('limits')}>Limitler</button>
        <button className={view === 'subs' ? 'on' : ''} onClick={() => setView('subs')}>Abonelikler</button>
      </div>

      {view === 'subs' ? (
        <Subs toast={toast} />
      ) : (
        <>

      <section className="hero">
        {editing === 'total' ? (
          <div className="limit-edit flush">
            <input
              autoFocus
              inputMode="decimal"
              placeholder="Aylık toplam bütçe (₺)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTotal()}
              aria-label="Aylık toplam bütçe"
            />
            <button className="primary small-btn" onClick={saveTotal}>Kaydet</button>
            <button className="link" onClick={() => setEditing(null)}>İptal</button>
          </div>
        ) : totalBudget > 0 ? (
          <>
            <p className="hero-label">Bu ay harcadığın</p>
            <p className="hero-amount">
              {formatTL(expense)}
              <span className="hero-of">Bütçe: {formatTL(totalBudget)}</span>
            </p>
            <Progress ratio={expense / totalBudget} />
            <button
              className="link small-link"
              onClick={() => {
                setEditing('total');
                setValue(String(totalBudget).replace('.', ','));
              }}
            >
              Toplam bütçeyi değiştir
            </button>
          </>
        ) : (
          <>
            <p className="lead">Tüm harcamaların için aylık bir üst sınır koy; %80'ine gelince ve aşınca uyarı alırsın.</p>
            <button
              className="secondary"
              onClick={() => {
                setEditing('total');
                setValue('');
              }}
            >
              Aylık toplam bütçe koy
            </button>
          </>
        )}
      </section>

      <p className="muted small">Kategori limiti koymak için kategoriye dokun.</p>

      <ul className="list">
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
                <span className="cat-icon" style={{ color: c.color }}>
                  <CategoryIcon name={c.icon} />
                </span>
                <span className="row-text">
                  <span>{c.name}</span>
                  <span className="muted small">
                    {limit ? `${formatTL(spent)} / ${formatTL(limit)}` : `${formatTL(spent)}, limit yok`}
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
      )}
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
