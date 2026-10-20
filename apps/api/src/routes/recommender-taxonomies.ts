import { currentActor } from '../security/request-context.js';
import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { taxonomyIdSchema, taxonomyVersionSchema } from '../domain/recommender-taxonomy.js';
import { loadTaxonomyVersion, listTaxonomyVersions, publishTaxonomyVersion, retireTaxonomyVersion, saveTaxonomyDraft, TaxonomyRequestError } from '../services/recommender-taxonomies.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';

export const recommenderTaxonomiesRouter = Router();
recommenderTaxonomiesRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const pathSchema = z.strictObject({ id: taxonomyIdSchema, version: taxonomyVersionSchema });
const actor = () => currentActor();

recommenderTaxonomiesRouter.get('/', async (req, res) => {
  const options = z.strictObject({ id: taxonomyIdSchema.optional(), state: z.enum(['draft', 'published', 'retired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await listTaxonomyVersions(options));
});
recommenderTaxonomiesRouter.get('/:id/versions/:version', async (req, res) => {
  const { id, version } = pathSchema.parse(req.params);
  res.json(await loadTaxonomyVersion(id, version));
});
recommenderTaxonomiesRouter.put('/:id/versions/:version', async (req, res) => {
  const { id, version } = pathSchema.parse(req.params);
  if (req.body?.id !== id || req.body?.version !== version) throw new TaxonomyRequestError(400, 'ID e versão do conteúdo devem corresponder ao caminho.');
  res.json(await saveTaxonomyDraft(req.body, actor()));
});
recommenderTaxonomiesRouter.post('/:id/versions/:version/publish', async (req, res) => {
  const { id, version } = pathSchema.parse(req.params);
  const body = z.strictObject({ expectedDraftSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).safeParse(req.body === undefined ? {} : req.body);
  if (!body.success) throw new TaxonomyRequestError(400, 'Publicação aceita apenas o hash esperado do rascunho salvo.');
  res.json(await publishTaxonomyVersion(id, version, actor(), body.data.expectedDraftSha256));
});
recommenderTaxonomiesRouter.post('/:id/versions/:version/retire', async (req, res) => {
  const { id, version } = pathSchema.parse(req.params);
  if (req.body !== undefined && (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
    throw new TaxonomyRequestError(400, 'Retirada não aceita alterações de conteúdo.');
  }
  res.json(await retireTaxonomyVersion(id, version));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof TaxonomyRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Taxonomia ou parâmetros inválidos.', issues: error.issues }); return; }
  next(error);
};
recommenderTaxonomiesRouter.use(errors);
