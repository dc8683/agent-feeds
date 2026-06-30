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
if (platform) {
  // Send session info to background
  chrome.runtime.sendMessage({
    type: 'SESSION_UPDATE',
    platform,
    cookies: getCookies(),
    userAgent: navigator.userAgent,
  });

  console.log(`[Agent Feeds] Content script loaded on ${platform}`);
}
