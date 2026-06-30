// Popup script — show platform connection status

const PLATFORMS = ['xiaohongshu', 'bilibili', 'douyin'];
const PLATFORM_LABELS: Record<string, string> = {
  xiaohongshu: '小红书',
  bilibili: 'B站',
  douyin: '抖音',
};

async function refreshStatus() {
  const statusDiv = document.getElementById('status')!;
  let html = '';

  for (const p of PLATFORMS) {
    const result = await chrome.storage.local.get(`session_${p}`);
    const session = result[`session_${p}`];
    const dotClass = session ? 'green' : 'red';
    const statusText = session ? '已连接' : '未连接';
    html += `<div class="platform"><span><span class="dot ${dotClass}"></span>${PLATFORM_LABELS[p]}</span><span class="status-text">${statusText}</span></div>`;
  }

  statusDiv.innerHTML = html;

  // Check local service
  try {
    const res = await fetch('http://localhost:58797/api/settings');
    document.getElementById('service-status')!.textContent = res.ok ? '运行中' : '异常';
    document.getElementById('service-status')!.style.color = res.ok ? '#22c55e' : '#ef4444';
  } catch {
    document.getElementById('service-status')!.textContent = '未启动';
    document.getElementById('service-status')!.style.color = '#ef4444';
  }
}

refreshStatus();
