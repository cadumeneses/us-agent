import { nfrRouter } from './nfr.js';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { addTaxonomyDomain, addTaxonomyOperation, applyFallbackSuggestion, assignStoriesToSprint, createProject, createProjectSprint, createTaxonomyVersion, loadProjects, loadProjectSprints, loadReviewContext, loadStories, loadTaxonomy, updateProjectSprintStatus } from '../repositories/data-repository.js';
import { classifyPreview, parseImportedStories } from '../services/classifier.js';
import { classifyWithAi, ClassificationConfigurationError } from '../services/ai-classifier.js';
import { buildDashboard, filterStories } from '../services/stories.js';
import { query, withTransaction } from '../database/pool.js';
import { isExecutionModeActive, loadApplicationContext } from '../repositories/application-repository.js';
import { applySavedTaxonomyFeedback, savePreviewClassifications, saveReview, saveTaxonomyFeedback, ReviewValidationError } from '../services/classification-store.js';
import { importRecord, type HistoricalResult } from '../database/import-jsonl.js';
import { loadStoryDetails, saveStoryDetails } from '../services/story-details.js';
import { technologiesSchema, projectResearchProfileSchema, loadProjectResearchProfile, saveProjectResearchProfile } from '../services/research-inputs.js';
import { isAuthorizedInternalRequest } from './internal-authorization.js';
import { recommenderTaxonomiesRouter } from './recommender-taxonomies.js';
import { recommenderDefinitionsRouter } from './recommender-definitions.js';
import { recommenderDatasetsRouter } from './recommender-datasets.js';
import { recommendationRunsRouter } from './recommendation-runs.js';
import { testCaseCatalogsRouter } from './test-case-catalogs.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 }
});

const classifyRequest = z.object({
  stories: z.array(z.string().min(10)).min(1).max(100),
  project: z.string().trim().min(1).max(160).default('Web'),
  sprint: z.string().trim().min(1).max(120).default('Backlog'),
  mode: z.enum(['preview', 'committee']).default('committee'),
  taxonomyVersion: z.string().trim().min(1).max(40).optional()
});

const taxonomyFeedbackRequest = z.object({
  proposalType: z.enum(['new_domain', 'new_module', 'new_operation', 'clarify_story']),
  proposedDomain: z.string().trim().min(2).max(120).optional(),
  targetDomain: z.string().trim().min(2).max(120).optional(),
  proposedModule: z.string().trim().min(2).max(120).optional(),
  targetModule: z.string().trim().min(2).max(120).optional(),
  proposedOperation: z.string().trim().min(2).max(180).optional(),
  justification: z.string().trim().min(5).max(2_000)
}).superRefine((feedback, context) => {
  if (feedback.proposalType === 'new_domain' && !feedback.proposedDomain) {
    context.addIssue({ code: 'custom', path: ['proposedDomain'], message: 'Enter the proposed domain.' });
  }
  if (feedback.proposalType === 'new_module' && (!feedback.targetDomain || !feedback.proposedModule)) {
    context.addIssue({ code: 'custom', message: 'Enter the target domain and proposed module.' });
  }
  if (feedback.proposalType === 'new_operation' && (!feedback.targetDomain || !feedback.targetModule || !feedback.proposedOperation)) {
    context.addIssue({ code: 'custom', message: 'Enter the domain, target module, and proposed operation.' });
  }
});

const reviewLabel = z.object({
  module: z.string().trim().min(1).max(120).refine(value => value !== 'n/a', 'Selecione um módulo da taxonomia.'),
  operation: z.string().trim().min(1).max(180).refine(value => value !== 'n/a', 'Selecione uma operação da taxonomia.')
});
const reviewRequest = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    labels: z.array(reviewLabel).min(1).max(8).optional(),
    module: reviewLabel.shape.module.optional(),
    operation: reviewLabel.shape.operation.optional(),
    notes: z.string().trim().max(2_000).optional()
  }).superRefine((input, context) => {
    if (!input.labels && (!input.module || !input.operation)) context.addIssue({ code: 'custom', message: 'Envie a lista de pares ou um par completo.' });
    if (input.labels && (input.module !== undefined || input.operation !== undefined)) context.addIssue({ code: 'custom', message: 'Use labels ou o par legado, sem misturá-los.' });
  }),
  z.object({
    action: z.literal('taxonomy_gap'),
    notes: z.string().trim().max(2_000).optional()
  })
]);

