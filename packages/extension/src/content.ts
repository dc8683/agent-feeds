// Content script — runs on xiaohongshu.com, bilibili.com, douyin.com

function detectPlatform(): string | null {
  const host = window.location.hostname;
  if (host.includes('xiaohongshu.com')) return 'xiaohongshu';
  if (host.includes('bilibili.com')) return 'bilibili';
  if (host.includes('douyin.com')) return 'douyin';
  return null;
}

const platform = detectPlatform();
if (!platform) throw new Error('Agent Feeds: unknown platform');

// Send session info to background
chrome.runtime.sendMessage({
  type: 'SESSION_UPDATE',
  platform,
  cookies: document.cookie,
  userAgent: navigator.userAgent,
});

console.log(`[Agent Feeds] Content script loaded on ${platform}`);

function forwardToBackground(data: unknown, endpoint: string) {
  chrome.runtime.sendMessage({ type: 'POST_DATA', endpoint, data });
}

// ====== 小红书 Profile Page DOM Scraping ======
if (platform === 'xiaohongshu') {
  const isProfilePage = /\/user\/profile\//.test(window.location.pathname);

  if (isProfilePage) {
    scrapeXhsProfile();
  }
}

function scrapeXhsProfile() {
  console.log('[Agent Feeds] Detected 小红书 profile page');

  setTimeout(async () => {
    // Scroll to load notes
    for (let i = 0; i < 4; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1500));
    }

    // Extract notes, skip pinned
    const sections = document.querySelectorAll('section.note-item');
    const allNotes: any[] = [];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const img = s.querySelector('img');
      const footer = s.querySelector('[class*="footer"]');
      const pin = s.querySelector('[class*="top-wrapper"]');

      if (pin) continue; // Skip pinned notes

      let noteUrl = '';
      let noteId = '';
      const allLinks = s.querySelectorAll('a');
      for (let j = 0; j < allLinks.length; j++) {
        const href = allLinks[j].href;
        if (href.includes('/explore/') && !noteUrl) {
          noteUrl = href;
          const m = href.match(/explore\/([a-f0-9]+)/);
          if (m) noteId = m[1];
        }
      }

      if (noteId) {
        allNotes.push({
          noteId,
          coverUrl: img ? img.src : '',
          footerText: footer ? footer.textContent!.trim() : '',
          noteUrl,
        });
      }
    }

    // Take last 10 only (most recent, excluding pinned)
    const notes = allNotes.slice(-10);

    // Extract nickname
    const title = document.title;
    const nickname = title.includes(' - ') ? title.split(' - ')[0].trim() : '';

    // Extract userId from URL
    const match = window.location.pathname.match(/\/user\/profile\/([a-f0-9]+)/);
    const userId = match ? match[1] : '';

    console.log(`[Agent Feeds] Scraped ${notes.length} notes (${allNotes.length} total, skipped ${allNotes.length - notes.length} pinned)`);

    forwardToBackground({
      platform: 'xiaohongshu',
      userId,
      profile: { nickname, avatar: '' },
      notes,
      scrapedAt: new Date().toISOString(),
      replace: true, // clear old data for this user
    }, '/api/extension/data');
  }, 3000);
}
