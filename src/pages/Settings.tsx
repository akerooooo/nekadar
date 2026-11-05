import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import { db, DEFAULT_CATEGORIES, type TxType } from '../db';
import { exportCSV, exportJSON, getLastBackup, importJSON } from '../lib/backup';
import { useCategories } from '../lib/data';
import { CategoryIcon, PALETTE, PICKABLE_ICONS } from '../lib/icons';

export default function Settings({ toast }: { toast: (m: string) => void }) {
  const lastBackup = useLiveQuery(getLastBackup, [], null);
  const txCount = useLiveQuery(() => db.transactions.count(), [], 0);
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(PICKABLE_ICONS[0]);
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
    const color = PALETTE[categories.length % PALETTE.length];
    await db.categories.add({ name, icon: newIcon, color, type: newType });
    setNewName('');
    toast(`${name} eklendi`);
  }

  async function removeCategory(id: number, name: string) {
    const used = await db.transactions.where('categoryId').equals(id).count();
    const msg = used
      ? `${name} kategorisinde ${used} kayıt var. Kayıtlar "Diğer" kategorisine taşınacak. Silinsin mi?`
      : `${name} silinsin mi?`;
    if (!confirm(msg)) return;
    const type = categories.find((x) => x.id === id)?.type;
    const fallback = categories.find((c) => c.name.startsWith('Diğer') && c.id !== id && c.type === type);
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

      <section className="block">
        <h2 className="block-title">Yedekleme</h2>
        <p className="lead">
          Verilerin yalnızca bu telefonda durur. Telefon değiştirmeden önce yedek al ve Dosyalar'a ya da iCloud Drive'a
          kaydet.
        </p>
        <p className="muted small">
          {txCount} kayıt. Son yedek: {lastBackup ? lastBackup.toLocaleDateString('tr-TR') : 'henüz alınmadı'}.
        </p>
        <ul className="list actions">
          <li>
            <button className="row" onClick={() => run(exportJSON, 'Yedek hazırlandı')}>
              <Download size={18} strokeWidth={1.75} />
              <span className="row-text">Yedek al</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          </li>
          <li>
            <label className="row">
              <Upload size={18} strokeWidth={1.75} />
              <span className="row-text">Yedekten geri yükle</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  onImport(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </li>
          <li>
            <button className="row" onClick={() => run(exportCSV, 'Excel tablosu hazırlandı')}>
              <FileSpreadsheet size={18} strokeWidth={1.75} />
              <span className="row-text">Excel tablosu olarak dışa aktar</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          </li>
        </ul>
      </section>

      <section className="block">
        <h2 className="block-title">Kategoriler</h2>
        <div className="segmented">
          <button className={newType === 'expense' ? 'on' : ''} onClick={() => setNewType('expense')}>Gider</button>
          <button className={newType === 'income' ? 'on' : ''} onClick={() => setNewType('income')}>Gelir</button>
        </div>

        <ul className="chips">
          {categories
            .filter((c) => c.type === newType)
            .map((c) => (
              <li key={c.id}>
                <span style={{ color: c.color }}>
                  <CategoryIcon name={c.icon} size={15} />
                </span>
                {c.name}
                <button aria-label={`${c.name} kategorisini sil`} onClick={() => removeCategory(c.id!, c.name)}>
                  <X size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
        </ul>

        <p className="muted small">Yeni kategori için bir simge seç ve adını yaz.</p>
        <div className="icon-pick" role="radiogroup" aria-label="Kategori simgesi">
          {PICKABLE_ICONS.map((i) => (
            <button
              key={i}
              role="radio"
              aria-checked={i === newIcon}
              className={i === newIcon ? 'on' : ''}
              onClick={() => setNewIcon(i)}
              aria-label={i}
            >
              <CategoryIcon name={i} size={18} />
            </button>
          ))}
        </div>
        <div className="inline-form">
          <input
            placeholder="Kategori adı"
            value={newName}
            maxLength={20}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            aria-label="Yeni kategori adı"
          />
          <button className="primary small-btn" onClick={addCategory} disabled={!newName.trim()}>
            Ekle
          </button>
        </div>
      </section>

      <section className="block">
        <h2 className="block-title">Hakkında</h2>
        <p className="lead">
          Nekadar ücretsizdir. Hesap, sunucu ya da reklam yoktur; tüm veriler senin cihazında kalır.
        </p>
        <button className="text-danger" onClick={wipe}>
          <Trash2 size={16} strokeWidth={1.75} />
          Tüm verileri sil
        </button>
      </section>
    </>
  );
}
