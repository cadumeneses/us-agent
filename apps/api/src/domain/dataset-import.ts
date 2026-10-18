import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, JSON_HASH_FORMAT, snapshotContent } from './content-snapshot.js';
import { parseDefinitionPublication, type DefinitionPublication } from './definition-publication.js';
import { createRecommendationInputValidator, definitionIdentitySchema, recommendationInputSchema, type RecommendationInput } from './recommender-definition.js';
import { IMPORT_MAX_BYTES, IMPORT_MAX_RECORDS, ImportFormatError, parseImportCsv, parseImportJson, type SourceRow } from './import-formats.js';

export const IMPORTER_VERSION = 'structured-import-v1';
export const contentReferenceSchema = definitionIdentitySchema.extend({ format: z.literal(JSON_HASH_FORMAT), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const sourcePath = z.array(z.string().min(1).max(240)).min(1).max(20);
export const datasetImportSpecSchema = z.strictObject({
  schemaVersion: z.literal(1), id: definitionIdentitySchema.shape.id, version: definitionIdentitySchema.shape.version,
  definition: contentReferenceSchema, format: z.enum(['json', 'csv']), delimiter: z.enum([',', ';', '\t']).optional(),
  source: z.strictObject({ description: z.string().min(1).max(500),
    authorization: z.strictObject({ basis: z.enum(['synthetic', 'public-license', 'permission', 'owned']), reference: z.string().min(1).max(2000) }) }),
  mapping: z.strictObject({ recordId: sourcePath,
    attributes: z.record(definitionIdentitySchema.shape.id, z.strictObject({ path: sourcePath, encoding: z.enum(['value', 'json']) })) })
}).superRefine((spec, context) => {
  if (spec.format === 'json' && spec.delimiter !== undefined) context.addIssue({ code: 'custom', path: ['delimiter'], message: 'Delimitador se aplica somente a CSV.' });
});
export type DatasetImportSpec = z.infer<typeof datasetImportSpecSchema>;
const issueSchema = z.strictObject({ path: z.array(z.union([z.string(), z.number()])), code: z.string(), message: z.string() });
const rowSchema = z.strictObject({ ordinal: z.number().int().positive(), line: z.number().int().positive().nullable(), id: z.string().nullable(),
  status: z.enum(['valid', 'invalid', 'duplicate']), issues: z.array(issueSchema), input: recommendationInputSchema.nullable() });
export const importPreviewSchema = z.strictObject({
  schemaVersion: z.literal(1), importerVersion: z.literal(IMPORTER_VERSION), spec: datasetImportSpecSchema,
  file: z.strictObject({ name: z.string(), byteLength: z.number().int(), sha256: z.string().regex(/^[a-f0-9]{64}$/), encoding: z.literal('utf-8'), bom: z.boolean() }),
  definition: z.strictObject({ format: z.literal(JSON_HASH_FORMAT), sha256: z.string(), content: z.unknown() }),
  fields: z.array(z.strictObject({ id: z.string(), role: z.string(), required: z.boolean(), cardinality: z.string(), path: sourcePath.nullable() })),
  report: z.strictObject({ fatal: z.array(issueSchema), sourceFields: z.array(z.string()), unmappedSourceFields: z.array(z.string()),
    total: z.number().int(), valid: z.number().int(), invalid: z.number().int(), duplicate: z.number().int(), rows: z.array(rowSchema) })
});
export type ImportPreview = z.infer<typeof importPreviewSchema>;
type Issue = z.infer<typeof issueSchema>;
type PreviewRow = z.infer<typeof rowSchema>;
const issue = (code: string, message: string, path: Array<string | number> = []): Issue => ({ code, message, path });

function readPath(raw: unknown, path: string[]): unknown {
  let current = raw;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function duplicateIssues(rows: Array<{ ordinal: number; input: RecommendationInput | null }>, publication: DefinitionPublication): Map<number, Issue[]> {
  const checks = [{ name: 'record_id', get: (input: RecommendationInput) => input.id }];
  // These are identity constraints of the implemented RNF adapter, not candidate eligibility filters.
  for (const slot of ['classification_id', 'story_id']) {
    const id = publication.definition.method.bindings[slot];
    if (id) checks.push({ name: id, get: input => String(input.values[id]) });
  }
  const issues = new Map<number, Issue[]>();
  for (const check of checks) {
    const groups = new Map<string, number[]>();
    for (const row of rows) if (row.input) {
      const value = check.get(row.input);
      const group = groups.get(value) ?? []; group.push(row.ordinal); groups.set(value, group);
    }
    for (const ordinals of groups.values()) if (ordinals.length > 1) {
      const message = `Identidade repetida em ${ordinals.length} registros; exemplos: ${ordinals.slice(0, 10).join(', ')}.`;
      for (const ordinal of ordinals) issues.set(ordinal, [...(issues.get(ordinal) ?? []), issue('duplicate', message, [check.name])]);
    }
  }
  return issues;
}

export function buildImportPreview(rawSpec: unknown, bytes: Buffer, filename: string, rawPublication: unknown): ImportPreview {
  canonicalJson(rawSpec);
  const spec = datasetImportSpecSchema.parse(rawSpec);
  const publication = parseDefinitionPublication(rawPublication);
  const definition = snapshotContent(publication);
  if (spec.definition.id !== publication.definition.id || spec.definition.version !== publication.definition.version ||
      spec.definition.format !== definition.format || spec.definition.sha256 !== definition.sha256) throw new Error('Definição difere da publicação selecionada.');
  const declared = new Map(publication.definition.attributes.map(attribute => [attribute.id, attribute]));
  for (const id of Object.keys(spec.mapping.attributes)) if (!declared.has(id)) throw new Error(`Mapeamento aponta para atributo inexistente: ${id}`);
  for (const attribute of declared.values()) if (attribute.required && !Object.hasOwn(spec.mapping.attributes, attribute.id)) throw new Error(`Atributo obrigatório sem mapeamento: ${attribute.id}`);
  const fields = publication.definition.attributes.map(attribute => ({ id: attribute.id, role: attribute.role, required: attribute.required,
    cardinality: attribute.cardinality, path: spec.mapping.attributes[attribute.id]?.path ?? null }));
  const file = { name: filename, byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), encoding: 'utf-8' as const,
    bom: bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf };
  const fatal: Issue[] = [];
  const rows: PreviewRow[] = [];
  const sourceFields = new Set<string>();
  const used = new Set([spec.mapping.recordId[0], ...Object.values(spec.mapping.attributes).map(mapping => mapping.path[0])]);
  let parsed: SourceRow[] = [];
  try {
    if (!bytes.length || bytes.length > IMPORT_MAX_BYTES) throw new ImportFormatError(`Arquivo deve conter de 1 a ${IMPORT_MAX_BYTES} bytes.`);
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { throw new ImportFormatError('Arquivo deve usar UTF-8 válido.'); }
    if (spec.format === 'csv') {
      const csv = parseImportCsv(text, spec.delimiter ?? ','); parsed = csv.rows;
      csv.fields.forEach(field => sourceFields.add(field));
    } else {
      const value = parseImportJson(text);
      if (!Array.isArray(value)) throw new ImportFormatError('JSON deve conter um array de registros.');
      if (value.length > IMPORT_MAX_RECORDS) throw new ImportFormatError(`Arquivo excede ${IMPORT_MAX_RECORDS} registros.`);
      parsed = value.map((record, index) => ({ ordinal: index + 1, line: null, value: record }));
    }
    if (!parsed.length) throw new ImportFormatError('Arquivo não contém registros.');
  } catch (error) {
    fatal.push(issue('file_format', error instanceof Error ? error.message : 'Arquivo inválido.', [error instanceof ImportFormatError ? error.line : 1]));
  }
  const validateInput = createRecommendationInputValidator(publication.definition, publication.taxonomies);
  let normalizedBytes = 0;
  for (const raw of parsed) {
    const row: PreviewRow = { ordinal: raw.ordinal, line: raw.line, id: null, status: 'invalid', issues: [], input: null };
    rows.push(row);
    if (normalizedBytes > 10_000_000) { row.issues.push(issue('normalized_size', 'Registro não processado após exceder o limite explícito da prévia.')); continue; }
    if (raw.error) { row.issues.push(issue('column_count', raw.error)); continue; }
    if (raw.value === null || typeof raw.value !== 'object' || Array.isArray(raw.value)) { row.issues.push(issue('record_type', 'Registro deve ser um objeto.')); continue; }
    Object.keys(raw.value).forEach(field => sourceFields.add(field));
    const id = readPath(raw.value, spec.mapping.recordId);
    if (typeof id !== 'string' || !id.length || id.length > 160) row.issues.push(issue('record_id', 'ID deve ser texto não vazio com até 160 caracteres.', spec.mapping.recordId));
    else row.id = id;
    const values: Record<string, unknown> = {};
    for (const [attributeId, mapping] of Object.entries(spec.mapping.attributes)) {
      let value = readPath(raw.value, mapping.path);
      if (value === undefined) continue;
      if (mapping.encoding === 'json') {
        try {
          if (typeof value !== 'string') throw new Error('Codificação JSON requer uma célula textual.');
          value = parseImportJson(value);
        } catch (error) { row.issues.push(issue('cell_json', error instanceof Error ? error.message : 'JSON inválido na célula.', [attributeId])); continue; }
      }
      values[attributeId] = value;
      try { normalizedBytes += Buffer.byteLength(canonicalJson(value), 'utf8'); }
      catch (error) { row.issues.push(issue('json_value', error instanceof Error ? error.message : 'Valor não JSON.', [attributeId])); }
      if (normalizedBytes > 10_000_000) break;
    }
    if (normalizedBytes > 10_000_000) {
      const exceeded = issue('normalized_size', 'Valores mapeados excedem 10 MB; a prévia não pode ser publicada.');
      fatal.push(exceeded); row.issues.push(exceeded); continue;
    }
    if (row.issues.length) continue;
    try {
      row.input = validateInput({ id: row.id, values, provenance: { source: `import:${file.sha256}`, sourceRecordId: row.id } });
      for (const slot of ['classification_id', 'story_id']) {
        const id = publication.definition.method.bindings[slot];
        if (id && (typeof row.input.values[id] !== 'string' || !String(row.input.values[id]).trim())) row.issues.push(issue('identity_empty', 'Identidade RNF deve ser preenchida.', [id]));
      }
      if (row.issues.length) { row.input = null; continue; }
      row.status = 'valid';
    } catch (error) {
      if (error instanceof z.ZodError) row.issues.push(...error.issues.map(item => issue('attribute', item.message, item.path.map(String))));
      else row.issues.push(issue('attribute', error instanceof Error ? error.message : 'Entrada inválida.'));
    }
  }
  const duplicates = duplicateIssues(rows, publication);
  for (const row of rows) if (duplicates.has(row.ordinal)) { row.status = 'duplicate'; row.issues.push(...duplicates.get(row.ordinal)!); }
  return importPreviewSchema.parse({ schemaVersion: 1, importerVersion: IMPORTER_VERSION, spec, file, definition, fields,
    report: { fatal, sourceFields: [...sourceFields].sort(), unmappedSourceFields: [...sourceFields].filter(field => !used.has(field)).sort(), total: parsed.length,
      valid: rows.filter(row => row.status === 'valid').length, invalid: rows.filter(row => row.status === 'invalid').length,
      duplicate: rows.filter(row => row.status === 'duplicate').length, rows } });
}

export function selectImportRecords(preview: ImportPreview, excludedOrdinals: number[]) {
  if (preview.report.fatal.length) throw new Error('Prévia contém erro de arquivo; corrija a origem e crie outra prévia.');
  const excluded = z.array(z.number().int().positive()).max(IMPORT_MAX_RECORDS).parse(excludedOrdinals);
  const excludedSet = new Set(excluded), available = new Set(preview.report.rows.map(row => row.ordinal));
  if (excludedSet.size !== excluded.length || excluded.some(ordinal => !available.has(ordinal))) throw new Error('Exclusões devem indicar registros existentes, sem duplicatas.');
  const included = preview.report.rows.filter(row => !excludedSet.has(row.ordinal));
  if (!included.length) throw new Error('Selecione ao menos um registro.');
  if (included.some(row => row.input === null)) throw new Error('Exclua explicitamente os registros inválidos antes de publicar.');
  const publication = parseDefinitionPublication(preview.definition.content);
  if (duplicateIssues(included, publication).size) throw new Error('Resolva as identidades duplicadas por exclusões explícitas antes de publicar.');
  return { excludedOrdinals: [...excluded].sort((a, b) => a - b), includedOrdinals: included.map(row => row.ordinal), records: included.map(row => row.input!) };
}
