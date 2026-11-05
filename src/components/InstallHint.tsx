import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Share, TriangleAlert, X } from 'lucide-react';
import { db } from '../db';

const KEY = 'nekadar.installHintClosed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

export default function InstallHint() {
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  const hasData = useLiveQuery(async () => (await db.entries.count()) > 0, [], false);
  if (isStandalone() || !isIOS()) return null;
  // Kayit varken Safari'de kullanmak veri kaybi riski: bu uyari kapatilamaz
  if (hasData)
    return (
      <div className="install-hint warn" role="alert">
        <TriangleAlert size={18} strokeWidth={1.75} />
        <p>
          Safari'de verilerin 7 gün açılmazsa silinebilir. <b>Paylaş</b> düğmesinden <b>Ana Ekrana Ekle</b>'yi seç ve
          uygulamayı oradan aç. Önce Ayarlar'dan yedek al: Safari'deki kayıtlar ana ekrandaki uygulamaya geçmez.
        </p>
      </div>
    );
  if (closed) return null;
  return (
    <div className="install-hint">
      <Share size={18} strokeWidth={1.75} />
      <p>
        Uygulama gibi kullanmak için Safari'de <b>Paylaş</b> düğmesine dokun, sonra <b>Ana Ekrana Ekle</b>'yi seç.
      </p>
      <button
        aria-label="Kapat"
        onClick={() => {
          setClosed(true);
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* yok say */
          }
        }}
      >
        <X size={16} strokeWidth={1.75} />
      </button>
    </div>
  );
}
