// Platform enum
export type Platform = 'xiaohongshu' | 'bilibili' | 'douyin';

// Followed user (Feed subscription — NOT the same as platform follow)
export interface FollowedUser {
  id: string;
  platform: Platform;
  platformUserId: string;
  profile: UserProfile;
  groupId: string | null;
  enabled: boolean;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  nickname: string;
  avatar: string;
  bio?: string;
  followerCount?: number;
}

// Raw post from platform — JSON blob for platform-specific data
export interface RawPost {
  id: string;
  platform: Platform;
  platformPostId: string;
  authorId: string;
  type: PostType;
  data: Record<string, unknown>;
  mediaUrls: string[];
  permalink: string;
  publishedAt: string;
  fetchedAt: string;
}

export type PostType = 'video' | 'image_text' | 'text';

// Media cache entry
export interface MediaCache {
  id: string;
  postId: string;
  originalUrl: string;
  localPath: string | null;
  type: MediaType;
  status: MediaStatus;
  fileSize: number | null;
  createdAt: string;
}

export type MediaType = 'video' | 'audio' | 'image';
export type MediaStatus = 'pending' | 'downloading' | 'done' | 'failed';

// Feed item (AI-processed output, or raw passthrough in MVP)
export interface FeedItem {
  id: string;
  rawPostIds: string[];
  authorId: string;
  type: FeedItemType;
  title: string;
  summary: string;
  transcript: string | null;
  aiTags: string[];
  sourcePlatform: Platform;
  sourceUrls: string[];
  mediaLocalPaths: string[];
  isRead: boolean;
  isSaved: boolean;
  publishedAt: string;
  createdAt: string;
}

export type FeedItemType = 'single' | 'user_digest';

// User group
export interface UserGroup {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

// Settings
export interface AppSettings {
  port: number;
  fetchIntervalMinutes: number;
  llm: LlmConfig;
  whisper: WhisperConfig;
  mediaCacheTtlDays: number;
}

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export interface WhisperConfig {
  provider: string;
  apiKey: string;
  model: string;
}

// Platform adapter interface
export interface PlatformAdapter {
  platform: Platform;
  fetchFollowList(session: SessionTokens): Promise<PlatformUser[]>;
  fetchPosts(userId: string, session: SessionTokens): Promise<RawPost[]>;
}

export interface PlatformUser {
  platformUserId: string;
  profile: UserProfile;
}

export interface SessionTokens {
  cookies: string;
  userAgent: string;
}

// Platform connection status
export interface PlatformStatus {
  platform: Platform;
  status: 'connected' | 'expired' | 'rate_limited' | 'error' | 'disconnected';
  message: string;
}
