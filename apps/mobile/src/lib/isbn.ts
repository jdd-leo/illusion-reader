/** Normaliza e valida ISBN-13 (dígito verificador). Converte ISBN-10 para 13. */
export function normalizeIsbn13(raw: string): string | null {
  const digits = raw.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (digits.length === 10) return isbn10To13(digits);
  if (digits.length !== 13 || !/^\d{13}$/.test(digits)) return null;
  return isValidIsbn13(digits) ? digits : null;
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

function isbn10To13(isbn10: string): string | null {
  if (!/^\d{9}[\dX]$/.test(isbn10)) return null;
  const base = `978${isbn10.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base[i]) * (i % 2 === 0 ? 1 : 3);
  return `${base}${(10 - (sum % 10)) % 10}`;
}