const ingestionRequest = z.object({
  user_story: z.string().min(1),
  project: z.string().min(1).max(160),
  story_id: z.string().min(1).max(80),
  run_id: z.string().min(1).max(80),
  review_status: z.string().min(1).max(40),
  final: z.object({
    final_rows: z.array(z.object({ module: z.string(), operation: z.string() })),
    final_confidence: z.number().min(0).max(1)
  }).passthrough(),
  uncertainty: z.object({
    uncertainty_score: z.number().min(0).max(1),
    consensus_ratio: z.number().min(0).max(1)
  }).passthrough()
}).passthrough();

const sprintCreateRequest = z.object({
  project: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(120),
  status: z.enum(['planning', 'active', 'completed']).default('planning')
});
const sprintStatusRequest = z.object({ status: z.enum(['planning', 'active', 'completed']) });
const sprintStoriesRequest = z.object({ classificationIds: z.array(z.string().regex(/^\d+$/)).min(1).max(500) });
const storyDetailsRequest = z.object({
  tasks: z.array(z.object({ id: z.string().optional(), title: z.string().trim().min(1).max(500), done: z.boolean(), category: z.string().trim().max(160).optional(), technologies: technologiesSchema.optional() })).max(100),
  functionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000) })).max(100),
  nonFunctionalRequirements: z.array(z.object({ id: z.string().optional(), description: z.string().trim().min(1).max(1000), type: z.string().trim().min(1).max(80), metric: z.string().trim().min(1).max(120) })).max(100)
});
const taxonomyOperationRequest = z.object({ domain: z.string().trim().min(2).max(120).optional(), module: z.string().trim().min(2).max(120), operation: z.string().trim().min(2).max(180), description: z.string().trim().min(5).max(1000), version: z.string().trim().min(1).max(40).optional() });
const taxonomyDomainRequest = z.object({ domain: z.string().trim().min(2).max(120), description: z.string().trim().min(5).max(1000), version: z.string().trim().min(1).max(40).optional() });
const taxonomyVersionRequest = z.object({ version: z.string().trim().min(1).max(40) });

export const apiRouter = Router();
apiRouter.use(nfrRouter);
apiRouter.use('/internal/recommender-taxonomies', recommenderTaxonomiesRouter);
apiRouter.use('/internal/recommender-definitions', recommenderDefinitionsRouter);
apiRouter.use('/internal/recommender-datasets', recommenderDatasetsRouter);
apiRouter.use('/internal/recommendation-runs', recommendationRunsRouter);
apiRouter.use('/internal/test-case-catalogs', testCaseCatalogsRouter);

apiRouter.get('/projects', async (_req, res) => { res.json(await loadProjects()); });
apiRouter.post('/projects', async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(160) }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Enter a project name between 2 and 160 characters.' });
  try { res.status(201).json({ name: await createProject(parsed.data.name) }); }
  catch (reason) {
    if ((reason as { code?: string }).code === '23505') return void res.status(409).json({ error: 'A project with this name already exists.' });
    throw reason;
  }
});

apiRouter.get('/project-research-profile', async (req, res) => {
  const name = z.string().trim().min(1).max(160).safeParse(req.query.project);
  if (!name.success) return void res.status(400).json({ error: 'Enter a project.' });
  const profile = await loadProjectResearchProfile(name.data);
  if (!profile) return void res.status(404).json({ error: 'Project not found.' });
  res.json(profile);
});

apiRouter.put('/project-research-profile', async (req, res) => {
  const name = z.string().trim().min(1).max(160).safeParse(req.query.project);
  const parsed = projectResearchProfileSchema.safeParse(req.body);
  if (!name.success || !parsed.success) return void res.status(400).json({ error: 'Invalid project profile.' });
  if (parsed.data.taxonomyVersion) {
    const version = await loadTaxonomy(parsed.data.taxonomyVersion);
    if (version.version !== parsed.data.taxonomyVersion || !Object.values(version.modules).some(operations => operations.length)) return void res.status(400).json({ error: 'Select an active taxonomy with operations for the project.' });
  }
  if (!await saveProjectResearchProfile(name.data, parsed.data)) return void res.status(404).json({ error: 'Project not found.' });
  res.json(parsed.data);
});

