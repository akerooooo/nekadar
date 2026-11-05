const tl = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
const tlShort = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });

export const formatTL = (n: number) => tl.format(n);
export const formatTLShort = (n: number) => tlShort.format(n);

export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());

/** "2026-11" bicimli ay anahtari */
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

export const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export const monthRange = (key: string): [string, string] => [`${key}-01`, `${key}-31`];

export const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const t = today();
  if (iso === t) return 'Bugün';
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (iso === toISODate(yest)) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
};

/** "1.234,56" / "1234.56" / "1234,5" -> sayi */
export function parseAmount(input: string): number {
  if (input.trim().startsWith('-')) return NaN; // eksi tutar: tur Gider/Gelir ile secilir
  let s = input.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const separators = s.match(/[.,]/g)?.length ?? 0;
  if (/^\d{1,3}([.,])\d{3}(\1\d{3})+$/.test(s)) {
    // "1.000.000" / "1,000,000" -> hepsi binlik ayirici
    s = s.replace(/[.,]/g, '');
  } else if (separators > 1 && (lastComma === -1 || lastDot === -1)) {
    return NaN; // "12,5,3" gibi anlamsiz giris
  } else if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, '');
  } else if (lastDot !== -1 && s.length - lastDot - 1 === 3 && s.indexOf('.') === lastDot) {
    // "1.250" -> binlik ayirici
    s = s.replace('.', '');
  }
  return Math.round(parseFloat(s) * 100) / 100;
}

/**
 * Kiyas icin onceki ayin tarih araligi. Icinde bulunulan ay gosteriliyorsa
 * onceki ayin yalnizca ayni gunune kadari alinir (6 Kasim'da 1-6 Ekim).
 */
export function compareRange(month: string, todayIso: string): { from: string; to: string; partial: boolean } {
  const prev = shiftMonth(month, -1);
  const partial = todayIso.startsWith(month);
  return { from: `${prev}-01`, to: partial ? `${prev}-${todayIso.slice(8)}` : `${prev}-31`, partial };
}

/** CSV hucresi: ; " ve satir sonu tirnaklanir; = + - @ ile baslayan metin Excel'de formul olarak calismasin diye ' ile baslar */
export function csvCell(s: string): string {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
