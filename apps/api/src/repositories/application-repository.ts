import { query } from '../database/pool.js';

export type ApplicationContext = {
  user: { id: string; displayName: string; initials: string; role: string };
  environment: string;
  defaultExecutionMode: string;
  executionModes: Array<{ key: string; name: string; description: string }>;
};

export async function loadApplicationContext(): Promise<ApplicationContext> {
  const settings = await query<{
    user_id: string;
    display_name: string;
    initials: string;
    role: string;
    environment_name: string;
    default_execution_mode_key: string;
  }>(`
    SELECT
      user_account.id::text AS user_id,
      user_account.display_name,
      user_account.initials,
      user_account.role,
      settings.environment_name,
      settings.default_execution_mode_key
    FROM application_settings settings
    JOIN app_users user_account ON user_account.id = settings.default_user_id
    WHERE settings.singleton
  `);
  if (!settings.rows[0]) throw new Error('Configurações da aplicação não foram inicializadas.');

  const modes = await query<{ key: string; name: string; description: string }>(`
    SELECT key, name, description
    FROM execution_modes
    WHERE is_active
    ORDER BY position, key
  `);
  const row = settings.rows[0];
  return {
    user: { id: row.user_id, displayName: row.display_name, initials: row.initials, role: row.role },
    environment: row.environment_name,
    defaultExecutionMode: row.default_execution_mode_key,
    executionModes: modes.rows
  };
}

export async function isExecutionModeActive(key: string): Promise<boolean> {
  const result = await query('SELECT 1 FROM execution_modes WHERE key = $1 AND is_active', [key]);
  return Boolean(result.rowCount);
}
