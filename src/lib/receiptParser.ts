export interface ReceiptResult {
  amount?: number;
  date?: string; // YYYY-MM-DD
  merchant?: string;
}

// 1.234,56 | 1234,56 | 1 234,56 | 1234.56 (OCR bazen virgul yerine nokta okur)
const AMOUNT_RE = /(\d{1,3}(?:[.\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g;
// Once gercek toplam satirlari aranir; bulunamazsa odeme satirlari (nakitte para ustu olabilir)
const TOTAL_RE = /(GENEL\s*TOPLAM|TOPLAM|TOP\b|TOPL|[ÖO]DENECEK)/i;
const PAYMENT_RE = /(TUTAR|NAK[İI]T|KRED[İI]\s*KART|BANKA\s*KART)/i;
const EXCLUDE_RE = /(KDV|TOPKDV|VERG[İI]|PARA\s*[ÜU]ST|ARA\s*TOPLAM|[İI]ND[İI]R[İI]M)/i;

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const whole = m[1].replace(/[.\s]/g, '');
    const n = parseFloat(`${whole}.${m[2]}`);
    if (n > 0 && n < 1_000_000) out.push(n);
  }
  return out;
}

function findDate(text: string): string | undefined {
  const m = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/);
  if (!m) return undefined;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2000 || y > 2100) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function findMerchant(lines: string[]): string | undefined {
  for (const raw of lines.slice(0, 5)) {
    const line = raw.replace(/[^\p{L}\p{N}\s&.'-]/gu, '').trim();
    const letters = line.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 3 && !/F[İI]Ş|TAR[İI]H|SAAT|VERG[İI]/i.test(line)) {
      return line.length > 40 ? line.slice(0, 40) : line;
    }
  }
  return undefined;
}

export function parseReceipt(text: string): ReceiptResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let amount: number | undefined;
  for (const re of [TOTAL_RE, PAYMENT_RE]) {
    // Sondan basa: toplam genelde fisin altindadir
    for (let i = lines.length - 1; i >= 0 && amount == null; i--) {
      const line = lines[i];
      if (!re.test(line) || EXCLUDE_RE.test(line)) continue;
      const here = amountsIn(line);
      const found = here.length ? here : amountsIn(lines[i + 1] ?? '');
      if (found.length) amount = found[found.length - 1];
    }
    if (amount != null) break;
  }
  if (amount == null) {
    // Yedek: fisteki en buyuk tutar
    const all = lines.filter((l) => !EXCLUDE_RE.test(l)).flatMap(amountsIn);
    if (all.length) amount = Math.max(...all);
  }

  return { amount, date: findDate(text), merchant: findMerchant(lines) };
}
