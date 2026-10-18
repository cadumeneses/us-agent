export const IMPORT_MAX_BYTES = 5_000_000;
export const IMPORT_MAX_RECORDS = 10_000;

export class ImportFormatError extends Error {
  constructor(message: string, public line = 1) { super(message); }
}

// JSON.parse permits duplicate object keys. Reject them before they can erase a label/value.
export function parseImportJson(text: string): unknown {
  const stack: Array<{ kind: 'object' | 'array'; keys: Set<string>; expectingKey: boolean }> = [];
  let line = 1;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '\n') line++;
    if (character === '"') {
      const start = index;
      index++;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === '\\') index++;
        index++;
      }
      if (index >= text.length) throw new ImportFormatError('String JSON não terminada.', line);
      const frame = stack.at(-1);
      if (frame?.kind === 'object' && frame.expectingKey) {
        let key: string;
        try { key = JSON.parse(text.slice(start, index + 1)); }
        catch { throw new ImportFormatError('Chave JSON inválida.', line); }
        if (frame.keys.has(key)) throw new ImportFormatError(`Chave JSON duplicada: ${key}`, line);
        frame.keys.add(key);
      }
    } else if (character === '{' || character === '[') {
      stack.push({ kind: character === '{' ? 'object' : 'array', keys: new Set(), expectingKey: character === '{' });
      if (stack.length > 80) throw new ImportFormatError('JSON excede 80 níveis.', line);
    } else if (character === '}' || character === ']') stack.pop();
    else if (character === ':' && stack.at(-1)) stack.at(-1)!.expectingKey = false;
    else if (character === ',' && stack.at(-1)?.kind === 'object') stack.at(-1)!.expectingKey = true;
  }
  try { return JSON.parse(text); }
  catch (error) { throw new ImportFormatError(`JSON inválido: ${error instanceof Error ? error.message : 'erro de sintaxe'}`, line); }
}

export type SourceRow = { ordinal: number; line: number | null; value: unknown; error?: string };

export function parseImportCsv(text: string, delimiter: ',' | ';' | '\t'): { rows: SourceRow[]; fields: string[] } {
  const parsed: Array<{ line: number; cells: string[] }> = [];
  let cells: string[] = [], cell = '', quoted = false, closed = false, line = 1, startLine = 1;
  const finishCell = () => { cells.push(cell); cell = ''; closed = false; };
  const finishRow = () => {
    finishCell(); parsed.push({ line: startLine, cells }); cells = [];
    if (parsed.length > IMPORT_MAX_RECORDS + 1) throw new ImportFormatError(`Arquivo excede ${IMPORT_MAX_RECORDS} registros.`, line);
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closed = true; }
      } else {
        cell += character;
        if (character === '\n' || character === '\r' && text[index + 1] !== '\n') line++;
      }
      continue;
    }
    if (character === delimiter) finishCell();
    else if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index++;
      line++; startLine = line;
    } else if (character === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || character === '"') throw new ImportFormatError('Aspas ou conteúdo após aspas inválidos no CSV.', line);
      cell += character;
    }
  }
  if (quoted) throw new ImportFormatError('Campo CSV com aspas não terminadas.', line);
  if (cell !== '' || cells.length || closed) finishRow();
  const header = parsed.shift();
  if (!header || header.cells.some(name => !name) || new Set(header.cells).size !== header.cells.length) {
    throw new ImportFormatError('CSV requer cabeçalho com nomes não vazios e sem duplicatas.');
  }
  if (header.cells.length > 500) throw new ImportFormatError('CSV excede 500 colunas.');
  return { fields: header.cells, rows: parsed.map((row, index) => ({ ordinal: index + 1, line: row.line,
    value: row.cells.length === header.cells.length ? Object.fromEntries(header.cells.map((name, position) => [name, row.cells[position]])) : null,
    ...(row.cells.length === header.cells.length ? {} : { error: `Esperadas ${header.cells.length} colunas; recebidas ${row.cells.length}.` }) })) };
}
