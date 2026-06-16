// Helpers CSV partagés (export téléchargeable + parsing d'import).
// Séparateur « ; » et BOM UTF-8 pour qu'Excel (FR) ouvre proprement les accents.

const BOM = String.fromCharCode(0xfeff);

export function downloadCSV(
  filename: string,
  header: string[],
  rows: (string | number)[][]
) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const content = [header, ...rows].map((r) => r.map(escape).join(';')).join('\n');
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse un CSV simple (séparateur « ; » ou « , », guillemets gérés) en lignes
 * d'objets indexés par l'en-tête. Tolère le BOM et les retours chariot Windows.
 */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = splitRows(clean);
  if (rows.length < 2) return [];
  const delim = rows[0].includes(';') ? ';' : ',';
  const header = parseLine(rows[0], delim).map((h) => h.trim());
  return rows.slice(1).map((line) => {
    const cells = parseLine(line, delim);
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = (cells[i] ?? '').trim()));
    return obj;
  });
}

function splitRows(text: string): string[] {
  // Découpe sur les sauts de ligne hors guillemets.
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQuotes = !inQuotes;
    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim() !== '') out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseLine(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === delim && !inQuotes) {
      cells.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}
