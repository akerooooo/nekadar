import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react';
import { db, defaultCategories, type Category, type TxType } from '../db';
import { exportCSV, exportJSON, getLastBackup, importJSON } from '../lib/backup';
import { useCategories } from '../lib/data';
import { cloudEnabled } from '../lib/cloud';
import Account from '../components/Account';
import Subs from './Subs';
import { CategoryIcon, PALETTE, PICKABLE_ICONS } from '../lib/icons';

export default function Settings({ toast }: { toast: (m: string) => void }) {
  const lastBackup = useLiveQuery(getLastBackup, [], null);
  const txCount = useLiveQuery(() => db.entries.count(), [], 0);
  const categories = useCategories();
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState(PICKABLE_ICONS[0]);
  const [newType, setNewType] = useState<TxType>('expense');
  const [newColor, setNewColor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const persisted = useLiveQuery(async () => (await navigator.storage?.persisted?.()) ?? false, [], false);
  const catMap = new Map(categories.map((c) => [c.id, c]));
  // Duzenlenen varsayilan kategorinin ikonu secim listesinde yoksa basa eklenir
  const editIcon = editingId != null ? catMap.get(editingId)?.icon : undefined;
  const iconChoices = editIcon && !PICKABLE_ICONS.includes(editIcon) ? [editIcon, ...PICKABLE_ICONS] : PICKABLE_ICONS;

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

  function resetForm() {
    setEditingId(null);
    setNewName('');
    setNewColor(null);
  }

  function startEdit(c: Category) {
    setEditingId(c.id!);
    setNewType(c.type);
    setNewName(c.name);
    setNewIcon(c.icon);
    setNewColor(c.color);
  }

  async function saveCategory() {
    const name = newName.trim();
    if (!name) return;
    const color = newColor ?? PALETTE[categories.length % PALETTE.length];
    if (editingId != null) await db.cats.update(editingId, { name, icon: newIcon, color });
    else await db.cats.add({ name, icon: newIcon, color, type: newType });
    toast(editingId != null ? `${name} güncellendi` : `${name} eklendi`);
    resetForm();
  }

  async function removeCategory(id: string, name: string) {
    const type = categories.find((x) => x.id === id)?.type;
    const others = categories.filter((c) => c.id !== id && c.type === type);
    const fallback = others.find((c) => c.name.startsWith('Diğer')) ?? others[0];
    if (!fallback) return toast('Her türde en az bir kategori kalmalı');
    const used = await db.entries.where('categoryId').equals(id).count();
    const msg = used
      ? `${name} kategorisinde ${used} kayıt var. Kayıtlar ${fallback.name} kategorisine taşınacak. Silinsin mi?`
      : `${name} silinsin mi?`;
    if (!confirm(msg)) return;
    await db.transaction('rw', [db.cats, db.entries, db.budgets, db.subs], async () => {
      await db.entries.where('categoryId').equals(id).modify({ categoryId: fallback.id });
      await db.subs.filter((r) => r.categoryId === id).modify({ categoryId: fallback.id });
      await db.budgets.delete(id);
      await db.cats.delete(id);
    });
    if (editingId === id) resetForm();
  }

  async function wipe() {
    if (!confirm('Tüm kayıtlar, bütçeler ve kategoriler silinecek (giriş yaptıysan diğer cihazlarından da). Bu geri alınamaz. Emin misin?')) return;
    if (txCount > 0 && confirm('Silmeden önce yedek alınsın mı?')) {
      try {
        await exportJSON();
      } catch {
        return toast('Yedek alınmadı, silme iptal edildi');
      }
    }
    await db.transaction('rw', [db.cats, db.entries, db.budgets, db.meta, db.subs, db.goals], async () => {
      await Promise.all([
        db.entries.clear(),
        db.budgets.clear(),
        db.cats.clear(),
        db.meta.bulkDelete(['totalBudget', 'lastBackup']),
        db.subs.clear(),
        db.goals.clear(),
      ]);
      await db.cats.bulkAdd(defaultCategories());
    });
    toast('Tüm veriler silindi');
  }

  return (
    <>
      <header className="page-head">
        <h1>Ayarlar</h1>
      </header>

      {cloudEnabled && <Account toast={toast} />}

      <section className="block">
        <h2 className="block-title">Yedekleme</h2>
        <p className="muted small">
          {txCount} kayıt · Son yedek: {lastBackup ? lastBackup.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) : 'yok'}
        </p>
        {!persisted && <p className="muted small">Ana ekrana ekle, verilerin daha güvende olur.</p>}
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
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              className={newType === t ? 'on' : ''}
              onClick={() => {
                setNewType(t);
                resetForm();
              }}
            >
              {t === 'expense' ? 'Gider' : 'Gelir'}
            </button>
          ))}
        </div>

        <ul className="chips">
          {categories
            .filter((c) => c.type === newType)
            .map((c) => (
              <li key={c.id} className={editingId === c.id ? 'on' : ''}>
                <button className="chip-main" onClick={() => startEdit(c)} aria-label={`${c.name} kategorisini düzenle`}>
                  <span style={{ color: c.color }}>
                    <CategoryIcon name={c.icon} size={15} />
                  </span>
                  {c.name}
                </button>
                <button aria-label={`${c.name} kategorisini sil`} onClick={() => removeCategory(c.id!, c.name)}>
                  <X size={14} strokeWidth={1.75} />
                </button>
              </li>
            ))}
        </ul>

        <p className="muted small">
          {editingId != null
            ? 'Adını, simgesini ya da rengini değiştir.'
            : 'Düzenlemek için bir kategoriye dokun. Yeni kategori için simge ve renk seç, adını yaz.'}
        </p>
        <div className="icon-pick" role="radiogroup" aria-label="Kategori simgesi">
          {iconChoices.map((i) => (
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
        <div className="color-pick" role="radiogroup" aria-label="Kategori rengi">
          {PALETTE.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === newColor}
              aria-label={`Renk ${c}`}
              className={c === newColor ? 'on' : ''}
              style={{ background: c }}
              onClick={() => setNewColor(c)}
            />
          ))}
        </div>
        <div className="inline-form">
          <input
            placeholder="Kategori adı"
            value={newName}
            maxLength={20}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveCategory()}
            aria-label="Kategori adı"
          />
          <button className="primary small-btn" onClick={saveCategory} disabled={!newName.trim()}>
            {editingId != null ? 'Kaydet' : 'Ekle'}
          </button>
          {editingId != null && (
            <button className="link" onClick={resetForm}>
              Vazgeç
            </button>
          )}
        </div>
      </section>

      <Subs toast={toast} />

      <section className="block">
        <p className="muted small center">Nekadar · ücretsiz, reklamsız</p>
        <button className="text-danger" onClick={wipe}>
          <Trash2 size={16} strokeWidth={1.75} />
          Tüm verileri sil
        </button>
      </section>
    </>
  );
}
