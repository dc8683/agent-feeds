// Content script — runs on xiaohongshu.com, bilibili.com, douyin.com

function detectPlatform(): string | null {
  const host = window.location.hostname;
  if (host.includes('xiaohongshu.com')) return 'xiaohongshu';
  if (host.includes('bilibili.com')) return 'bilibili';
  if (host.includes('douyin.com')) return 'douyin';
  return null;
}

function getCookies(): string {
  return document.cookie;
}

const platform = detectPlatform();
if (!platform) throw new Error('Agent Feeds: unknown platform');

// Send session info to background
chrome.runtime.sendMessage({
  type: 'SESSION_UPDATE',
  platform,
  cookies: getCookies(),
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

  // Also intercept API calls as a fallback/supplement
  interceptXhsApis();
}

// ====== B站 API Interception (stub) ======
if (platform === 'bilibili') {
  interceptBilibiliApis();
}

// ====== 抖音 API Interception (stub) ======
if (platform === 'douyin') {
  interceptDouyinApis();
}

// --- 小红书 DOM Scraper ---
function scrapeXhsProfile() {
  console.log('[Agent Feeds] Detected 小红书 profile page, starting DOM scrape...');

  // Delay to let page fully load
  setTimeout(() => {
    scrollAndExtract();
  }, 3000);

  async function scrollAndExtract() {
    // Scroll down a few times to load more notes
    for (let i = 0; i < 4; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 1500));
    }

    // Extract notes from DOM
    const sections = document.querySelectorAll('section.note-item');
    const notes: any[] = [];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const img = s.querySelector('img');
      const footer = s.querySelector('[class*="footer"]');
      const pin = s.querySelector('[class*="top-wrapper"]');

      let noteUrl = '';
      let noteId = '';
      const allLinks = s.querySelectorAll('a');
      for (let j = 0; j < allLinks.length; j++) {
        const href = allLinks[j].href;
        if (href.indexOf('/explore/') >= 0 && !noteUrl) {
          noteUrl = href;
          const m = href.match(/explore\/([a-f0-9]+)/);
          if (m) noteId = m[1];
        }
      }

      if (noteId) {
        notes.push({
          noteId,
          coverUrl: img ? img.src : '',
          footerText: footer ? footer.textContent!.trim() : '',
          noteUrl,
          isPinned: !!pin,
        });
      }
    }

    // Extract profile info from page title
    const title = document.title;
    const nickname = title.includes(' - ') ? title.split(' - ')[0].trim() : '';

    console.log(`[Agent Feeds] Scraped ${notes.length} notes from ${nickname}`);

    // Extract userId from URL
    const match = window.location.pathname.match(/\/user\/profile\/([a-f0-9]+)/);
    const userId = match ? match[1] : '';

    // Push to background → local service
    forwardToBackground({
      platform: 'xiaohongshu',
      userId,
      profile: { nickname, avatar: '' },
      notes,
      scrapedAt: new Date().toISOString(),
    }, '/api/extension/data');
  }
}

// --- 小红书 API Interception ---
function interceptXhsApis() {
  const patterns = [
    /\/api\/sns\/web\/v1\/user_posted/,
    /\/api\/sns\/web\/v1\/feed/,
    /\/api\/sns\/web\/v1\/note\//,
  ];

  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    const response = await origFetch(input, init);

    if (patterns.some(p => p.test(url))) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        forwardToBackground({ url, data: json }, '/api/extension/data');
        console.log(`[Agent Feeds] API Intercepted: ${url}`);
      } catch { /* skip */ }
    }
    return response;
  };
}

// --- B站 API Interception (stub) ---
function interceptBilibiliApis() {
  const patterns = [/\/x\/space\/wbi\/arc\/search/, /\/x\/relation\/followings/];
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    const response = await origFetch(input, init);
    if (patterns.some(p => p.test(url))) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        forwardToBackground({ url, data: json }, '/api/extension/data');
      } catch { /* skip */ }
    }
    return response;
  };
}

// --- 抖音 API Interception (stub) ---
function interceptDouyinApis() {
  const patterns = [/\/aweme\/v1\/web\/aweme\/post/, /\/aweme\/v1\/web\/following\/list/];
  const origFetch = window.fetch.bind(window);
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
    const response = await origFetch(input, init);
    if (patterns.some(p => p.test(url))) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        forwardToBackground({ url, data: json }, '/api/extension/data');
      } catch { /* skip */ }
    }
    return response;
  };
}
