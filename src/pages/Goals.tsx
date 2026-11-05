import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { PiggyBank, Plus } from 'lucide-react';
import Progress from '../components/Progress';
import { db, type Goal } from '../db';
import { formatTL, parseAmount } from '../lib/format';

/** Ozet > Biriken'e dokununca acilan hedefler sayfasi */
export function GoalsSheet({ onClose, toast }: { onClose: () => void; toast: (m: string) => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Birikim hedefleri">
        <div className="sheet-head">
          <span />
          <b>Hedefler</b>
          <button className="link strong" onClick={onClose}>Kapat</button>
        </div>
        <Goals toast={toast} />
      </div>
    </div>
  );
}

/** Hedef listesi. Biriken tutar elle eklenir; harcama toplamlarina girmez. */
export default function Goals({ toast }: { toast: (m: string) => void }) {
  const goals = useLiveQuery(async () => (await db.goals.toArray()).sort((a, b) => a.name.localeCompare(b.name, 'tr')), [], [] as Goal[]);
  const [open, setOpen] = useState<Goal | 'new' | null>(null);

  return (
    <section>
      {goals.length > 0 && (
        <p className="muted small">
          Toplam biriken {formatTL(goals.reduce((s, g) => s + g.saved, 0))} / {formatTL(goals.reduce((s, g) => s + g.target, 0))}
        </p>
      )}
      {goals.length === 0 && <p className="lead">Tatil, telefon, acil durum fonu… Bir hedef koy, biriktirdikçe ekle.</p>}
      <ul className="list">
        {goals.map((g) => (
          <li key={g.id} className="budget-item">
            <button className="row" onClick={() => setOpen(g)}>
              <span className="cat-icon">
                <PiggyBank size={20} strokeWidth={1.75} />
              </span>
              <span className="row-text">
                <span>{g.name}</span>
                <span className="muted small">
                  {formatTL(g.saved)} / {formatTL(g.target)}
                </span>
              </span>
              <span className={`small ${g.saved >= g.target ? 'pos' : 'muted'}`}>
                {g.saved >= g.target ? 'Tamamlandı' : `${formatTL(g.target - g.saved)} kaldı`}
              </span>
            </button>
            <div className="pad-x">
              <Progress ratio={g.target > 0 ? g.saved / g.target : 0} goal />
            </div>
          </li>
        ))}
      </ul>
      <button className="secondary" onClick={() => setOpen('new')}>
        <Plus size={16} strokeWidth={1.75} />
        Hedef ekle
      </button>
      {/* Disaridaki sayfanin animasyonu konumu bozmasin diye body'ye cizilir */}
      {open && createPortal(<GoalSheet goal={open === 'new' ? null : open} onClose={() => setOpen(null)} toast={toast} />, document.body)}
    </section>
  );
}

function GoalSheet({ goal, onClose, toast }: { goal: Goal | null; onClose: () => void; toast: (m: string) => void }) {
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target).replace('.', ',') : '');
  const [change, setChange] = useState('');
  const [error, setError] = useState('');

  async function save(delta = 0) {
    const t = parseAmount(target);
    if (!name.trim()) return setError('Hedefe bir ad ver.');
    if (!t || t <= 0) return setError('Geçerli bir hedef tutarı gir.');
    const saved = Math.max(0, Math.round(((goal?.saved ?? 0) + delta) * 100) / 100);
    if (goal) await db.goals.update(goal.id!, { name: name.trim(), target: t, saved });
    else await db.goals.add({ name: name.trim(), target: t, saved });
    const reached = saved >= t && (goal?.saved ?? 0) < t;
    toast(reached ? `Tebrikler, ${name.trim()} hedefine ulaştın` : delta ? `${formatTL(Math.abs(delta))} ${delta > 0 ? 'eklendi' : 'çıkarıldı'}` : 'Kaydedildi');
    onClose();
  }

  function move(sign: 1 | -1) {
    const n = parseAmount(change);
    if (!n || n <= 0) return setError('Eklenecek ya da çıkarılacak tutarı gir.');
    save(sign * n);
  }

  async function remove() {
    if (!goal || !confirm(`${goal.name} hedefi silinsin mi?`)) return;
    await db.goals.delete(goal.id!);
    toast('Hedef silindi');
    onClose();
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet goal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Birikim hedefi">
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Vazgeç</button>
          <b>{goal ? goal.name : 'Yeni hedef'}</b>
          <button className="link strong" onClick={() => save()}>Kaydet</button>
        </div>

        {goal && (
          <>
            <p className="center">
              <b>{formatTL(goal.saved)}</b> <span className="muted">/ {formatTL(goal.target)}</span>
            </p>
            <Progress ratio={goal.saved / goal.target} goal />
            <div className="fields">
              <label>
                <span>Tutar</span>
                <input
                  inputMode="decimal"
                  placeholder="0,00 ₺"
                  value={change}
                  onChange={(e) => {
                    setChange(e.target.value);
                    setError('');
                  }}
                  aria-label="Eklenecek ya da çıkarılacak tutar"
                />
              </label>
            </div>
            <div className="goal-actions">
              <button className="secondary" onClick={() => move(-1)}>Çıkar</button>
              <button className="primary" onClick={() => move(1)}>Ekle</button>
            </div>
          </>
        )}

        <div className="fields">
          <label>
            <span>Ad</span>
            <input placeholder="Örn. Tatil" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
          </label>
          <label>
            <span>Hedef</span>
            <input inputMode="decimal" placeholder="0,00 ₺" value={target} onChange={(e) => setTarget(e.target.value)} />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {goal && <button className="danger" onClick={remove}>Hedefi sil</button>}
      </div>
    </div>
  );
}
