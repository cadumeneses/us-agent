import { Router, type ErrorRequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { definitionIdentitySchema } from '../domain/recommender-definition.js';
import { IMPORT_MAX_BYTES, parseImportJson } from '../domain/import-formats.js';
import { loadTestCaseCatalog, loadTestCaseCatalogOriginal, listTestCaseCatalogs, publishTestCaseCatalog, retireTestCaseCatalog, TestCaseCatalogRequestError } from '../services/test-case-catalogs.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';

export const testCaseCatalogsRouter = Router();
testCaseCatalogsRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: IMPORT_MAX_BYTES, files: 1, fields: 1, fieldSize: 10_000 } });
testCaseCatalogsRouter.post('/:id/versions/:version/publish', upload.single('file'), async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  if (!req.file || typeof req.body?.spec !== 'string') throw new TestCaseCatalogRequestError(400, 'Envie arquivo JSON file e declaração JSON spec.');
  let spec: unknown;
  try { spec = parseImportJson(req.body.spec); }
  catch (error) { throw new TestCaseCatalogRequestError(422, error instanceof Error ? error.message : 'Declaração inválida.'); }
  const filename = req.file.originalname.replaceAll('\\', '/').split('/').at(-1)!;
  res.json(await publishTestCaseCatalog(id, version, req.file.buffer, filename, spec, process.env.INGEST_API_KEY ? 'internal-api' : 'local-development'));
});
testCaseCatalogsRouter.get('/', async (req, res) => {
  const options = z.strictObject({ id: definitionIdentitySchema.shape.id.optional(), state: z.enum(['published', 'retired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await listTestCaseCatalogs(options));
});
testCaseCatalogsRouter.get('/:id/versions/:version', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params); res.json(await loadTestCaseCatalog(id, version));
});
testCaseCatalogsRouter.get('/:id/versions/:version/original', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  const original = await loadTestCaseCatalogOriginal(id, version);
  res.set('Content-Type', 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="catalog-${id}.json"`);
  res.set('X-Content-SHA256', original.sha256); res.send(original.bytes);
});
testCaseCatalogsRouter.post('/:id/versions/:version/retire', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  if (req.body !== undefined && !z.strictObject({}).safeParse(req.body).success) throw new TestCaseCatalogRequestError(400, 'Retirada não aceita alterações de conteúdo.');
  res.json(await retireTestCaseCatalog(id, version));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof TestCaseCatalogRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Catálogo ou parâmetros inválidos.', issues: error.issues }); return; }
  if (error instanceof multer.MulterError) { res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: `Limite de upload: ${error.code}` }); return; }
  next(error);
};
testCaseCatalogsRouter.use(errors);
