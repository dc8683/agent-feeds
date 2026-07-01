const LOCAL_SERVICE = 'http://localhost:58797';

// State for detail scraping orchestration
interface ScrapeJob {
  tabId: number;
  platform: string;
  userId: string;
  profile: { nickname: string; avatar: string };
  notes: Array<{ noteId: string; title: string; coverUrl: string; noteUrl: string; exploreUrl: string }>;
  noteIndex: number;
  details: Array<{ noteId: string; bodyText: string; publishedAt: string; location: string }>;
}

let activeJob: ScrapeJob | null = null;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SESSION_UPDATE') {
    handleSessionUpdate(message.platform, message.cookies, message.userAgent);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SCRAPE_PROFILE') {
    handleScrapeProfile(message, sender);
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'SCRAPE_DETAIL') {
    handleScrapeDetail(message);
    sendResponse({ ok: true });
    return true;
  }

  return false;
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

async function handleScrapeProfile(msg: any, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const { platform, userId, profile, notes } = msg;

  if (!notes || notes.length === 0) {
    chrome.tabs.remove(tabId);
    return;
  }

  // Check which notes are actually new
  const noteIds = notes.map((n: any) => n.noteId);
  let newIds: string[] = noteIds;
  try {
    const res = await fetch(`${LOCAL_SERVICE}/api/fetch/check-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, noteIds }),
    });
    if (res.ok) {
      const data = await res.json();
      newIds = data.newIds || [];
    }
  } catch { /* proceed with all if check fails */ }

  if (newIds.length === 0) {
    console.log('[Agent Feeds] No new notes, skipping');
    chrome.tabs.remove(tabId);
    return;
  }

  const newNotes = notes.filter((n: any) => newIds.includes(n.noteId));
  console.log(`[Agent Feeds] ${newNotes.length}/${notes.length} new notes`);

  activeJob = {
    tabId, platform, userId, profile,
    notes: newNotes, noteIndex: 0, details: [],
  };

  chrome.tabs.update(tabId, { url: newNotes[0].noteUrl });
}

async function handleScrapeDetail(msg: any) {
  if (!activeJob) return;

  const { noteId, bodyText, publishedAt, location } = msg;
  const note = activeJob.notes[activeJob.noteIndex];
  if (!note || note.noteId !== noteId) {
    console.warn('[Agent Feeds] Note ID mismatch, skipping');
    return;
  }

  activeJob.details.push({ noteId, bodyText, publishedAt, location });
  activeJob.noteIndex++;

  if (activeJob.noteIndex < activeJob.notes.length) {
    const nextUrl = activeJob.notes[activeJob.noteIndex].noteUrl;
    chrome.tabs.update(activeJob.tabId, { url: nextUrl });
  } else {
    await pushDataToServer();
    chrome.tabs.remove(activeJob.tabId);
    activeJob = null;
  }
}

async function pushDataToServer() {
  if (!activeJob) return;
  const { platform, userId, profile, notes, details } = activeJob;

  const enrichedNotes = notes.map((n, i) => {
    const detail = details[i];
    return {
      noteId: n.noteId, coverUrl: n.coverUrl, title: n.title, noteUrl: n.noteUrl,
      bodyText: detail ? detail.bodyText : '',
      publishedAt: detail ? detail.publishedAt : new Date().toISOString(),
      location: detail ? detail.location : '',
    };
  });

  console.log('[Agent Feeds] Pushing', enrichedNotes.length, 'notes');
  try {
    await fetch(`${LOCAL_SERVICE}/api/extension/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, userId, profile, notes: enrichedNotes, replace: false }),
    });
  } catch (e) {
    console.error('[Agent Feeds] Failed to push data:', e);
  }
}

// ====== Main loop via chrome.alarms (survives service worker termination) ======
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;
  if (activeJob) return; // don't interrupt an active scrape

  // 1. Poll for pending fetch tasks
  try {
    const res = await fetch(`${LOCAL_SERVICE}/api/fetch/pending`);
    if (res.ok) {
      const { pending, url } = await res.json();
      if (pending && url) {
        console.log(`[Agent Feeds] Fetching: ${url}`);
        await chrome.tabs.create({ url, active: false });
        return;
      }
    }
  } catch { /* server may not be running */ }

  // 2. Check session — auto-refresh if disconnected (every 10 ticks ≈ 60s)
  try {
    const stored = await chrome.storage.local.get('tick_count');
    let count = (stored.tick_count || 0) + 1;
    await chrome.storage.local.set({ tick_count: count });

    if (count % 10 !== 0) return;

    const statusRes = await fetch(`${LOCAL_SERVICE}/api/extension/status`);
    if (!statusRes.ok) return;
    const { statuses } = await statusRes.json();
    for (const s of statuses) {
      if (s.status !== 'connected') {
        console.log(`[Agent Feeds] ${s.platform} session ${s.status}, refreshing...`);
        const urls: Record<string, string> = {
          xiaohongshu: 'https://www.xiaohongshu.com/explore',
          bilibili: 'https://www.bilibili.com',
          douyin: 'https://www.douyin.com',
        };
        if (urls[s.platform]) {
          await chrome.tabs.create({ url: urls[s.platform], active: false });
        }
      }
    }
  } catch { /* ignore */ }
});

chrome.alarms.create('tick', { periodInMinutes: 0.1 });

console.log('Agent Feeds background service worker started');
