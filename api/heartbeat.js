// ===== 轮询：她主动发的消息 =====
let lastSeenMessageId = 0;

async function pollProactive() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?owner=eq.${OWNER}&proactive=eq.true&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    if (!res.ok) return;
    const list = await res.json();
    if (!Array.isArray(list) || list.length === 0) return;
    const m = list[0];
    if (m.id === lastSeenMessageId) return;
    if (lastSeenMessageId === 0) { lastSeenMessageId = m.id; return; }
    lastSeenMessageId = m.id;

    // 显示在聊天里
    const now = Date.now();
    if (now - lastMsgTime > 5 * 60 * 1000) appendTimeDivider(now);
    lastMsgTime = now;
    appendMsg('her', m.content);
    scrollBottom();

    // 浏览器通知（如果页面在前台，可以补一层）
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('Malloc', { body: m.content });
      }
    } catch(e) {}
  } catch(e) { /* silent */ }
}

// 初始化：拉一次最新，记下 id
(async () => {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/messages?owner=eq.${OWNER}&proactive=eq.true&order=created_at.desc&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const list = await res.json();
    if (Array.isArray(list) && list.length > 0) lastSeenMessageId = list[0].id;
  } catch(e) {}
})();

// 每 30 秒轮询一次
setInterval(pollProactive, 30000);

// 申请通知权限
try {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission();
  }
} catch(e) {}