apiRouter.get('/health', async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', service: 'us-agent-api', database: 'connected' });
});

apiRouter.get('/taxonomy', async (req, res) => {
  res.json(await loadTaxonomy(typeof req.query.version === 'string' ? req.query.version : undefined));
});

apiRouter.get('/context', async (_req, res) => {
  res.json(await loadApplicationContext());
});

apiRouter.get('/stories', async (req, res) => {
  const stories = await loadStories();
  const requestedLimit = Number(req.query.limit ?? 250);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10_000) : 250;
  res.json(filterStories(stories, String(req.query.status ?? ''), String(req.query.search ?? ''), limit));
});

apiRouter.get('/dashboard', async (_req, res) => {
  res.json(buildDashboard(await loadStories()));
});

apiRouter.get('/sprints', async (_req, res) => {
  res.json(await loadProjectSprints());
});

apiRouter.post('/sprints', async (req, res) => {
  const parsed = sprintCreateRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Enter a valid project, name, and sprint status.' });
  try {
    const sprint = await createProjectSprint(parsed.data);
    if (!sprint) return void res.status(404).json({ error: 'Project not found.' });
    res.status(201).json(sprint);
  } catch (reason) {
    if ((reason as { code?: string }).code === '23505') return void res.status(409).json({ error: 'A sprint with this name already exists in the project.' });
    throw reason;
  }
});

apiRouter.patch('/sprints/:id/status', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid sprint identifier.' });
  const parsed = sprintStatusRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid sprint status.' });
  const sprint = await updateProjectSprintStatus(req.params.id, parsed.data.status);
  if (!sprint) return void res.status(404).json({ error: 'Sprint not found.' });
  res.json(sprint);
});

apiRouter.put('/sprints/:id/stories', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid sprint identifier.' });
  const parsed = sprintStoriesRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Select at least one user story.' });
  try {
    const changed = await assignStoriesToSprint(req.params.id, parsed.data.classificationIds);
    if (!changed) return void res.status(404).json({ error: 'Sprint not found.' });
    res.json({ sprintId: req.params.id, classificationIds: parsed.data.classificationIds });
  } catch (reason) {
    res.status(400).json({ error: (reason as Error).message });
  }
});

apiRouter.post('/taxonomy/operations', async (req, res) => { const parsed = taxonomyOperationRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Invalid operation data.' }); await addTaxonomyOperation(parsed.data); res.status(201).json(await loadTaxonomy()); });
apiRouter.post('/taxonomy/domains', async (req, res) => { const parsed = taxonomyDomainRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Invalid domain data.' }); await addTaxonomyDomain(parsed.data); res.status(201).json(await loadTaxonomy()); });
apiRouter.post('/taxonomy/versions', async (req, res) => { const parsed = taxonomyVersionRequest.safeParse(req.body); if (!parsed.success) return void res.status(400).json({ error: 'Invalid version.' }); await createTaxonomyVersion(parsed.data.version); res.status(201).json(await loadTaxonomy()); });

apiRouter.post('/taxonomy/fallback-suggestions/:id/apply', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid suggestion identifier.' });
  const result = await applyFallbackSuggestion(req.params.id);
  if (!result) return void res.status(404).json({ error: 'Fallback suggestion not found.' });
  if (result.status === 'applied' || result.status === 'already_applied') {
    return void res.json({ status: result.status, taxonomy: await loadTaxonomy() });
  }
  const messages = {
      not_actionable: 'This suggestion does not represent a domain or operation that can be added.',
      target_domain_not_found: 'The suggestion target domain does not exist in the active taxonomy.',
      target_module_not_found: 'The suggested operation target module does not exist in the active taxonomy.',
    no_active_taxonomy: 'No active taxonomy was found.'
  };
  res.status(422).json({ error: messages[result.status] });
});

apiRouter.get('/classifications/:id/details', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid classification identifier.' });
  res.json(await loadStoryDetails(req.params.id));
});
apiRouter.get('/classifications/:id/review-context', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid classification identifier.' });
  const context = await loadReviewContext(req.params.id);
  if (!context) return void res.status(404).json({ error: 'Classification not found.' });
  res.json(context);
});
apiRouter.post('/classifications/:id/taxonomy-feedback', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid classification identifier.' });
  const parsed = taxonomyFeedbackRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid taxonomy proposal data.', details: parsed.error.issues });
  let saved;
  try {
    saved = await saveTaxonomyFeedback(req.params.id, parsed.data);
  } catch (reason) {
    return void res.status(422).json({ error: (reason as Error).message });
  }
  if (!saved) return void res.status(404).json({ error: 'Classification not found.' });
  res.status(201).json({ ...saved, taxonomy: await loadTaxonomy() });
});
apiRouter.post('/taxonomy/feedback/:id/apply', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid proposal identifier.' });
  let result;
  try {
    result = await applySavedTaxonomyFeedback(req.params.id);
  } catch (reason) {
    return void res.status(422).json({ error: (reason as Error).message });
  }
  if (!result) return void res.status(404).json({ error: 'Taxonomy proposal not found.' });
  if (result.status === 'not_actionable') return void res.status(422).json({ error: 'Clarification requests do not change the taxonomy.' });
  res.json({ status: result.status, taxonomy: await loadTaxonomy() });
});
apiRouter.put('/classifications/:id/details', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return void res.status(400).json({ error: 'Invalid classification identifier.' });
  const parsed = storyDetailsRequest.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Invalid story details.', details: parsed.error.issues });
  if (!await saveStoryDetails(req.params.id, parsed.data)) return void res.status(404).json({ error: 'Story not found.' });
  res.json(await loadStoryDetails(req.params.id));
});

