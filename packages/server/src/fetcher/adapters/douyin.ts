import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';

export const douyinAdapter: PlatformAdapter = {
  platform: 'douyin',

  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    return [];
  },

  async fetchPosts(_userId: string, _session: SessionTokens): Promise<RawPost[]> {
    return [];
  },
};
