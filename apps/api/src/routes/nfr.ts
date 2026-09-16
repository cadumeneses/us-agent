import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { createNfrRun, decideNfr, listNfrRuns, nfrContext, NfrRequestError } from '../services/nfr-recommendations.js';

export const nfrRouter = Router();
const idSchema = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => /^\d+$/.test(value) && BigInt(value) <= 9223372036854775807n);
function id(value: unknown) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new NfrRequestError(400, 'Identificador inválido.');
  return parsed.data;
}
nfrRouter.get('/classifications/:id/nfr-context', async (req, res) => {
  res.json(await nfrContext(id(req.params.id)));
});
nfrRouter.get('/classifications/:id/nfr-runs', async (req, res) => {
  res.json(await listNfrRuns(id(req.params.id)));
});
nfrRouter.post('/classifications/:id/nfr-runs', async (req, res) => {
  const parsed = z.object({ labelIndex: z.number().int().min(0).max(99) }).safeParse(req.body);
  if (!parsed.success) throw new NfrRequestError(400, 'Selecione o par módulo/operação da classificação.');
  res.status(201).json(await createNfrRun(id(req.params.id), parsed.data.labelIndex));
});
nfrRouter.post('/nfr-runs/:id/decisions', async (req, res) => {
  const parsed = z.object({ itemKey: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(['accepted', 'rejected']) }).safeParse(req.body);
  if (!parsed.success) throw new NfrRequestError(400, 'Avaliação de RNF inválida.');
  res.json(await decideNfr(id(req.params.id), parsed.data.itemKey, parsed.data.decision));
});
const errors: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof NfrRequestError) { res.status(error.status).json({ error: error.message }); return; }
  next(error);
};
nfrRouter.use(errors);
