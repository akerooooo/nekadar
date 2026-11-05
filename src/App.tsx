import { lazy, Suspense, useState } from 'react';
import { ChartPie, House, Plus, Settings2, Target, type LucideIcon } from 'lucide-react';
import Home from './pages/Home';
import Budgets from './pages/Budgets';
import Settings from './pages/Settings';
import AddEntry, { type EntryDraft } from './pages/AddEntry';
import { Toast, useToast } from './components/Toast';
import InstallHint from './components/InstallHint';
import { monthKey, monthLabel } from './lib/format';

// Grafik kutuphanesi buyuk; sadece Grafik sekmesi acilinca yuklenir
const Stats = lazy(() => import('./pages/Stats'));

export type Tab = 'home' | 'stats' | 'budgets' | 'settings';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Özet', icon: House },
  { id: 'stats', label: 'Grafik', icon: ChartPie },
  { id: 'budgets', label: 'Bütçe', icon: Target },
  { id: 'settings', label: 'Ayarlar', icon: Settings2 },
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
        {tab === 'budgets' && <Budgets month={month} setMonth={setMonth} toast={toast.show} />}
        {tab === 'settings' && <Settings toast={toast.show} />}
      </main>

      <nav className="tabbar">
        {TABS.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}
        <button className="fab" aria-label="Kayıt ekle" onClick={() => setEditor({})}>
          <Plus size={26} strokeWidth={2} />
        </button>
        {TABS.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={tab === t.id} onClick={() => go(t.id)} />
        ))}
      </nav>

      {editor && (
        <AddEntry
          draft={editor}
          onClose={() => setEditor(null)}
          onSaved={(msg, date) => {
            setEditor(null);
            // Baska aya kaydedildiyse o aya gec ve hangi ay oldugunu soyle
            if (date && date.slice(0, 7) !== month) {
              setMonth(date.slice(0, 7));
              toast.show(`${msg}: ${monthLabel(date.slice(0, 7))}`);
            } else toast.show(msg);
          }}
        />
      )}
      <Toast message={toast.message} />
    </div>
  );
}

function TabButton(p: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  const Icon = p.icon;
  return (
    <button className={`tab ${p.active ? 'active' : ''}`} onClick={p.onClick} aria-current={p.active ? 'page' : undefined}>
      <Icon size={22} strokeWidth={p.active ? 2 : 1.6} />
      <span>{p.label}</span>
    </button>
  );
}
