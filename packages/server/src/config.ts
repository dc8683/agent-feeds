import { AppSettings } from '@agent-feeds/shared';
import { getSetting, setSetting } from './db/repositories/settings';
import { runMigrations } from './db/migrate';

export async function loadConfig(): Promise<AppSettings> {
  runMigrations();

  return {
    port: parseInt(await getSettingWithDefault('server_port', '58797')),
    fetchIntervalMinutes: parseInt(await getSettingWithDefault('fetch_interval_minutes', '30')),
    llm: {
      provider: await getSettingWithDefault('llm_provider', 'deepseek'),
      apiKey: await getSettingWithDefault('llm_api_key', ''),
      model: await getSettingWithDefault('llm_model', 'deepseek-chat'),
    },
    whisper: {
      provider: await getSettingWithDefault('whisper_provider', 'openai'),
      apiKey: await getSettingWithDefault('whisper_api_key', ''),
      model: await getSettingWithDefault('whisper_model', 'whisper-1'),
    },
    mediaCacheTtlDays: parseInt(await getSettingWithDefault('media_cache_ttl_days', '7')),
  };
}

async function getSettingWithDefault(key: string, defaultVal: string): Promise<string> {
  const val = await getSetting(key);
  if (val === null) {
    await setSetting(key, defaultVal);
    return defaultVal;
  }
  return val;
}
