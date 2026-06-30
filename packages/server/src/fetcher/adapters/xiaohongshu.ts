import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';

export const xiaohongshuAdapter: PlatformAdapter = {
  platform: 'xiaohongshu',

  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    // TODO: Research xiaohongshu follow list API / scraping strategy
    // Likely approach: intercept mobile API /notes API via extension content script
    return [];
  },

  async fetchPosts(_userId: string, _session: SessionTokens): Promise<RawPost[]> {
    // TODO: Research xiaohongshu post list endpoint
    // Likely approach: content script intercepts /api/sns/web/v1/user_posted endpoint
    return [];
  },
};
