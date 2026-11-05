// Saf arama eslestirmesi (node testi icin import yok)

const norm = (s: string) => s.toLocaleLowerCase('tr').trim();

/** Not, kategori adi ya da tutar ("250", "250,50", "1.250") eslesirse true */
export function matchEntry(e: { note: string; amount: number }, query: string, catName = ''): boolean {
  const q = norm(query);
  if (!q) return true;
  if (norm(e.note).includes(q) || norm(catName).includes(q)) return true;
  if (!/^[\d.,]+$/.test(q)) return false;
  const hasDecimal = /,\d{1,2}$/.test(q) || /\.\d{1,2}$/.test(q);
  const n = Number(q.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.'));
  // Kurussuz yazilirsa 250 ile 250,50 de eslesir
  return hasDecimal ? Math.abs(e.amount - n) < 0.005 : Math.floor(e.amount) === n;
}
