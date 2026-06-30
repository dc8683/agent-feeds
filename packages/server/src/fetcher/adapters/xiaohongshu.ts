import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';

/**
 * 小红书 adapter.
 *
 * Data flow: Server queues profile URL → Extension polls & opens tab →
 * Content script scrapes DOM → pushes notes to /api/extension/data →
 * Server creates RawPost + FeedItem.
 *
 * fetchPosts() returns [] because the actual fetch is extension-driven,
 * not server-driven.
 */
export const xiaohongshuAdapter: PlatformAdapter = {
  platform: 'xiaohongshu',

  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    return [];
  },

  async fetchPosts(_userId: string, _session: SessionTokens): Promise<RawPost[]> {
    // Extension-driven: content script scrapes and pushes data.
    // Server-side fetchPosts is a no-op.
    return [];
  },
};
