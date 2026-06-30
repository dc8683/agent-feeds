const LOCAL_SERVICE = 'http://localhost:58797';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SESSION_UPDATE') {
    handleSessionUpdate(message.platform, message.cookies, message.userAgent);
    sendResponse({ ok: true });
  }
  if (message.type === 'POST_DATA') {
    forwardToLocalService(message.endpoint, message.data);
    sendResponse({ ok: true });
  }
  return true;
});

async function handleSessionUpdate(platform: string, cookies: string, userAgent: string) {
  await chrome.storage.local.set({
    [`session_${platform}`]: { cookies, userAgent, updatedAt: Date.now() },
  });

  try {
    await fetch(`${LOCAL_SERVICE}/api/extension/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, cookies, userAgent }),
    });
  } catch { /* server may not be running */ }
}

async function forwardToLocalService(endpoint: string, data: any) {
  try {
    await fetch(`${LOCAL_SERVICE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch { /* server may not be running */ }
}

// ====== Poll for pending fetch tasks ======
setInterval(async () => {
  try {
    const res = await fetch(`${LOCAL_SERVICE}/api/fetch/pending`);
    if (!res.ok) return;
    const { pending, url } = await res.json();
    if (pending && url) {
      console.log(`[Agent Feeds] Fetching: ${url}`);
      // Open the profile page — content script will scrape it
      await chrome.tabs.create({ url, active: false });
    }
  } catch { /* server may not be running */ }
}, 5000);

console.log('Agent Feeds background service worker started');
