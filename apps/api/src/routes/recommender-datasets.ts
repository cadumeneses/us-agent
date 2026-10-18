import { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { definitionIdentitySchema } from '../domain/recommender-definition.js';
import { IMPORT_MAX_BYTES, parseImportJson } from '../domain/import-formats.js';
import { createDatasetPreview, loadDatasetImport, loadDatasetOriginal, listDatasetVersions, loadDatasetVersion, publishDatasetVersion, retireDatasetVersion, DatasetRequestError } from '../services/recommender-datasets.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';
import { TestCaseCatalogRequestError } from '../services/test-case-catalogs.js';

export const recommenderDatasetsRouter = Router();
recommenderDatasetsRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 1, fieldSize: 200_000 } });
const actor = () => process.env.INGEST_API_KEY ? 'internal-api' : 'local-development';
const importPath = z.strictObject({ importId: z.uuid() });

recommenderDatasetsRouter.post('/imports/preview', upload.single('file'), async (req, res) => {
  if (!req.file || typeof req.body?.spec !== 'string') throw new DatasetRequestError(400, 'Envie arquivo file e especificação JSON no campo spec.');
  let spec: unknown;
  try { spec = parseImportJson(req.body.spec); }
  catch (error) { throw new DatasetRequestError(422, error instanceof Error ? error.message : 'Especificação JSON inválida.'); }
  const filename = req.file.originalname.replaceAll('\\', '/').split('/').at(-1)!;
  if (!filename.length || filename.length > 240 || /[\x00-\x1f]/.test(filename)) throw new DatasetRequestError(400, 'Nome de arquivo inválido.');
  res.status(201).json(await createDatasetPreview(spec, req.file.buffer, filename, actor()));
});
recommenderDatasetsRouter.get('/imports/:importId', async (req, res) => {
  res.json(await loadDatasetImport(importPath.parse(req.params).importId));
});
recommenderDatasetsRouter.get('/imports/:importId/original', async (req, res) => {
  const { importId } = importPath.parse(req.params);
  const file = await loadDatasetOriginal(importId);
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="import-${importId}.${file.format}"`);
  res.set('X-Content-SHA256', file.sha256);
  res.send(file.bytes);
});
recommenderDatasetsRouter.get('/', async (req, res) => {
  const options = z.strictObject({ id: definitionIdentitySchema.shape.id.optional(), state: z.enum(['published', 'retired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await listDatasetVersions(options));
});
recommenderDatasetsRouter.get('/:id/versions/:version', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  res.json(await loadDatasetVersion(id, version));
});
recommenderDatasetsRouter.post('/:id/versions/:version/publish', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  const body = z.strictObject({ importId: z.uuid(), previewSha256: z.string().regex(/^[a-f0-9]{64}$/),
    excludedOrdinals: z.array(z.number().int().positive()).max(10000).default([]) }).parse(req.body);
  res.json(await publishDatasetVersion(id, version, body.importId, body.previewSha256, body.excludedOrdinals, actor()));
});
recommenderDatasetsRouter.post('/:id/versions/:version/retire', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  if (req.body !== undefined && !z.strictObject({}).safeParse(req.body).success) throw new DatasetRequestError(400, 'Retirada não aceita alterações de conteúdo.');
  res.json(await retireDatasetVersion(id, version));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof DatasetRequestError || error instanceof TestCaseCatalogRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Importação ou parâmetros inválidos.', issues: error.issues }); return; }
  if (error instanceof multer.MulterError) { res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: `Limite de upload: ${error.code}` }); return; }
  next(error);
};
recommenderDatasetsRouter.use(errors);
