import { RawPost } from '@agent-feeds/shared';

export async function transcribePost(post: RawPost): Promise<string | null> {
  return (post.data as any).body_text || (post.data as any).desc || null;
}

export async function transcribePending(): Promise<void> {
  // MVP: no batch processing needed
}
