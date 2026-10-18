import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { definitionIdentitySchema } from '../domain/recommender-definition.js';
import { loadDefinitionVersion, listDefinitionVersions, publishDefinitionVersion, retireDefinitionVersion, saveDefinitionDraft, DefinitionRequestError } from '../services/recommender-definitions.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';

export const recommenderDefinitionsRouter = Router();
recommenderDefinitionsRouter.use((req, res, next) => { if (isAuthorizedInternalRequest(req, res)) next(); });
const actor = () => process.env.INGEST_API_KEY ? 'internal-api' : 'local-development';
const noContent = (body: unknown) => body === undefined || z.strictObject({}).safeParse(body).success;

recommenderDefinitionsRouter.get('/', async (req, res) => {
  const options = z.strictObject({ id: definitionIdentitySchema.shape.id.optional(), state: z.enum(['draft', 'published', 'retired']).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
  res.json(await listDefinitionVersions(options));
});
recommenderDefinitionsRouter.get('/:id/versions/:version', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  res.json(await loadDefinitionVersion(id, version));
});
recommenderDefinitionsRouter.put('/:id/versions/:version', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  if (req.body?.id !== id || req.body?.version !== version) throw new DefinitionRequestError(400, 'ID e versão da definição devem corresponder ao caminho.');
  res.json(await saveDefinitionDraft(req.body, actor()));
});
recommenderDefinitionsRouter.post('/:id/versions/:version/publish', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  const body = z.strictObject({ expectedDraftSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).safeParse(req.body === undefined ? {} : req.body);
  if (!body.success) throw new DefinitionRequestError(400, 'Publicação aceita apenas o hash esperado do rascunho salvo.');
  res.json(await publishDefinitionVersion(id, version, actor(), body.data.expectedDraftSha256));
});
recommenderDefinitionsRouter.post('/:id/versions/:version/retire', async (req, res) => {
  const { id, version } = definitionIdentitySchema.parse(req.params);
  if (!noContent(req.body)) throw new DefinitionRequestError(400, 'Retirada não aceita alterações de conteúdo.');
  res.json(await retireDefinitionVersion(id, version));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof DefinitionRequestError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Definição ou parâmetros inválidos.', issues: error.issues }); return; }
  next(error);
};
recommenderDefinitionsRouter.use(errors);
