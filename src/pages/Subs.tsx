import { useState } from 'react';
import { db, type TxType } from '../db';
import { useCategories, useCategoryMap, useSubs } from '../lib/data';
import { formatDay, formatTL, parseAmount, today } from '../lib/format';
import { CategoryIcon } from '../lib/icons';
import { FREQ_LABEL, monthlyCost, startDate, type Freq, type RecurringRule } from '../lib/recurring';

/** Ayarlar > Tekrarlayan kayitlar: abonelik, kira, maas... aylik toplam, siradaki tarih, duzenleme */
export default function Subs({ toast }: { toast: (m: string) => void }) {
  const subs = useSubs();
  const cats = useCategoryMap();
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const monthly = subs.filter((s) => s.type === 'expense').reduce((sum, s) => sum + monthlyCost(s), 0);

  return (
    <section className="block">
      <h2 className="block-title">Tekrarlayan kayıtlar</h2>
      {subs.length === 0 ? (
        <p className="lead">
          Abonelik, kira, maaş, burs gibi düzenli kayıtları eklerken "Tekrarlayan ödeme" ya da "Tekrarlayan gelir"i aç;
          günü gelince kendiliğinden eklenir.
        </p>
      ) : (
        <>
          <p className="muted small">
            Düzenli ödemelerin ayda {formatTL(monthly)}, yılda {formatTL(monthly * 12)}. Düzenlemek için dokun.
          </p>
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
                      <span>{s.note || s.kind || c?.name}</span>
                      <span className="muted small">
                        {s.kind && s.kind !== s.note ? `${s.kind}, ` : ''}
                        {FREQ_LABEL[s.freq].toLocaleLowerCase('tr')}, sonraki: {formatDay(s.next)}
                      </span>
                    </span>
                    <span className={`row-amount ${s.type === 'income' ? 'pos' : ''}`}>{formatTL(s.amount)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {editing && <SubEditor sub={editing} onClose={() => setEditing(null)} toast={toast} />}
    </section>
  );
}

function SubEditor({ sub, onClose, toast }: { sub: RecurringRule; onClose: () => void; toast: (m: string) => void }) {
  const categories = useCategories();
  const [type, setType] = useState<TxType>(sub.type ?? 'expense');
  const [name, setName] = useState(sub.note ?? '');
  const [amount, setAmount] = useState(String(sub.amount).replace('.', ','));
  const [categoryId, setCategoryId] = useState(sub.categoryId ?? '');
  const [freq, setFreq] = useState<Freq>(sub.freq ?? 'monthly');
  const [next, setNext] = useState(sub.next ?? today());
  const [error, setError] = useState('');
  const visible = categories.filter((c) => c.type === type);
  const cat = visible.some((c) => c.id === categoryId) ? categoryId : (visible.find((c) => c.name.startsWith('Diğer'))?.id ?? visible[0]?.id ?? '');

  async function save() {
    const value = parseAmount(amount);
    if (!value || value <= 0) return setError('Geçerli bir tutar gir.');
    if (!cat) return setError('Bir kategori seç.');
    const rule = { type, note: name.trim(), amount: value, categoryId: cat, freq, next: startDate(next, freq) };
    await db.subs.update(sub.id!, rule);
    toast('Güncellendi');
    onClose();
  }

  async function remove() {
    if (!confirm('Tekrar durdurulsun mu? Daha önce eklenmiş kayıtlar silinmez.')) return;
    await db.subs.delete(sub.id!);
    toast('Tekrar durduruldu');
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tekrarlayan kayıt">
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Vazgeç</button>
          <b>Tekrarlayan kaydı düzenle</b>
          <button className="link strong" onClick={save}>Kaydet</button>
        </div>

        <div className="segmented">
          <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>Gider</button>
          <button className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>Gelir</button>
        </div>

        <label className="amount-field">
          <span>₺</span>
          <span className="amount-size" data-value={amount || '0,00'}>
            <input
            inputMode="decimal"
            placeholder="0,00"
            size={1}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError('');
            }}
            aria-label="Tutar"
          />
          </span>
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
        <button className="danger" onClick={remove}>Tekrarı durdur</button>
      </div>
    </div>
  );
}
