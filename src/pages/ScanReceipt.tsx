import { useEffect, useRef, useState } from 'react';
import { createWorker } from 'tesseract.js';
import { Camera, Images } from 'lucide-react';
import { parseReceipt, type ReceiptResult } from '../lib/receiptParser';
import { formatTL } from '../lib/format';

interface Props {
  onClose: () => void;
  onResult: (r: ReceiptResult) => void;
}

type Stage = 'pick' | 'working' | 'done' | 'error';

/** Fotografi kucultup gri tona cevirir: OCR hem hizlanir hem iyilesir */
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

export default function ScanReceipt({ onClose, onResult }: Props) {
  const [stage, setStage] = useState<Stage>('pick');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiptResult>({});
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStage('working');
    setProgress(0);
    setStatus('Hazırlanıyor…');
    try {
      const image = await prepareImage(file);
      const worker = await createWorker('tur', 1, {
        logger: (m) => {
          if (cancelled.current) return;
          if (m.status === 'recognizing text') {
            setStatus('Fiş okunuyor…');
            setProgress(m.progress);
          } else if (m.status.includes('loading')) {
            setStatus('Okuma motoru yükleniyor (ilk seferde biraz sürer)…');
          }
        },
      });
      const { data } = await worker.recognize(image);
      await worker.terminate();
      if (cancelled.current) return;
      const parsed = parseReceipt(data.text);
      setResult(parsed);
      setStage(parsed.amount ? 'done' : 'error');
    } catch (e) {
      console.error(e);
      if (!cancelled.current) setStage('error');
    }
  }

  return (
    <div className="sheet-backdrop top" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Fişten oku">
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Kapat</button>
          <b>Fişten oku</b>
          <span />
        </div>

        {preview && <img className="receipt-preview" src={preview} alt="Fiş" />}

        {stage === 'pick' && (
          <>
            <p className="muted">
              Fişin tamamı görünecek şekilde, düz ve iyi ışıkta fotoğrafını çek. Tutar ve tarih otomatik doldurulur,
              kaydetmeden önce kontrol edebilirsin.
            </p>
            <label className="primary file-btn">
              <Camera size={18} strokeWidth={1.75} />
              Fotoğraf çek
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <label className="secondary file-btn">
              <Images size={18} strokeWidth={1.75} />
              Galeriden seç
              <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            <p className="muted small">Fotoğraf telefonundan çıkmaz; okuma cihazında yapılır.</p>
          </>
        )}

        {stage === 'working' && (
          <div className="pad">
            <p>{status}</p>
            <div className="progress">
              <div className="progress-bar ok" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        )}

        {stage === 'done' && (
          <>
            <ul className="list">
              <li className="kv"><span className="muted">Tutar</span><b>{formatTL(result.amount!)}</b></li>
              {result.date && <li className="kv"><span className="muted">Tarih</span><b>{result.date.split('-').reverse().join('.')}</b></li>}
              {result.merchant && <li className="kv"><span className="muted">İşyeri</span><b>{result.merchant}</b></li>}
            </ul>
            <button className="primary" onClick={() => onResult(result)}>Bunları kullan</button>
            <button className="secondary" onClick={() => setStage('pick')}>Tekrar dene</button>
          </>
        )}

        {stage === 'error' && (
          <>
            <p>Tutar okunamadı. Daha net bir fotoğrafla tekrar deneyebilir ya da tutarı elle girebilirsin.</p>
            <p className="muted small">İlk okuma için internet gerekir; sonrasında internetsiz çalışır.</p>
            <button className="primary" onClick={() => setStage('pick')}>Tekrar dene</button>
            <button className="secondary" onClick={onClose}>Elle gir</button>
          </>
        )}
      </div>
    </div>
  );
}
