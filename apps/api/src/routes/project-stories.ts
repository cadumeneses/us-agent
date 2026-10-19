import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { createPreparedStory, loadProjectStory, listProjectStories, projectStoryCounts, savePreparedStory, StoryPreparationError, preparedDetailsSchema } from '../services/story-preparation.js';
import { classifyPreview } from '../services/classifier.js';
import { classifyWithAi, ClassificationConfigurationError } from '../services/ai-classifier.js';
import { savePreviewClassifications } from '../services/classification-store.js';
import { isExecutionModeActive } from '../repositories/application-repository.js';
import { loadTaxonomy } from '../repositories/data-repository.js';
import { loadDefinitionVersion, DefinitionRequestError } from '../services/recommender-definitions.js';
import { nfrContext, NfrRequestError } from '../services/nfr-recommendations.js';
import { legacyNfrInput } from '../services/configured-nfr.js';
import { query } from '../database/pool.js';

export const projectStoriesRouter = Router();
const id = z.string().regex(/^[1-9]\d{0,18}$/).refine(value => BigInt(value) <= 9223372036854775807n);
const revision = z.number().int().min(0).max(2147483646);
const target = z.object({ revision, classificationId: id.nullable() });

projectStoriesRouter.get('/project-story-counts',async(_req,res)=>res.json(await projectStoryCounts()));

projectStoriesRouter.get('/project-stories', async (req,res) => {
  const project = z.string().trim().min(1).max(160).parse(req.query.project);
  res.json(await listProjectStories(project));
});
projectStoriesRouter.post('/project-stories', async (req,res) => {
  const body = z.strictObject({ project: z.string().trim().min(1).max(160), sprint: z.string().trim().min(1).max(120),
    text: z.string().trim().min(10).max(20000), requestId: z.uuid() }).parse(req.body);
  res.status(201).json(await createPreparedStory(body));
});
projectStoriesRouter.get('/project-stories/:id', async (req,res) => res.json(await loadProjectStory(id.parse(req.params.id))));
projectStoriesRouter.put('/project-stories/:id', async (req,res) => {
  const body = z.strictObject({ ...target.shape, text: z.string().trim().min(10).max(20000), details: preparedDetailsSchema }).parse(req.body);
  res.json(await savePreparedStory({ storyId: id.parse(req.params.id), revision: body.revision, classificationId: body.classificationId }, body.text, body.details));
});
projectStoriesRouter.post('/project-stories/:id/classify', async (req,res) => {
  const body = z.strictObject({ ...target.shape, mode: z.enum(['preview','committee']), taxonomyVersion: z.string().trim().min(1).max(40) }).parse(req.body);
  const story = await loadProjectStory(id.parse(req.params.id));
  if (story.revision !== body.revision || story.classificationId !== body.classificationId) throw new StoryPreparationError(409, 'This story changed. Reload it before classifying.');
  if (!await isExecutionModeActive(body.mode)) throw new StoryPreparationError(400, 'The selected classification mode is unavailable.');
  const taxonomy = await loadTaxonomy(body.taxonomyVersion);
  if (taxonomy.version !== body.taxonomyVersion || !Object.values(taxonomy.modules).some(operations => operations.length)) throw new StoryPreparationError(400, 'Select an active taxonomy with operations.');
  const preview = body.mode === 'preview' ? classifyPreview(story.text, taxonomy) : await classifyWithAi(story.text, taxonomy);
  res.status(201).json(await savePreviewClassifications(story.project,story.sprint,[{ text: story.text,...preview }],body.taxonomyVersion,body.mode,
    { storyId: story.storyId, revision: body.revision, classificationId: body.classificationId }));
});

// Use the existing, versioned RNF bridge rather than another client-side mapping.
projectStoriesRouter.post('/classifications/:id/published-recommender-input', async (req,res) => {
  const reference = z.strictObject({ id: z.string().min(1).max(80), version: z.string().min(1).max(80),
    format: z.literal('us-agent-json-v1'), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
  const record = await loadDefinitionVersion(reference.id,reference.version);
  if (record.state !== 'published' || !record.snapshot || record.snapshot.sha256 !== reference.sha256 || record.snapshot.format !== reference.format) throw new StoryPreparationError(409, 'Select an available published recommender version.');
  const context = await nfrContext(id.parse(req.params.id));
  const status = (await query<{ review_status: string }>('SELECT review_status FROM classifications WHERE id=$1', [req.params.id])).rows[0]?.review_status;
  if (!status || !['accepted_auto','reviewed','reclassified'].includes(status)) throw new StoryPreparationError(422, 'Complete the classification review before recommending.');
  try {
    // The existing input bridge takes a draft contract. Project a detached copy;
    // the selected publication, its hash and its execution state remain unchanged.
    res.json(legacyNfrInput({ ...record.snapshot.content.definition,state:'draft' },{ ...context.target,reviewStatus: status },context.target.storyId,
      `Project ${context.target.project}; classification ${context.target.classificationId}; editable input for this run`,record.snapshot.content.taxonomies));
  } catch { throw new StoryPreparationError(422, 'The saved project values do not match this recommender. Review its required fields and taxonomy mapping.'); }
});
const errors: ErrorRequestHandler = (error,_req,res,next) => {
  if (error instanceof StoryPreparationError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof DefinitionRequestError || error instanceof NfrRequestError) { res.status(error.status).json({ error: error.status===404?'Story or published recommender not found.':'The selected project input or recommender is unavailable. Reload the current versions.' }); return; }
  if (error instanceof z.ZodError) { res.status(422).json({ error: 'Invalid story data.', issues: error.issues }); return; }
  if (error instanceof ClassificationConfigurationError) { res.status(422).json({ error: error.message }); return; }
  next(error);
};
projectStoriesRouter.use(errors);
