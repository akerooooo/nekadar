import { lazy, Suspense, useState } from 'react';
import Home from './pages/Home';
import Budgets from './pages/Budgets';
import Settings from './pages/Settings';
import AddEntry, { type EntryDraft } from './pages/AddEntry';
import { Toast, useToast } from './components/Toast';
import InstallHint from './components/InstallHint';
import { monthKey } from './lib/format';

// Grafik kutuphanesi buyuk; sadece Grafik sekmesi acilinca yuklenir
const Stats = lazy(() => import('./pages/Stats'));

export type Tab = 'home' | 'stats' | 'budgets' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Özet', icon: '🏠' },
  { id: 'stats', label: 'Grafik', icon: '📊' },
  { id: 'budgets', label: 'Bütçe', icon: '🎯' },
  { id: 'settings', label: 'Ayarlar', icon: '⚙️' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [month, setMonth] = useState(monthKey(new Date()));
  const [editor, setEditor] = useState<EntryDraft | null>(null);
  const toast = useToast();

  function go(next: Tab) {
    setTab(next);
    window.scrollTo(0, 0);
  }

  return (
    <div className="app">
      <main className="content">
        <InstallHint />
        {tab === 'home' && <Home month={month} setMonth={setMonth} onEdit={(d) => setEditor(d)} />}
        {tab === 'stats' && (
          <Suspense fallback={<p className="muted center pad">Yükleniyor…</p>}>
            <Stats month={month} setMonth={setMonth} />
          </Suspense>
        )}
        {tab === 'budgets' && <Budgets month={month} setMonth={setMonth} />}
        {tab === 'settings' && <Settings toast={toast.show} />}
      </main>

      <nav className="tabbar">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}
        <button className="fab" aria-label="Harcama ekle" onClick={() => setEditor({})}>
          +
        </button>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}
      </nav>

      {editor && (
        <AddEntry
          draft={editor}
          onClose={() => setEditor(null)}
          onSaved={(msg) => {
            setEditor(null);
            toast.show(msg);
          }}
        />
      )}
      <Toast message={toast.message} />
    </div>
  );
}

function TabButton(p: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab ${p.active ? 'active' : ''}`} onClick={p.onClick}>
      <span className="tab-icon">{p.icon}</span>
      <span>{p.label}</span>
    </button>
  );
}
