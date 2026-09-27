const FORMULA_START = new Set(['=', '+', '-', '@', '\t', '\r']);

export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let index = 0;
  let inQuotes = false;
  let pending = false;

  while (index < input.length) {
    const char = input[index] ?? '';
    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index++;
        continue;
      }
      field += char;
      index++;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      pending = true;
      index++;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      pending = true;
      index++;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      pending = false;
      index++;
      continue;
    }
    if (char === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      pending = false;
      index += input[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += char;
    pending = true;
    index++;
  }

  if (pending || inQuotes) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function cellText(value: unknown): string {
  if (value == null)
    return '';
  return String(value);
}

function escapeCell(value: string): string {
  let cell = value;
  const first = cell[0] ?? '';
  if (FORMULA_START.has(first))
    cell = `'${cell}`;
  if (/[",\r\n]/.test(cell))
    return `"${cell.replaceAll('"', '""')}"`;
  return cell;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(value => escapeCell(cellText(value))).join(',')).join('\n');
}
