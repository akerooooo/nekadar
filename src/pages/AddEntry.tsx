import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { db, type TxType } from '../db';
import { useCategories } from '../lib/data';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatDay, formatTL, monthRange, parseAmount, toISODate, today } from '../lib/format';
import { ScanLine } from 'lucide-react';
import { CategoryIcon } from '../lib/icons';
import { advance, FREQ_LABEL, KINDS, startDate, type Freq } from '../lib/recurring';

const ScanReceipt = lazy(() => import('./ScanReceipt'));

export interface EntryDraft {
  id?: string;
}

interface Props {
  draft: EntryDraft;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}

export default function AddEntry({ draft, onClose, onSaved }: Props) {
  const categories = useCategories();
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [repeat, setRepeat] = useState<Freq | null>(null);
  const [kind, setKind] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  // Son 90 gunde en cok kullanilan kategoriler once
  const usage = useLiveQuery(
    async () => {
      const from = toISODate(new Date(Date.now() - 90 * 24 * 3600 * 1000));
      const m = new Map<string, number>();
      await db.entries.where('date').aboveOrEqual(from).each((t) => m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + 1));
      return m;
    },
    [],
    new Map<string, number>(),
  );
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft.id == null) {
      amountRef.current?.focus();
      return;
    }
    db.entries.get(draft.id).then((t) => {
      if (!t) return;
      setType(t.type);
      setAmount(String(t.amount).replace('.', ','));
      setCategoryId(t.categoryId);
      setDate(t.date);
      setNote(t.note);
    });
  }, [draft.id]);

  const visibleCats = categories
    .filter((c) => c.type === type)
    .sort((a, b) => (usage.get(b.id!) ?? 0) - (usage.get(a.id!) ?? 0));

  function switchType(t: TxType) {
    setType(t);
    setCategoryId(null);
    setKind('');
  }

  async function save() {
    const value = parseAmount(amount);
    if (!value || value <= 0) return setError('Geçerli bir tutar gir.');
    if (categoryId == null || !visibleCats.some((c) => c.id === categoryId)) return setError('Bir kategori seç.');
    if (repeat && !kind) return setError(type === 'expense' ? 'Ne tür bir ödeme olduğunu seç.' : 'Ne tür bir gelir olduğunu seç.');
    // Tekrarlayan kayitta not bossa tur adi kullanilir ("Kira", "Burs")
    const name = note.trim() || (repeat && kind !== 'Diğer' ? kind : '');
    const record = { type, amount: value, categoryId, date, note: name };
    if (draft.id != null) await db.entries.update(draft.id, record);
    else await db.entries.add({ ...record, createdAt: Date.now() });
    if (draft.id == null && repeat) {
      const { type: t, amount: a, categoryId: c, note: n } = record;
      // Bu kayit ilk odeme; kural bir sonrakinden baslar
      await db.subs.add({ type: t, amount: a, categoryId: c, note: n, kind, freq: repeat, next: advance(startDate(date, repeat), repeat) });
    }
    onSaved(await budgetMessage(type, categoryId, date, draft.id != null ? 'Güncellendi' : 'Kaydedildi'), date);
  }

  async function remove() {
    if (draft.id == null || !confirm('Bu kayıt silinsin mi?')) return;
    await db.entries.delete(draft.id);
    onSaved('Kayıt silindi');
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kayıt ekle">
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Vazgeç</button>
          <b>{draft.id != null ? 'Kaydı düzenle' : 'Yeni kayıt'}</b>
          <button className="link strong" onClick={save}>Kaydet</button>
        </div>

        <div className="segmented">
          <button className={type === 'expense' ? 'on' : ''} onClick={() => switchType('expense')}>Gider</button>
          <button className={type === 'income' ? 'on' : ''} onClick={() => switchType('income')}>Gelir</button>
        </div>

        <label className="amount-field">
          <span>₺</span>
          <span className="amount-size" data-value={amount || '0,00'}>
            <input
            ref={amountRef}
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

        {type === 'expense' && draft.id == null && (
          <button className="scan-btn" onClick={() => setScanning(true)}>
            <ScanLine size={16} strokeWidth={1.75} />
            Fişten oku
          </button>
        )}

        <div className="cat-grid">
          {visibleCats.map((c) => (
            <button
              key={c.id}
              className={`cat-chip ${categoryId === c.id ? 'on' : ''}`}
              aria-pressed={categoryId === c.id}
              onClick={() => {
                setCategoryId(c.id!);
                setError('');
              }}
            >
              <span className="cat-chip-icon" style={{ color: c.color }}>
                <CategoryIcon name={c.icon} size={20} />
              </span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="fields">
          <label>
            <span>Tarih</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
          </label>
          <label>
            <span>Not</span>
            <input placeholder="İsteğe bağlı" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} />
          </label>
          {draft.id == null && (
            <label className="toggle-row">
              <span>{type === 'expense' ? 'Tekrarlayan ödeme' : 'Tekrarlayan gelir'}</span>
              <input
                type="checkbox"
                role="switch"
                checked={repeat != null}
                onChange={(e) => setRepeat(e.target.checked ? 'monthly' : null)}
              />
            </label>
          )}
        </div>
        {repeat && (
          <>
            <ul className="chips kinds" role="radiogroup" aria-label="Tür">
              {KINDS[type].map((k) => (
                <li key={k} className={kind === k ? 'on' : ''}>
                  <button
                    className="chip-main"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => {
                      setKind(k);
                      setError('');
                    }}
                  >
                    {k}
                  </button>
                </li>
              ))}
            </ul>
            <div className="segmented">
              {(Object.keys(FREQ_LABEL) as Freq[]).map((f) => (
                <button key={f} className={repeat === f ? 'on' : ''} onClick={() => setRepeat(f)}>
                  {FREQ_LABEL[f]}
                </button>
              ))}
            </div>
            <p className="muted small">
              Sonraki: {formatDay(advance(startDate(date, repeat), repeat))}. Not'a ad yazabilirsin (ör. Netflix). Ayarlar → Tekrarlayan kayıtlar'dan düzenlenir.
            </p>
          </>
        )}

        {error && <p className="error">{error}</p>}

        <button className="primary" onClick={save}>Kaydet</button>
        {draft.id != null && (
          <button className="danger" onClick={remove}>Kaydı sil</button>
        )}
      </div>

      {scanning && (
        <Suspense
          fallback={
            <div className="sheet-backdrop">
              <div className="sheet center">Yükleniyor…</div>
            </div>
          }
        >
          <ScanReceipt
            onClose={() => setScanning(false)}
            onResult={(r) => {
              setScanning(false);
              if (r.amount) setAmount(String(r.amount).replace('.', ','));
              if (r.date && r.date <= today()) setDate(r.date);
              if (r.merchant && !note) setNote(r.merchant);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

async function budgetMessage(type: TxType, categoryId: string, date: string, base: string) {
  if (type !== 'expense') return base;
  const budget = await db.budgets.get(categoryId);
  if (!budget || budget.limit <= 0) return base;
  const [from, to] = monthRange(date.slice(0, 7));
  const monthTxs = await db.entries.where('date').between(from, to, true, true).toArray();
  const spent = monthTxs
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((s, t) => s + t.amount, 0);
  const cat = await db.cats.get(categoryId);
  const pct = Math.round((spent / budget.limit) * 100);
  if (spent >= budget.limit) return `${cat?.name} bütçesi aşıldı (${formatTL(spent)} / ${formatTL(budget.limit)})`;
  if (spent >= budget.limit * 0.8) return `${cat?.name} bütçesi: %${pct} kullanıldı`;
  return base;
}
