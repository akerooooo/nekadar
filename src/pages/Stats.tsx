import { useLiveQuery } from 'dexie-react-hooks';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import MonthPicker from '../components/MonthPicker';
import { db } from '../db';
import { expenseByCategory, totals, useCategoryMap, useMonthTransactions } from '../lib/data';
import { formatTL, formatTLShort, MONTHS, monthRange, shiftMonth } from '../lib/format';
import { CategoryIcon } from '../lib/icons';

export default function Stats({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const txs = useMonthTransactions(month);
  const cats = useCategoryMap();
  const { expense } = totals(txs);
  const prevTxs = useMonthTransactions(shiftMonth(month, -1));
  const prevTotal = totals(prevTxs).expense;
  const prevByCat = expenseByCategory(prevTxs);

  const slices = [...expenseByCategory(txs)]
    .map(([id, value]) => ({ id, value, cat: cats.get(id) }))
    .sort((a, b) => b.value - a.value);

  const year = month.slice(0, 4);
  const yearly = useLiveQuery(
    async () => {
      const all = await db.transactions.where('date').between(`${year}-01-01`, `${year}-12-31`, true, true).toArray();
      const t = totals(all);
      const byCat = [...expenseByCategory(all)].sort((a, b) => b[1] - a[1]);
      // Ortalama yalnizca kaydi olan aylara bolunur; bos aylar ortalamayi dusurmesin
      const months = new Set(all.map((x) => x.date.slice(0, 7))).size || 1;
      return { ...t, average: t.expense / months, top: byCat[0] };
    },
    [year],
  );

  const trend = useLiveQuery(
    async () => {
      const first = shiftMonth(month, -5);
      const [from] = monthRange(first);
      const [, to] = monthRange(month);
      const all = await db.transactions.where('date').between(from, to, true, true).toArray();
      return Array.from({ length: 6 }, (_, i) => {
        const key = shiftMonth(first, i);
        const t = totals(all.filter((x) => x.date.startsWith(key)));
        return { name: MONTHS[Number(key.slice(5)) - 1].slice(0, 3), Gider: t.expense, Gelir: t.income };
      });
    },
    [month],
    [],
  );

  return (
    <>
      <header className="page-head">
        <h1>Grafikler</h1>
        <MonthPicker month={month} setMonth={setMonth} />
      </header>

      <section className="block">
        <h2 className="block-title">Nereye harcadın?</h2>
        {slices.length === 0 ? (
          <p className="muted center pad">Bu ay gider yok.</p>
        ) : (
          <>
            <div className="donut">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="id"
                    innerRadius={84}
                    outerRadius={100}
                    paddingAngle={1.5}
                    cornerRadius={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {slices.map((s) => (
                      <Cell key={s.id} fill={s.cat?.color ?? '#94a3b8'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span className="muted small">Toplam</span>
                <b>{formatTLShort(expense)}</b>
              </div>
            </div>
            {prevTotal > 0 && <p className="change center">{changeText(expense, prevTotal)}</p>}
            <ul className="legend">
              {slices.map((s) => (
                <li key={s.id}>
                  <span className="cat-icon" style={{ color: s.cat?.color }}>
                    <CategoryIcon name={s.cat?.icon} size={16} />
                  </span>
                  <span className="legend-name">
                    {s.cat?.name ?? 'Silinmiş'}
                    {prevByCat.get(s.id) ? (
                      <span className="muted small">{changeText(s.value, prevByCat.get(s.id)!)}</span>
                    ) : null}
                  </span>
                  <span className="muted small">{s.value / expense < 0.01 ? '<%1' : `%${Math.round((s.value / expense) * 100)}`}</span>
                  <b>{formatTL(s.value)}</b>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="block">
        <h2 className="block-title">Son 6 ay</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trend} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis
              tickLine={false}
              axisLine={false}
              fontSize={11}
              width={56}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}B ₺` : `${v} ₺`)}
            />
            <Tooltip formatter={(v) => formatTL(Number(v))} cursor={{ fill: 'var(--hover)' }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Gelir" fill="var(--chart-soft)" radius={[3, 3, 0, 0]} barSize={10} isAnimationActive={false} />
            <Bar dataKey="Gider" fill="var(--ink)" radius={[3, 3, 0, 0]} barSize={10} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {yearly && (
        <section className="block">
          <h2 className="block-title">{year} yılı</h2>
          <dl className="year-grid">
            <div>
              <dt>Gelir</dt>
              <dd>{formatTL(yearly.income)}</dd>
            </div>
            <div>
              <dt>Gider</dt>
              <dd>{formatTL(yearly.expense)}</dd>
            </div>
            <div>
              <dt>Biriken</dt>
              <dd className={yearly.balance < 0 ? 'neg' : ''}>{formatTL(yearly.balance)}</dd>
            </div>
            <div>
              <dt>Aylık ortalama gider</dt>
              <dd>{formatTL(yearly.average)}</dd>
            </div>
            {yearly.top && (
              <div className="wide">
                <dt>En çok harcanan</dt>
                <dd>
                  {cats.get(yearly.top[0])?.name ?? 'Silinmiş'}, {formatTL(yearly.top[1])}
                </dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </>
  );
}

/** "Geçen aydan %12 fazla" gibi kisa karsilastirma */
function changeText(current: number, previous: number) {
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return 'Geçen ayla aynı';
  return `Geçen aydan %${Math.abs(pct)} ${pct > 0 ? 'fazla' : 'az'}`;
}
