import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, ChevronRight, CircleAlert, HardDriveDownload, ReceiptText, Search } from 'lucide-react';
import MonthPicker from '../components/MonthPicker';
import EntryList from '../components/EntryList';
import { db } from '../db';
import { getLastBackup } from '../lib/backup';
import { expenseByCategory, totals, useBudgets, useCategoryMap, useMonthTransactions, useSubs, useTotalBudget } from '../lib/data';
import { formatTL, today } from '../lib/format';
import { daysBetween } from '../lib/recurring';
import type { EntryDraft } from './AddEntry';

interface Props {
  month: string;
  setMonth: (m: string) => void;
  onEdit: (d: EntryDraft) => void;
  onSearch: () => void;
  onGoals: () => void;
}

interface Notice {
  key: string;
  icon: ReactNode;
  text: string;
  over?: boolean;
}

const alert = <CircleAlert size={16} strokeWidth={1.75} />;

export default function Home({ month, setMonth, onEdit, onSearch, onGoals }: Props) {
  const txs = useMonthTransactions(month);
  const cats = useCategoryMap();
  const budgets = useBudgets();
  const { income, expense, balance } = totals(txs);
  const byCat = expenseByCategory(txs);
  const [showAll, setShowAll] = useState(false);
  const goals = useLiveQuery(() => db.goals.toArray(), [], []);
  const saved = goals.reduce((s, g) => s + g.saved, 0);

  const split = [...byCat]
    .map(([id, value]) => ({ id, value, cat: cats.get(id) }))
    .sort((a, b) => b.value - a.value);

  const needsBackup = useLiveQuery(
    async () => {
      if (await db.meta.get('syncEmail')) return null; // giris yapildiysa bulutta zaten var
      const last = await getLastBackup();
      if (!last) return (await db.entries.count()) >= 5 ? 'Henüz yedek almadın. Ayarlar\'dan yedek al.' : null;
      const newSince = await db.entries.filter((t) => t.createdAt > last.getTime()).count();
      const due = newSince >= 20 || (newSince > 0 && Date.now() - last.getTime() > 7 * 24 * 3600 * 1000);
      return due ? `Son yedekten sonra ${newSince} yeni kayıt var. Ayarlar'dan yedek al.` : null;
    },
    [],
    null,
  );

  const subs = useSubs();
  const totalBudget = useTotalBudget();
  const totalRatio = totalBudget > 0 ? expense / totalBudget : 0;

  // Onem sirasina gore: asimlar, yaklasan odemeler, %80 uyarilari, yedek
  const notices: Notice[] = [];
  if (totalRatio >= 1)
    notices.push({ key: 'total', icon: alert, over: true, text: `Aylık toplam bütçeni ${formatTL(expense - totalBudget)} aştın` });
  const catWarnings = budgets
    .map((b) => ({ b, spent: byCat.get(b.categoryId) ?? 0, cat: cats.get(b.categoryId) }))
    .filter((x) => x.cat && x.b.limit > 0 && x.spent >= x.b.limit * 0.8)
    .sort((a, z) => z.spent / z.b.limit - a.spent / a.b.limit);
  for (const { b, spent, cat } of catWarnings.filter((x) => x.spent >= x.b.limit))
    notices.push({ key: b.categoryId, icon: alert, over: true, text: `${cat!.name} bütçesini ${formatTL(spent - b.limit)} aştın` });
  // Onumuzdeki 3 gun icindeki odemeler (bugunkuler acilista zaten eklendi)
  for (const s of subs) {
    const days = daysBetween(today(), s.next);
    if (s.type !== 'expense' || days < 1 || days > 3) continue;
    notices.push({
      key: s.id!,
      icon: <CalendarClock size={16} strokeWidth={1.75} />,
      text: `${days === 1 ? 'Yarın' : `${days} gün sonra`} ${s.note || cats.get(s.categoryId)?.name} ödemen var: ${formatTL(s.amount)}`,
    });
  }
  if (totalRatio >= 0.8 && totalRatio < 1)
    notices.push({ key: 'total', icon: alert, text: `Aylık toplam bütçe: %${Math.round(totalRatio * 100)} kullanıldı` });
  for (const { b, spent, cat } of catWarnings.filter((x) => x.spent < x.b.limit))
    notices.push({ key: b.categoryId, icon: alert, text: `${cat!.name} bütçesi: %${Math.round((spent / b.limit) * 100)} kullanıldı` });
  if (needsBackup) notices.push({ key: 'backup', icon: <HardDriveDownload size={16} strokeWidth={1.75} />, text: needsBackup });
  const visible = showAll ? notices : notices.slice(0, 2);

  return (
    <>
      <header className="page-head">
        <h1 className="brand">nekadar</h1>
        <div className="head-actions">
          <button className="icon-btn" aria-label="Kayıtlarda ara" onClick={onSearch}>
            <Search size={19} strokeWidth={1.75} />
          </button>
          <MonthPicker month={month} setMonth={setMonth} />
        </div>
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
          <div>
            <dt>Biriken</dt>
            <dd>
              <button className={`meta-btn ${goals.length ? '' : 'muted'}`} onClick={onGoals}>
                {goals.length ? formatTL(saved) : 'Hedef koy'}
                <ChevronRight size={14} strokeWidth={2} />
              </button>
            </dd>
          </div>
        </dl>
      </section>

      {notices.length > 0 && (
        <ul className="notices">
          {visible.map((n) => (
            <li key={n.key} className={n.over ? 'over' : ''}>
              {n.icon}
              <span>{n.text}</span>
            </li>
          ))}
          {notices.length > 2 && (
            <li className="more">
              <button className="link small-link" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Daha az göster' : `${notices.length - 2} uyarı daha`}
              </button>
            </li>
          )}
        </ul>
      )}

      {txs.length === 0 ? (
        <div className="empty">
          <ReceiptText size={32} strokeWidth={1.25} />
          <p>Bu ay henüz kayıt yok</p>
          <p className="muted">İlk harcamanı eklemek için + düğmesine dokun.</p>
        </div>
      ) : (
        <EntryList key={month} limit={10} txs={txs} cats={cats} onEdit={(id) => onEdit({ id })} />
      )}
    </>
  );
}
