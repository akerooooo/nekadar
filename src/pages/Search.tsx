import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search as SearchIcon } from 'lucide-react';
import EntryList from '../components/EntryList';
import { db, type Transaction, type TxType } from '../db';
import { totals, useCategories, useCategoryMap } from '../lib/data';
import { formatTL } from '../lib/format';
import { matchEntry } from '../lib/search';

/** Tum aylarda arama: not, kategori, tutar; kategori ve tur suzgeci */
export default function Search({ onClose, onEdit }: { onClose: () => void; onEdit: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<TxType | 'all'>('all');
  const [catId, setCatId] = useState<string | null>(null);
  const categories = useCategories();
  const cats = useCategoryMap();
  // shortcut: tum kayitlar bellekte suzulur; binlerce kayitta yeterli, cok buyurse indeksli sorgu
  const all = useLiveQuery(() => db.entries.toArray(), [], [] as Transaction[]);

  const active = query.trim() || type !== 'all' || catId;
  const results = active
    ? all.filter(
        (t) =>
          (type === 'all' || t.type === type) &&
          (!catId || t.categoryId === catId) &&
          matchEntry(t, query, cats.get(t.categoryId)?.name),
      )
    : [];
  const { income, expense } = totals(results);
  const chipCats = categories.filter((c) => type === 'all' || c.type === type);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tall" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kayıtlarda ara">
        <div className="sheet-head">
          <span />
          <b>Ara</b>
          <button className="link strong" onClick={onClose}>Kapat</button>
        </div>

        <label className="search-field">
          <SearchIcon size={18} strokeWidth={1.75} />
          <input
            autoFocus
            type="search"
            placeholder="Not, kategori ya da tutar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Arama"
          />
        </label>

        <div className="segmented">
          {(['all', 'expense', 'income'] as const).map((t) => (
            <button
              key={t}
              className={type === t ? 'on' : ''}
              onClick={() => {
                setType(t);
                setCatId(null);
              }}
            >
              {t === 'all' ? 'Tümü' : t === 'expense' ? 'Gider' : 'Gelir'}
            </button>
          ))}
        </div>

        <ul className="chips kinds" aria-label="Kategori">
          {chipCats.map((c) => (
            <li key={c.id} className={catId === c.id ? 'on' : ''}>
              <button className="chip-main" aria-pressed={catId === c.id} onClick={() => setCatId(catId === c.id ? null : c.id!)}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>

        {!active ? (
          <p className="muted center">Aramak için yaz ya da bir kategori seç.</p>
        ) : results.length === 0 ? (
          <p className="muted center">Sonuç yok.</p>
        ) : (
          <>
            <p className="muted small">
              {results.length} kayıt
              {expense > 0 && `, gider ${formatTL(expense)}`}
              {income > 0 && `, gelir ${formatTL(income)}`}
            </p>
            <div>
              <EntryList txs={results} cats={cats} onEdit={onEdit} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
