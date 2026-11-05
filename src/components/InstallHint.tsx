import { useState } from 'react';
import { Share, X } from 'lucide-react';

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
  if (closed || isStandalone() || !isIOS()) return null;
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
