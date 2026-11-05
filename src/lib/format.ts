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
  let s = input.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma !== -1) {
    s = s.replace(/,/g, '');
  } else if (lastDot !== -1 && s.length - lastDot - 1 === 3 && s.indexOf('.') === lastDot) {
    // "1.250" -> binlik ayirici
    s = s.replace('.', '');
  }
  return Math.round(parseFloat(s) * 100) / 100;
}
