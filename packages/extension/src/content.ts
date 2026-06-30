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

// API patterns to intercept (platform-specific)
const API_PATTERNS: Record<string, RegExp[]> = {
  xiaohongshu: [
    /\/api\/sns\/web\/v1\/user_posted/,
    /\/api\/sns\/web\/v2\/user\/followings/,
    /\/api\/sns\/web\/v1\/feed/,
    /\/api\/sns\/web\/v1\/note\//,
  ],
  bilibili: [
    /\/x\/space\/wbi\/arc\/search/,
    /\/x\/relation\/followings/,
  ],
  douyin: [
    /\/aweme\/v1\/web\/aweme\/post/,
    /\/aweme\/v1\/web\/following\/list/,
  ],
};

const patterns = API_PATTERNS[platform] || [];

function shouldIntercept(url: string): boolean {
  return patterns.some(p => p.test(url));
}

function forwardToBackground(data: unknown, endpoint: string) {
  chrome.runtime.sendMessage({
    type: 'POST_DATA',
    endpoint,
    data,
  });
}

// --- Intercept fetch ---
const origFetch = window.fetch.bind(window);
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  const response = await origFetch(input, init);

  if (shouldIntercept(url)) {
    try {
      const cloned = response.clone();
      const json = await cloned.json();
      forwardToBackground({ url, data: json }, '/api/extension/data');
      console.log(`[Agent Feeds] Intercepted: ${url}`);
    } catch {
      // Not JSON or clone failed, skip
    }
  }

  return response;
};

// --- Intercept XMLHttpRequest ---
const origXHROpen = XMLHttpRequest.prototype.open;
const origXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
  (this as any).__agentFeedsUrl = typeof url === 'string' ? url : url.toString();
  return origXHROpen.apply(this, [method, url, ...args] as any);
};

XMLHttpRequest.prototype.send = function(...args: any[]) {
  const url = (this as any).__agentFeedsUrl as string | undefined;
  this.addEventListener('load', () => {
    if (url && shouldIntercept(url) && this.responseText) {
      try {
        const json = JSON.parse(this.responseText);
        forwardToBackground({ url, data: json }, '/api/extension/data');
        console.log(`[Agent Feeds] XHR Intercepted: ${url}`);
      } catch { /* not JSON */ }
    }
  });
  return origXHRSend.apply(this, args as any);
};
