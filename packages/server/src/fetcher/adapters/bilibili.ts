import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';

export const bilibiliAdapter: PlatformAdapter = {
  platform: 'bilibili',

  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    return [];
  },

  async fetchPosts(_userId: string, _session: SessionTokens): Promise<RawPost[]> {
    return [];
  },
};
