import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_CATEGORIES, type TxType } from '../db';
import { exportCSV, exportJSON, getLastBackup, importJSON } from '../lib/backup';
import { useCategories } from '../lib/data';

const ICONS = ['☕', '🎮', '📚', '🐶', '🎁', '✈️', '💇', '🏋️', '🚗', '📱', '👶', '🍺', '⛽', '🧾', '💳', '🏦'];
const COLORS = ['#0f766e', '#ea580c', '#2563eb', '#7c3aed', '#db2777', '#ca8a04', '#0891b2', '#16a34a', '#dc2626', '#64748b'];

export default function Settings({ toast }: { toast: (m: string) => void }) {
  const lastBackup = useLiveQuery(getLastBackup, [], null);
  const txCount = useLiveQuery(() => db.transactions.count(), [], 0);
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(ICONS[0]);
  const [newType, setNewType] = useState<TxType>('expense');

  async function run(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      toast(ok);
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') toast((e as Error).message || 'Bir hata oluştu');
    }
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    if (!confirm('Yedek geri yüklenince bu telefondaki mevcut kayıtların yerini alır. Devam edilsin mi?')) return;
    try {
      const n = await importJSON(file);
      toast(`${n} kayıt geri yüklendi`);
    } catch (e) {
      toast((e as Error).message || 'Geri yükleme başarısız');
    }
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    const color = COLORS[categories.length % COLORS.length];
    await db.categories.add({ name, icon: newIcon, color, type: newType });
    setNewName('');
    toast(`"${name}" eklendi`);
  }

  async function removeCategory(id: number, name: string) {
    const used = await db.transactions.where('categoryId').equals(id).count();
    const msg = used
      ? `"${name}" kategorisinde ${used} kayıt var. Kayıtlar "Diğer"e taşınacak. Silinsin mi?`
      : `"${name}" silinsin mi?`;
    if (!confirm(msg)) return;
    const fallback = categories.find((c) => c.name.startsWith('Diğer') && c.id !== id && c.type === categories.find((x) => x.id === id)?.type);
    await db.transaction('rw', [db.categories, db.transactions, db.budgets], async () => {
      if (used && fallback) await db.transactions.where('categoryId').equals(id).modify({ categoryId: fallback.id });
      await db.budgets.delete(id);
      await db.categories.delete(id);
    });
  }

  async function wipe() {
    if (!confirm('Tüm kayıtlar, bütçeler ve kategoriler silinecek. Bu geri alınamaz. Emin misin?')) return;
    await db.transaction('rw', [db.categories, db.transactions, db.budgets, db.meta], async () => {
      await Promise.all([db.transactions.clear(), db.budgets.clear(), db.categories.clear(), db.meta.clear()]);
      await db.categories.bulkAdd(DEFAULT_CATEGORIES);
    });
    toast('Tüm veriler silindi');
  }

  return (
    <>
      <header className="page-head">
        <h1>Ayarlar</h1>
      </header>

      <h2 className="section-title">Yedekleme</h2>
      <section className="card stack">
        <p className="muted small">
          Verilerin yalnızca bu telefonda durur. Telefon değiştirirsen ya da uygulamayı silersen kaybolmaması için
          ara sıra yedek al ve Dosyalar'a / iCloud Drive'a kaydet.
        </p>
        <p className="small">
          Son yedek: <b>{lastBackup ? lastBackup.toLocaleDateString('tr-TR') : 'hiç alınmadı'}</b> · {txCount} kayıt
        </p>
        <button className="primary" onClick={() => run(exportJSON, 'Yedek hazırlandı')}>💾 Yedek al (.json)</button>
        <label className="secondary file-btn">
          📂 Yedekten geri yükle
          <input type="file" accept="application/json,.json" hidden onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button className="secondary" onClick={() => run(exportCSV, 'Tablo hazırlandı')}>📄 Excel tablosu (.csv)</button>
      </section>

      <h2 className="section-title">Kategoriler</h2>
      <section className="card stack">
        <div className="segmented">
          <button className={newType === 'expense' ? 'on' : ''} onClick={() => setNewType('expense')}>Gider</button>
          <button className={newType === 'income' ? 'on' : ''} onClick={() => setNewType('income')}>Gelir</button>
        </div>
        <div className="icon-pick">
          {ICONS.map((i) => (
            <button key={i} className={i === newIcon ? 'on' : ''} onClick={() => setNewIcon(i)} aria-label={`Simge ${i}`}>{i}</button>
          ))}
        </div>
        <div className="limit-edit">
          <input placeholder="Yeni kategori adı" value={newName} maxLength={20} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCategory()} />
          <button className="primary small-btn" onClick={addCategory}>Ekle</button>
        </div>
        <ul className="chips">
          {categories.filter((c) => c.type === newType).map((c) => (
            <li key={c.id}>
              {c.icon} {c.name}
              <button aria-label={`${c.name} sil`} onClick={() => removeCategory(c.id!, c.name)}>×</button>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="section-title">Hakkında</h2>
      <section className="card stack">
        <p className="small">
          <b>Nekadar</b> ücretsizdir. Hesap, sunucu ya da reklam yoktur; tüm veriler senin cihazında kalır.
        </p>
        <button className="danger" onClick={wipe}>Tüm verileri sil</button>
      </section>
    </>
  );
}
