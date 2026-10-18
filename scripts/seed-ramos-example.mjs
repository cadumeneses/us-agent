// Optional, idempotent teaching example reconstructed from Ramos (2019), tables 5.3–5.7.
// The thesis does not publish a complete project here. These three projects contain
// only the RF profiles shown in its worked example; story text is explanatory.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

if ((process.env.DATABASE_TARGET ?? 'local') !== 'local') {
  throw new Error('Este exemplo só pode ser carregado no banco local.');
}

const connectionString = process.env.DATABASE_URL_LOCAL ?? 'postgresql://us_agent:us_agent_local@localhost:5432/us_agent';
const catalog = JSON.parse(await readFile(new URL('../apps/web/src/data/ramos-nfr-catalog.json', import.meta.url), 'utf8'));
const nfr = index => {
  const item = catalog[index];
  if (!item) throw new Error(`RNF do Apêndice D não encontrado: ${index}`);
  return item;
};
const empty = { languages: [], frameworks: [], apis: [], dataPersistence: [] };
const examples = [
  {
    code: 'fa', project: '[DEMO Ramos 2019] Alvo fa',
    profile: { platforms: ['Web'], applicationDomains: ['Educação'], objective: 'product', architectures: ['Cliente-servidor'],
      technologies: { languages: ['TypeScript'], frameworks: ['Angular'], apis: ['Mongoose'], dataPersistence: ['MongoDB'] } },
    nfrs: []
  },
  {
    code: 'f4', project: '[DEMO Ramos 2019] Histórico f4',
    profile: { platforms: ['Web'], applicationDomains: ['Educação'], objective: 'product', architectures: ['Cliente-servidor'],
      technologies: { languages: ['TypeScript'], frameworks: ['Angular'], apis: ['Mongoose'], dataPersistence: ['MongoDB'] } },
    nfrs: [nfr(2)]
  },
  {
    code: 'f5', project: '[DEMO Ramos 2019] Histórico f5',
    profile: { platforms: ['Web'], applicationDomains: ['Recuperação de informação'], objective: 'product', architectures: ['Camadas'],
      technologies: { languages: ['Python'], frameworks: ['Django'], apis: ['Firebase'], dataPersistence: ['MySQL'] } },
    nfrs: [nfr(3), nfr(6)]
  }
];

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 10000 });
const client = await pool.connect();
let created = 0;
try {
  await client.query('BEGIN');
  const version = await client.query("SELECT version FROM taxonomy_versions WHERE version = '1.0.0'");
  if (!version.rowCount) throw new Error('Execute as migrations antes de carregar o exemplo: taxonomia 1.0.0 ausente.');
  await client.query(`INSERT INTO classification_runs (id, classification_mode, taxonomy_version)
    VALUES ('ramos-2019-published-example', 'published_example', '1.0.0') ON CONFLICT (id) DO NOTHING`);
  for (const example of examples) {
    const project = await client.query('INSERT INTO projects (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [example.project]);
    const projectId = project.rows[0].id;
    const profile = { taxonomyVersion: '1.0.0', ...example.profile };
    await client.query('INSERT INTO project_research_profiles (project_id, content) VALUES ($1, $2::jsonb) ON CONFLICT (project_id) DO NOTHING', [projectId, JSON.stringify(profile)]);
    const sprint = await client.query("INSERT INTO project_sprints (project_id, name) VALUES ($1, 'Backlog') ON CONFLICT (project_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id", [projectId]);
    const story = await client.query(`INSERT INTO stories (project_id, sprint_id, external_id, content)
      VALUES ($1, $2, $3, $4) ON CONFLICT (project_id, external_id) DO UPDATE SET external_id = EXCLUDED.external_id RETURNING id`,
      [projectId, sprint.rows[0].id, `ramos-2019-example-${example.code}`, `Exemplo didático da tese de Ramos (2019): recuperação de dados (${example.code}).`]);
    const inserted = await client.query(`INSERT INTO classifications
      (story_id, run_id, review_status, final_confidence, taxonomy_version, final_decision, final_reason)
      VALUES ($1, 'ramos-2019-published-example', 'reviewed', 1, '1.0.0', 'published_example',
        'Par módulo/operação transcrito das tabelas 5.5–5.7; texto da história reconstruído para demonstração.')
      ON CONFLICT (story_id, run_id) DO NOTHING RETURNING id`, [story.rows[0].id]);
    if (!inserted.rowCount) continue;
    created += 1;
    const classificationId = inserted.rows[0].id;
    await client.query("INSERT INTO classification_labels (classification_id, module, operation, position) VALUES ($1, 'Registry', 'Retrieve data', 0)", [classificationId]);
    for (const [position, label] of ['t6', 't7'].entries()) {
      await client.query('INSERT INTO story_tasks (classification_id, title, category, technologies, position) VALUES ($1, $2, $3, $4::jsonb, $5)',
        [classificationId, `Tarefa ${label} do exemplo da tabela 5.7 (descrição não publicada)`, label, JSON.stringify(empty), position]);
    }
    for (const [position, item] of example.nfrs.entries()) {
      await client.query('INSERT INTO story_non_functional_requirements (classification_id, description, nfr_type, metric, position) VALUES ($1, $2, $3, $4, $5)',
        [classificationId, item.sentence, item.type, item.attribute, position]);
    }
  }
  await client.query('COMMIT');
  console.log(`Exemplo Ramos 2019 pronto no banco local: ${created} classificação(ões) nova(s); fa, f4 e f5 disponíveis.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
