import { PlatformAdapter, PlatformUser, RawPost, SessionTokens } from '@agent-feeds/shared';
import { spawn } from 'child_process';
import path from 'path';

const XHS_HOST = 'https://www.xiaohongshu.com';

function runScraper(url: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'xhs-scraper.py');
    const proc = spawn('uv', ['run', 'python3', scriptPath, url], {
      cwd: path.join(__dirname, '../../..'),
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[xhs-scraper] Exit code:', code, stderr);
        resolve([]);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        console.error('[xhs-scraper] Parse error:', stdout.slice(0, 200));
        resolve([]);
      }
    });

    proc.on('error', (err) => {
      console.error('[xhs-scraper] Spawn error:', err.message);
      resolve([]);
    });
  });
}

export const xiaohongshuAdapter: PlatformAdapter = {
  platform: 'xiaohongshu',

  async fetchFollowList(_session: SessionTokens): Promise<PlatformUser[]> {
    // 小红书网页版无关注列表，需用户手动输入博主主页 URL
    return [];
  },

  async fetchPosts(userId: string, _session: SessionTokens): Promise<RawPost[]> {
    const url = `${XHS_HOST}/user/profile/${userId}`;
    const notes = await runScraper(url);

    if (!notes || notes.length === 0) return [];

    const now = new Date().toISOString();

    return notes.map((n: any) => ({
      id: '',
      platform: 'xiaohongshu' as const,
      platformPostId: n.noteId,
      authorId: userId,
      type: 'image_text' as const,
      data: {
        noteId: n.noteId,
        coverUrl: n.coverUrl,
        footerText: n.footerText,
        isPinned: n.isPinned,
      },
      mediaUrls: n.coverUrl ? [n.coverUrl] : [],
      permalink: n.noteUrl || `${XHS_HOST}/explore/${n.noteId}`,
      publishedAt: now,
      fetchedAt: now,
    }));
  },
};
