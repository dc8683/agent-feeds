// Content script — runs on xiaohongshu.com, bilibili.com, douyin.com

(function() {
  const host = window.location.hostname;
  let platform: string | null = null;
  if (host.includes('xiaohongshu.com')) platform = 'xiaohongshu';
  else if (host.includes('bilibili.com')) platform = 'bilibili';
  else if (host.includes('douyin.com')) platform = 'douyin';
  else return;

  // Push session to background → server
  chrome.runtime.sendMessage({
    type: 'SESSION_UPDATE',
    platform,
    cookies: document.cookie,
    userAgent: navigator.userAgent,
  });

  console.log('[Agent Feeds] Content script loaded on', platform);

  function forward(data: unknown, endpoint: string) {
    chrome.runtime.sendMessage({ type: 'POST_DATA', endpoint, data });
  }

  // ====== 小红书 Profile Page Scraping ======
  if (platform === 'xiaohongshu' && /\/user\/profile\//.test(location.pathname)) {
    setTimeout(async () => {
      for (let i = 0; i < 4; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1500));
      }

      const sections = document.querySelectorAll('section.note-item');
      const allNotes: any[] = [];
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (s.querySelector('[class*="top-wrapper"]')) continue; // skip pinned

        const img = s.querySelector('img');
        const footer = s.querySelector('[class*="footer"]');
        let noteUrl = '', noteId = '';
        const links = s.querySelectorAll('a');
        for (let j = 0; j < links.length; j++) {
          const h = links[j].href;
          if (h.includes('/explore/') && !noteUrl) {
            noteUrl = h;
            const m = h.match(/explore\/([a-f0-9]+)/);
            if (m) noteId = m[1];
          }
        }
        if (noteId) {
          allNotes.push({ noteId, coverUrl: img ? img.src : '', footerText: footer ? footer.textContent!.trim() : '', noteUrl });
        }
      }

      const notes = allNotes.slice(-10);
      const nickname = document.title.includes(' - ') ? document.title.split(' - ')[0].trim() : '';
      const m = location.pathname.match(/\/user\/profile\/([a-f0-9]+)/);
      const userId = m ? m[1] : '';

      console.log('[Agent Feeds] Scraped', notes.length, 'notes');
      forward({ platform, userId, profile: { nickname, avatar: '' }, notes, replace: true, scrapedAt: new Date().toISOString() }, '/api/extension/data');
    }, 3000);
  }
})();
