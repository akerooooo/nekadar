import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, CloudCheck, CloudUpload, LogIn, LogOut, UserX } from 'lucide-react';
import { db } from '../db';
import { loadSync } from '../lib/cloud';

/** Ayarlar > Hesap: isteğe bagli Google girisi, eşitleme durumu */
export default function Account({ toast }: { toast: (m: string) => void }) {
  const email = useLiveQuery(async () => (await db.meta.get('syncEmail'))?.value ?? null, [], null);
  const pending = useLiveQuery(() => db.outbox.count(), [], 0);
  const firstSync = useLiveQuery(async () => !!(await db.meta.get('syncBusy')), [], false);
  const [busy, setBusy] = useState(false);
  // Firebase'i Ayarlar acilinca onceden yukle: dokununca Google penceresi hemen acilsin.
  // Beklerse iPhone pencereyi engeller ve daha yavas yonlendirmeye dusulur.
  const [sync, setSync] = useState<Awaited<ReturnType<typeof loadSync>> | null>(null);
  useEffect(() => {
    loadSync()
      .then((m) => {
        m.init();
        setSync(m);
      })
      .catch(console.error);
  }, []);

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      if (!/popup-closed|cancelled-popup/.test(code)) toast((e as Error).message || 'Bir hata oluştu');
    } finally {
      setBusy(false);
    }
  }

  if (!email) {
    return (
      <section className="block">
        <h2 className="block-title">Hesap</h2>
        <p className="lead">Kayıtların tüm cihazlarında olsun.</p>
        <ul className="list actions">
          <li>
            <button className="row" disabled={busy || !sync} onClick={() => act(() => sync!.signIn(), 'Giriş yapıldı')}>
              <LogIn size={18} strokeWidth={1.75} />
              <span className="row-text">{!sync ? 'Hazırlanıyor…' : busy ? 'Giriş yapılıyor…' : 'Google ile giriş yap'}</span>
              <ChevronRight size={16} strokeWidth={1.75} className="muted" />
            </button>
          </li>
        </ul>
      </section>
    );
  }

  return (
    <section className="block">
      <h2 className="block-title">Hesap</h2>
      <p className="account-row">
        {pending ? <CloudUpload size={18} strokeWidth={1.75} /> : <CloudCheck size={18} strokeWidth={1.75} />}
        <span className="row-text">
          <span>{email}</span>
          <span className="muted small">
            {firstSync
              ? 'Kayıtların buluta taşınıyor…'
              : pending
                ? `${pending} değişiklik eşitlenmeyi bekliyor`
                : 'Tüm cihazlarınla eşitlendi'}
          </span>
        </span>
      </p>
      <ul className="list actions">
        <li>
          <button className="row" disabled={busy} onClick={() => {
              if (pending && !confirm(`${pending} değişiklik henüz buluta gitmedi; çıkarsan diğer cihazlarına geçmez. Yine de çıkılsın mı?`)) return;
              act(async () => (await loadSync()).signOut(), 'Çıkış yapıldı');
            }}>
            <LogOut size={18} strokeWidth={1.75} />
            <span className="row-text">Çıkış yap</span>
          </button>
        </li>
      </ul>
      <button
        className="text-danger"
        disabled={busy}
        onClick={() => {
          if (!confirm('Hesabın ve buluttaki tüm verilerin silinecek. Bu cihazdaki kayıtlar kalır. Emin misin?')) return;
          act(async () => (await loadSync()).deleteAccount(), 'Hesap ve buluttaki veriler silindi');
        }}
      >
        <UserX size={16} strokeWidth={1.75} />
        Hesabı ve buluttaki verileri sil
      </button>
    </section>
  );
}
