// Content script — dual mode: profile page (note list) + detail page (body text + time)

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

  console.log('[Agent Feeds] Content script loaded on', platform, location.pathname);

  function send(msg: unknown) {
    chrome.runtime.sendMessage(msg);
  }

  // ====== 小红书 Profile Page: scrape note list ======
  if (platform === 'xiaohongshu' && /\/user\/profile\//.test(location.pathname) && !/\/user\/profile\/[^/]+\/[a-f0-9]+/.test(location.pathname)) {
    setTimeout(() => {
      const nickname = document.title.includes(' - ') ? document.title.split(' - ')[0].trim() : '';
      // 博主头像在 info 区域的 avatar-item 中，不要用 [class*="avatar"]（会匹配到侧边栏旧头像）
      const avatarImg = document.querySelector('[class*="info"] [class*="avatar-item"] img[src*="sns-avatar"]');
      let avatar = avatarImg ? (avatarImg.getAttribute('src') || '') : '';
      // 去掉处理后缀 (|imageMogr2/strip 等)，统一用 /w/360/
      avatar = avatar.replace(/\|imageMogr2\/[^?]*/g, '').replace(/\/w\/\d+\//, '/w/360/');

      const userIdMatch = location.pathname.match(/\/user\/profile\/([a-f0-9]+)/);
      const userId = userIdMatch ? userIdMatch[1] : '';

      const sections = document.querySelectorAll('section.note-item');
      const notes: any[] = [];

      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        if (s.querySelector('[class*="top-wrapper"]')) continue; // skip pinned

        // Get note URL from title link (has xsec_token needed for access)
        const titleLink = s.querySelector('a.title') as HTMLAnchorElement | null;
        const noteHref = titleLink ? titleLink.href : '';
        const title = titleLink ? titleLink.textContent!.trim() : '';

        // Extract noteId from URL
        const noteIdMatch = noteHref.match(/\/user\/profile\/[^/]+\/([a-f0-9]+)/);
        const noteId = noteIdMatch ? noteIdMatch[1] : '';

        // Cover image
        const img = s.querySelector('img');
        const coverUrl = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';

        // Fallback: explore link
        let exploreUrl = '';
        const links = s.querySelectorAll('a');
        for (let j = 0; j < links.length; j++) {
          const h = links[j].href;
          if (h.includes('/explore/') && !exploreUrl) {
            exploreUrl = h;
          }
        }

        if (noteId && noteHref) {
          notes.push({ noteId, title, coverUrl, noteUrl: noteHref, exploreUrl });
        }
      }

      const latest = notes.slice(0, 5); // first 5 non-pinned = newest

      console.log('[Agent Feeds] Profile scraped:', latest.length, 'notes, avatar:', avatar ? 'yes' : 'no');

      if (latest.length > 0) {
        // Send note list to background for orchestration
        send({
          type: 'SCRAPE_PROFILE',
          platform,
          userId,
          profile: { nickname, avatar },
          notes: latest,
        });
      }
    }, 3000);
  }

  // ====== 小红书 Note Detail Page: scrape body text + publish time ======
  if (platform === 'xiaohongshu' && /\/explore\//.test(location.pathname)) {
    setTimeout(() => {
      const noteIdMatch = location.pathname.match(/explore\/([a-f0-9]+)/);
      const noteId = noteIdMatch ? noteIdMatch[1] : '';

      // Body text
      const noteTextEl = document.querySelector('[class*="note-text"]');
      const bodyText = noteTextEl ? noteTextEl.textContent!.trim() : '';

      // Publish time
      const bottomEl = document.querySelector('[class*="bottom-container"]');
      const bottomText = bottomEl ? bottomEl.textContent!.trim() : '';
      // bottomText is like "4小时前 美国" or "昨天 上海" or "2026-06-30 北京"
      const parts = bottomText.split(' ');
      const timeStr = parts[0] || '';
      const loc = parts.slice(1).join(' ') || '';

      // Parse relative time to ISO string
      const publishedAt = parseRelativeTime(timeStr);

      console.log('[Agent Feeds] Detail scraped:', noteId, 'body:', bodyText.length, 'chars, time:', timeStr);

      send({
        type: 'SCRAPE_DETAIL',
        platform,
        noteId,
        bodyText,
        publishedAt,
        location: loc,
      });
    }, 2000);
  }
})();

function parseRelativeTime(text: string): string {
  const now = new Date();

  // "X小时前"
  const hourMatch = text.match(/^(\d+)小时前$/);
  if (hourMatch) {
    now.setHours(now.getHours() - parseInt(hourMatch[1]));
    return now.toISOString();
  }

  // "X分钟前"
  const minMatch = text.match(/^(\d+)分钟前$/);
  if (minMatch) {
    now.setMinutes(now.getMinutes() - parseInt(minMatch[1]));
    return now.toISOString();
  }

  // "X天前"
  const dayMatch = text.match(/^(\d+)天前$/);
  if (dayMatch) {
    now.setDate(now.getDate() - parseInt(dayMatch[1]));
    return now.toISOString();
  }

  // "昨天"
  if (text === '昨天') {
    now.setDate(now.getDate() - 1);
    return now.toISOString();
  }

  // "前天"
  if (text === '前天') {
    now.setDate(now.getDate() - 2);
    return now.toISOString();
  }

  // Date like "2026-06-30"
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    return new Date(dateMatch[1] + '-' + dateMatch[2] + '-' + dateMatch[3]).toISOString();
  }

  // Fallback: use current time
  return now.toISOString();
}
