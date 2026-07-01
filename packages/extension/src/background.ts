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

function handleScrapeProfile(msg: any, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (!tabId) return;

  const { platform, userId, profile, notes } = msg;

  if (!notes || notes.length === 0) {
    // No notes to scrape, close tab
    chrome.tabs.remove(tabId);
    return;
  }

  // Start job: navigate to first note detail page
  activeJob = {
    tabId,
    platform,
    userId,
    profile,
    notes,
    noteIndex: 0,
    details: [],
  };

  console.log('[Agent Feeds] Starting detail scrape for', notes.length, 'notes');

  // Navigate to first note
  const firstNoteUrl = notes[0].noteUrl;
  chrome.tabs.update(tabId, { url: firstNoteUrl });
}

async function handleScrapeDetail(msg: any) {
  if (!activeJob) return;

  const { noteId, bodyText, publishedAt, location } = msg;

  // Find matching note from the job
  const note = activeJob.notes[activeJob.noteIndex];
  if (!note || note.noteId !== noteId) {
    console.warn('[Agent Feeds] Note ID mismatch, skipping');
    return;
  }

  activeJob.details.push({ noteId, bodyText, publishedAt, location });
  activeJob.noteIndex++;

  if (activeJob.noteIndex < activeJob.notes.length) {
    // Navigate to next note
    const nextUrl = activeJob.notes[activeJob.noteIndex].noteUrl;
    chrome.tabs.update(activeJob.tabId, { url: nextUrl });
  } else {
    // All notes scraped — push to server and close tab
    await pushDataToServer();
    chrome.tabs.remove(activeJob.tabId);
    activeJob = null;
  }
}

async function pushDataToServer() {
  if (!activeJob) return;

  const { platform, userId, profile, notes, details } = activeJob;

  // Merge note list with scraped details
  const enrichedNotes = notes.map((n, i) => {
    const detail = details[i];
    return {
      noteId: n.noteId,
      coverUrl: n.coverUrl,
      title: n.title,
      noteUrl: n.noteUrl,
      bodyText: detail ? detail.bodyText : '',
      publishedAt: detail ? detail.publishedAt : new Date().toISOString(),
      location: detail ? detail.location : '',
    };
  });

  console.log('[Agent Feeds] Pushing', enrichedNotes.length, 'notes to server');

  try {
    const res = await fetch(`${LOCAL_SERVICE}/api/extension/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        userId,
        profile,
        notes: enrichedNotes,
        replace: true,
      }),
    });
    const data = await res.json();
    console.log('[Agent Feeds] Server response:', data);
  } catch (e) {
    console.error('[Agent Feeds] Failed to push data:', e);
  }
}

// ====== Poll for pending fetch tasks ======
setInterval(async () => {
  // Don't poll if we're in the middle of a scrape job
  if (activeJob) return;

  try {
    const res = await fetch(`${LOCAL_SERVICE}/api/fetch/pending`);
    if (!res.ok) return;
    const { pending, url } = await res.json();
    if (pending && url) {
      console.log(`[Agent Feeds] Fetching: ${url}`);
      // Open the profile page — content script will scrape the note list
      await chrome.tabs.create({ url, active: false });
    }
  } catch { /* server may not be running */ }
}, 5000);

console.log('Agent Feeds background service worker started');
