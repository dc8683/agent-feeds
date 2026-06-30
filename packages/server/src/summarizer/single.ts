import { RawPost, FeedItem } from '@agent-feeds/shared';
import { v4 as uuid } from 'uuid';
import { insertFeedItem } from '../db/repositories/feed';
import { transcribePost } from '../transcriber/whisper';

export async function summarizePost(post: RawPost): Promise<FeedItem> {
  const transcript = await transcribePost(post);
  const text = transcript || '';

  const feedItem: FeedItem = {
    id: uuid(),
    rawPostIds: [post.id],
    authorId: post.authorId,
    type: 'single',
    title: (post.data as any).title || text.slice(0, 50),
    summary: text.slice(0, 300),
    transcript,
    aiTags: [],
    sourcePlatform: post.platform,
    sourceUrls: [post.permalink],
    mediaLocalPaths: [],
    isRead: false,
    isSaved: false,
    publishedAt: post.publishedAt,
    createdAt: new Date().toISOString(),
  };

  await insertFeedItem(feedItem);
  return feedItem;
}

export async function summarizePending(): Promise<void> {
  // MVP: called by pipeline, no batch processing
}
