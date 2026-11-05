import { useState } from 'react';

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
    <div className="card hint">
      <strong>Uygulama gibi kullan</strong>
      <p>
        Safari'de alttaki <b>Paylaş</b> düğmesine (kare ve ok) dokun, sonra <b>Ana Ekrana Ekle</b>'yi seç. Böylece
        tam ekran açılır ve verilerin kalıcı olur.
      </p>
      <button
        className="link"
        onClick={() => {
          setClosed(true);
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            /* yok say */
          }
        }}
      >
        Kapat
      </button>
    </div>
  );
}
