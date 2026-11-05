import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { db, type TxType } from '../db';
import { useCategories } from '../lib/data';
import { formatTL, monthRange, parseAmount, today } from '../lib/format';
import { ScanLine } from 'lucide-react';
import { CategoryIcon } from '../lib/icons';

const ScanReceipt = lazy(() => import('./ScanReceipt'));

export interface EntryDraft {
  id?: number;
}

interface Props {
  draft: EntryDraft;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export default function AddEntry({ draft, onClose, onSaved }: Props) {
  const categories = useCategories();
  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft.id == null) {
      amountRef.current?.focus();
      return;
    }
    db.transactions.get(draft.id).then((t) => {
      if (!t) return;
      setType(t.type);
      setAmount(String(t.amount).replace('.', ','));
      setCategoryId(t.categoryId);
      setDate(t.date);
      setNote(t.note);
    });
  }, [draft.id]);

  const visibleCats = categories.filter((c) => c.type === type);

  function switchType(t: TxType) {
    setType(t);
    setCategoryId(null);
  }

  async function save() {
    const value = parseAmount(amount);
    if (!value || value <= 0) return setError('Geçerli bir tutar gir.');
    if (categoryId == null || !visibleCats.some((c) => c.id === categoryId)) return setError('Bir kategori seç.');
    const record = { type, amount: value, categoryId, date, note: note.trim() };
    if (draft.id != null) await db.transactions.update(draft.id, record);
    else await db.transactions.add({ ...record, createdAt: Date.now() });
    onSaved(await budgetMessage(type, categoryId, date, draft.id != null ? 'Güncellendi' : 'Kaydedildi'));
  }

  async function remove() {
    if (draft.id == null || !confirm('Bu kayıt silinsin mi?')) return;
    await db.transactions.delete(draft.id);
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
          <input
            ref={amountRef}
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
        </div>

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

async function budgetMessage(type: TxType, categoryId: number, date: string, base: string) {
  if (type !== 'expense') return base;
  const budget = await db.budgets.get(categoryId);
  if (!budget || budget.limit <= 0) return base;
  const [from, to] = monthRange(date.slice(0, 7));
  const monthTxs = await db.transactions.where('date').between(from, to, true, true).toArray();
  const spent = monthTxs
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((s, t) => s + t.amount, 0);
  const cat = await db.categories.get(categoryId);
  const pct = Math.round((spent / budget.limit) * 100);
  if (spent >= budget.limit) return `${cat?.name} bütçesi aşıldı (${formatTL(spent)} / ${formatTL(budget.limit)})`;
  if (spent >= budget.limit * 0.8) return `${cat?.name} bütçesinin %${pct}'i kullanıldı`;
  return base;
}
