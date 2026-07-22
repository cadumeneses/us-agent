import type { Dashboard, Story } from '../domain/models.js';

const pendingStatuses = new Set(['pending_review', 'taxonomy_gap', 'needs_rewrite']);
const acceptedStatuses = new Set(['accepted_auto', 'reviewed']);

export function filterStories(stories: Story[], status = '', search = '', limit = 250): Story[] {
  const term = search.trim().toLowerCase();
  return stories
    .filter(story => !status || story.status === status)
    .filter(story => !term || `${story.text} ${story.module} ${story.operation}`.toLowerCase().includes(term))
    .slice(0, limit);
}

export function buildDashboard(stories: Story[]): Dashboard {
  const moduleCounts = stories.reduce<Record<string, number>>((counts, story) => {
    counts[story.module] = (counts[story.module] ?? 0) + 1;
    return counts;
  }, {});

  return {
    total: stories.length,
    pending: stories.filter(story => pendingStatuses.has(story.status)).length,
    accepted: stories.filter(story => acceptedStatuses.has(story.status)).length,
    confidence: stories.length
      ? stories.reduce((total, story) => total + story.confidence, 0) / stories.length
      : 0,
    modules: Object.entries(moduleCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  };
}