apiRouter.post('/classify', async (req, res) => {
  const parsed = classifyRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Submit between 1 and 100 valid stories.',
      details: parsed.error.issues
    });
    return;
  }

  if (!await isExecutionModeActive(parsed.data.mode)) {
    res.status(400).json({ error: 'The selected classification mode is unavailable.' });
    return;
  }

  const profile = await loadProjectResearchProfile(parsed.data.project);
  const catalog = await loadTaxonomy();
  const activeVersions = (catalog.taxonomies ?? []).filter(item => item.active && item.operations > 0);
  const taxonomyVersion = parsed.data.taxonomyVersion || profile?.taxonomyVersion || (activeVersions.length === 1 ? activeVersions[0].version : '');
  if (!taxonomyVersion) return void res.status(400).json({ error: 'Select the taxonomy to use for these stories.' });
  const taxonomy = await loadTaxonomy(taxonomyVersion);
  if (taxonomy.version !== taxonomyVersion || !Object.values(taxonomy.modules).some(operations => operations.length)) {
    return void res.status(400).json({ error: 'The selected taxonomy is inactive or has no operations.' });
  }
  let previews;
  try {
    previews = parsed.data.mode === 'preview'
      ? parsed.data.stories.map(text => ({ text, ...classifyPreview(text, taxonomy) }))
      : await Promise.all(parsed.data.stories.map(async text => ({ text, ...await classifyWithAi(text, taxonomy) })));
  } catch (reason) {
    if (reason instanceof ClassificationConfigurationError) return void res.status(422).json({ error: reason.message });
    throw reason;
  }
  res.status(201).json(await savePreviewClassifications(parsed.data.project, parsed.data.sprint, previews, taxonomyVersion, parsed.data.mode));
});

apiRouter.patch('/classifications/:id/review', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: 'Invalid classification identifier.' });
    return;
  }
  const parsed = reviewRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid review data.', details: parsed.error.issues });
    return;
  }
  let result;
  try {
    result = await saveReview({ classificationId: req.params.id, ...parsed.data });
  } catch (reason) {
    if (reason instanceof ReviewValidationError) return void res.status(422).json({ error: reason.message });
    throw reason;
  }
  if (!result) {
    res.status(404).json({ error: 'Classification not found.' });
    return;
  }
  if ('notReviewable' in result) {
    res.status(409).json({ error: `The classification is already in the ${result.status}.` });
    return;
  }
  res.json(result);
});

apiRouter.post('/internal/classifications', async (req, res) => {
  if (!isAuthorizedInternalRequest(req, res)) return;
  const parsed = ingestionRequest.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid classification result.', details: parsed.error.issues });
    return;
  }
  const classificationId = await withTransaction(client =>
    importRecord(client, parsed.data as HistoricalResult, 0)
  );
  res.status(201).json({ id: classificationId });
});

apiRouter.post('/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file was provided.' });
    return;
  }

  res.json({
    filename: req.file.originalname,
    stories: parseImportedStories(req.file.buffer.toString('utf8'))
  });
});
