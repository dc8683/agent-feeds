// Popup script — show platform connection status from server

const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  bilibili: 'B站',
  douyin: '抖音',
};

const DOT_CLASS: Record<string, string> = {
  connected: 'green',
  expired: 'yellow',
  disconnected: 'red',
  rate_limited: 'red',
  error: 'red',
};

async function refreshStatus() {
  const statusDiv = document.getElementById('status')!;
  const serviceEl = document.getElementById('service-status')!;

  try {
    const res = await fetch('http://localhost:58797/api/extension/status');
    if (!res.ok) throw new Error('Server error');
    const data = await res.json();

    statusDiv.innerHTML = data.statuses
      .map((s: any) => {
        const dot = DOT_CLASS[s.status] || 'red';
        return `<div class="platform"><span><span class="dot ${dot}"></span>${PLATFORM_LABELS[s.platform] || s.platform}</span><span class="status-text">${s.message}</span></div>`;
      })
      .join('');

    serviceEl.textContent = '运行中';
    serviceEl.style.color = '#22c55e';
  } catch {
    // Server not reachable — show all as unknown
    serviceEl.textContent = '未启动';
    serviceEl.style.color = '#ef4444';
    for (const p of ['xiaohongshu', 'bilibili', 'douyin']) {
      const result = await chrome.storage.local.get(`session_${p}`);
      const session = result[`session_${p}`];
      const dot = session ? 'yellow' : 'red';
      const text = session ? 'Server离线' : '未连接';
      statusDiv.innerHTML += `<div class="platform"><span><span class="dot ${dot}"></span>${PLATFORM_LABELS[p]}</span><span class="status-text">${text}</span></div>`;
    }
  }
}

refreshStatus();
