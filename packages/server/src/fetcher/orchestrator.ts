import { FollowedUser, SessionTokens, RawPost } from '@agent-feeds/shared';
import { insertPosts } from '../db/repositories/posts';
import { updateUser } from '../db/repositories/users';
import { downloadMediaForPosts } from '../downloader/manager';
import { summarizePost } from '../summarizer/single';

interface AdapterMap {
  [platform: string]: { fetchPosts(userId: string, session: SessionTokens): Promise<RawPost[]> };
}

const adapters: AdapterMap = {};

export function registerAdapter(platform: string, adapter: any): void {
  adapters[platform] = adapter;
}

export async function fetchForUser(user: FollowedUser, session: SessionTokens): Promise<void> {
  const adapter = adapters[user.platform];
  if (!adapter) {
    console.warn(`No adapter for platform: ${user.platform}`);
    return;
  }

  const rawPosts = await adapter.fetchPosts(user.platformUserId, session);
  if (rawPosts.length === 0) {
    await updateUser(user.id, { lastFetchedAt: new Date().toISOString() });
    return;
  }

  await insertPosts(rawPosts);
  await downloadMediaForPosts(rawPosts);

  // Summarize each post → feed_item
  for (const post of rawPosts) {
    try {
      await summarizePost(post);
    } catch (err: any) {
      if (err.status === 401) throw err; // User-recoverable, bubble up
      if (err.status === 429) throw err; // Rate limit, let scheduler handle
      console.error(`Summarize failed for post ${post.id}:`, err.message);
    }
  }

  await updateUser(user.id, { lastFetchedAt: new Date().toISOString() });
}
