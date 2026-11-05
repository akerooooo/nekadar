import { useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { db, type TxType } from '../db';
import { useCategories, useCategoryMap, useSubs } from '../lib/data';
import { formatDay, formatTL, parseAmount, today } from '../lib/format';
import { CategoryIcon } from '../lib/icons';
import { FREQ_LABEL, monthlyCost, startDate, type Freq, type RecurringRule } from '../lib/recurring';

/** Butce > Abonelikler: tekrarlayan odemeler, aylik toplam, siradaki odeme */
export default function Subs({ toast }: { toast: (m: string) => void }) {
  const subs = useSubs();
  const cats = useCategoryMap();
  const [editing, setEditing] = useState<RecurringRule | 'new' | null>(null);
  const expenses = subs.filter((s) => s.type === 'expense');
  const monthly = expenses.reduce((sum, s) => sum + monthlyCost(s), 0);

  return (
    <>
      <section className="hero">
        <p className="hero-label">Aboneliklerin aylık tutarı</p>
        <p className="hero-amount">
          {formatTL(monthly)}
          <span className="hero-of">Yıllık: {formatTL(monthly * 12)}</span>
        </p>
      </section>

      {subs.length === 0 ? (
        <div className="empty">
          <Repeat size={32} strokeWidth={1.25} />
          <p>Henüz abonelik yok</p>
          <p className="muted">Netflix, kira, fatura gibi düzenli ödemeleri ekle; günü gelince kendiliğinden kaydedilir.</p>
        </div>
      ) : (
        <ul className="list">
          {subs.map((s) => {
            const c = cats.get(s.categoryId);
            return (
              <li key={s.id}>
                <button className="row" onClick={() => setEditing(s)}>
                  <span className="cat-icon" style={{ color: c?.color }}>
                    <CategoryIcon name={c?.icon} />
                  </span>
                  <span className="row-text">
                    <span>{s.note || c?.name || 'Abonelik'}</span>
                    <span className="muted small">
                      {FREQ_LABEL[s.freq]}, sonraki: {formatDay(s.next)}
                    </span>
                  </span>
                  <span className={`row-amount ${s.type === 'income' ? 'pos' : ''}`}>{formatTL(s.amount)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button className="secondary with-icon" onClick={() => setEditing('new')}>
        <Plus size={16} strokeWidth={1.75} />
        Abonelik ekle
      </button>

      {editing && <SubEditor sub={editing === 'new' ? null : editing} onClose={() => setEditing(null)} toast={toast} />}
    </>
  );
}

function SubEditor({ sub, onClose, toast }: { sub: RecurringRule | null; onClose: () => void; toast: (m: string) => void }) {
  const categories = useCategories();
  const [type, setType] = useState<TxType>(sub?.type ?? 'expense');
  const [name, setName] = useState(sub?.note ?? '');
  const [amount, setAmount] = useState(sub ? String(sub.amount).replace('.', ',') : '');
  const [categoryId, setCategoryId] = useState(sub?.categoryId ?? '');
  const [freq, setFreq] = useState<Freq>(sub?.freq ?? 'monthly');
  const [next, setNext] = useState(sub?.next ?? today());
  const [error, setError] = useState('');
  const visible = categories.filter((c) => c.type === type);
  const cat = visible.some((c) => c.id === categoryId) ? categoryId : (visible.find((c) => c.name.startsWith('Diğer'))?.id ?? visible[0]?.id ?? '');

  async function save() {
    const value = parseAmount(amount);
    if (!value || value <= 0) return setError('Geçerli bir tutar gir.');
    if (!cat) return setError('Bir kategori seç.');
    const rule = { type, note: name.trim(), amount: value, categoryId: cat, freq, next: startDate(next, freq) };
    if (sub) await db.subs.update(sub.id!, rule);
    else await db.subs.add(rule);
    toast(sub ? 'Abonelik güncellendi' : 'Abonelik eklendi');
    onClose();
  }

  async function remove() {
    if (!sub || !confirm('Abonelik silinsin mi? Daha önce eklenmiş kayıtlar silinmez.')) return;
    await db.subs.delete(sub.id!);
    toast('Abonelik silindi');
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Abonelik">
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Vazgeç</button>
          <b>{sub ? 'Aboneliği düzenle' : 'Yeni abonelik'}</b>
          <button className="link strong" onClick={save}>Kaydet</button>
        </div>

        <div className="segmented">
          <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>Gider</button>
          <button className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>Gelir</button>
        </div>

        <label className="amount-field">
          <span>₺</span>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            aria-label="Tutar"
          />
        </label>

        <div className="segmented">
          {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
            <button key={f} className={freq === f ? 'on' : ''} onClick={() => setFreq(f)}>
              {FREQ_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="fields">
          <label>
            <span>Ad</span>
            <input placeholder="Örn. Netflix" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </label>
          <label>
            <span>Kategori</span>
            <select value={cat} onChange={(e) => setCategoryId(e.target.value)}>
              {visible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Sonraki ödeme</span>
            <input type="date" value={next} onChange={(e) => setNext(e.target.value || today())} />
          </label>
        </div>
        {freq !== 'weekly' && Number(next.slice(8)) > 28 && (
          <p className="muted small">Her ay olmayan günler yüzünden ödeme günü 28 olarak kaydedilir.</p>
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" onClick={save}>Kaydet</button>
        {sub && (
          <button className="danger" onClick={remove}>Aboneliği sil</button>
        )}
      </div>
    </div>
  );
}
