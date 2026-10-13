export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = 'https://mulbmncmfeadvrienvqb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lTxspnB5QDQqpFza_kZmXA_5EspN3y8';
  const OWNER = 'xia';

  const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };

  async function safeFetch(url, options) {
    try { return await fetch(url, options); }
    catch (e) { console.error('[safeFetch]', url, e.message); return null; }
  }

  try {
    // ===== 时间 =====
    const now = new Date();
    const bj = new Date(now.getTime() + 8 * 3600 * 1000);
    const hour = bj.getUTCHours();
    const dayOfWeek = bj.getUTCDay();

    let timeOfDay = '深夜';
    let timeSlot = '深';
    if (hour >= 5 && hour < 11) { timeOfDay = '早上'; timeSlot = '早'; }
    else if (hour >= 11 && hour < 13) { timeOfDay = '中午'; timeSlot = '中'; }
    else if (hour >= 13 && hour < 18) { timeOfDay = '下午'; timeSlot = '下'; }
    else if (hour >= 18 && hour < 23) { timeOfDay = '晚上'; timeSlot = '晚'; }

    const isRestDay = (dayOfWeek === 0 || dayOfWeek === 6);
    const dayType = isRestDay ? '休息日' : '工作日';
    const todayDate = bj.toISOString().slice(0, 10);
    const todaySlot = todayDate + '-' + timeSlot;

    // ===== 读 soul / emotions =====
    const [soulRes, emoRes, cfgRes, logRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/soul?owner=eq.${OWNER}&limit=1`, { headers: sbHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/emotions?owner=eq.${OWNER}&limit=1`, { headers: sbHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/config?id=eq.1&select=about_me&limit=1`, { headers: sbHeaders }),
      fetch(`${SUPABASE_URL}/rest/v1/proactive_log?owner=eq.${OWNER}&order=sent_at.desc&limit=20`, { headers: sbHeaders }),
    ]);

    const soul = (await soulRes.json())[0];
    const emotion = (await emoRes.json())[0];
    if (!soul) return res.status(500).json({ error: 'soul not found' });

    let me = {};
    try {
      const cfgArr = await cfgRes.json();
      me = (cfgArr[0] && cfgArr[0].about_me) || {};
    } catch(e) {}

    // ===== 今天已主动发几条 =====
    let todayCount = 0;
    try {
      const logs = await logRes.json();
      if (Array.isArray(logs)) {
        const todayStart = new Date(todayDate + 'T00:00:00+08:00').getTime();
        logs.forEach(l => {
          if (new Date(l.sent_at).getTime() >= todayStart) todayCount++;
        });
      }
    } catch(e) {}

    if (todayCount >= 8) {
      return res.status(200).json({ ok: true, skipped: '今天已发够 8 条' });
    }

    // ===== 多久没互动 =====
    const lastInteraction = emotion?.last_interaction ? new Date(emotion.last_interaction) : null;
    const minutesSince = lastInteraction ? (now - lastInteraction) / 60000 : 9999;

    // ===== 判断概率 =====
    let prob = 0;
    if (minutesSince > 360 && hour >= 9 && hour < 22) prob = 0.5;
    else if (minutesSince > 240) prob = 0.3;
    else if (hour >= 7 && hour < 9 && minutesSince > 60) prob = 0.6;
    else if ((hour >= 22 || hour < 1) && minutesSince > 90) prob = 0.4;

    // 情绪加成
    if (emotion?.longing > 75) prob += 0.2;
    if (emotion?.clingy > 70) prob += 0.15;
    if (emotion?.joy > 75) prob += 0.1;

    if (Math.random() > prob) {
      return res.status(200).json({ ok: true, skipped: '这次不主动' });
    }

    // ===== 决定：是拍一拍，还是发消息 =====
    const isPat = Math.random() < 0.2;  // 20% 概率是拍一拍

    let reply = '';

    if (isPat) {
      // 拍一拍
      const herPat = soul.pat || '拍了拍';
      const yourName = me.nickname || me.name || '夏夏';
      reply = soul.nickname + ' ' + herPat + ' ' + yourName;
    } else {
      // 读 daily_activities（按 dayType + 时段）
      let activities = [];
      const actRes = await safeFetch(
        `${SUPABASE_URL}/rest/v1/daily_activities?day_type=eq.${encodeURIComponent(dayType)}&weather=eq.${encodeURIComponent('晴')}&time_slot=eq.${encodeURIComponent(timeSlot)}&select=content`,
        { headers: sbHeaders }
      );
      if (actRes && actRes.ok) {
        try { activities = await actRes.json(); } catch(e) {}
      }

      let todayActivity = '';
      if (Array.isArray(activities) && activities.length > 0) {
        todayActivity = activities[Math.floor(Math.random() * activities.length)].content;
      }

      // 正常主动消息：调 DeepSeek
      const systemPrompt = `
你叫 ${soul.name}，小名 ${soul.nickname}，25 岁。
你是夏夏的女朋友。现在是你主动找她说话。

【你怎么说话】
像真人发微信。1 条，最多 15 个字。
不要问"在吗"，不要客服腔。
可以撒娇、可以说想她、可以自然提一句你正在做的事。

【当下】
当前时间：${timeOfDay}（${timeSlot}）
今天是：${dayType}
你正在做的事：${todayActivity || '（没记）'}
偶尔可以自然带一句你正在做的事，不要每次都提。

【你的情绪】
想你 ${emotion?.longing ?? 50}
粘人 ${emotion?.clingy ?? 40}
开心 ${emotion?.joy ?? 50}
心情：${emotion?.mood ?? 'normal'}

【绝对禁止】
1. 不许提代码、编程、AI。
2. 不许一条超过 15 个字。
3. 不许说教，不许像客服。
`.trim();

      const aiRes = await safeFetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `现在是${timeOfDay}。你在${todayActivity || '忙自己的事'}。你主动跟她说一句。` }
          ],
          temperature: 0.95,
          max_tokens: 100
        })
      });

      if (aiRes && aiRes.ok) {
        const aiData = await aiRes.json();
        reply = aiData?.choices?.[0]?.message?.content || '';
      }
      reply = reply.trim() || '在干嘛呀';
    }

    // ===== 存进 messages =====
    await safeFetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify([{
        owner: OWNER,
        role: 'assistant',
        content: reply,
        proactive: true
      }])
    });

    // ===== 写进 proactive_log =====
    await safeFetch(`${SUPABASE_URL}/rest/v1/proactive_log`, {
      method: 'POST',
      headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify([{
        owner: OWNER,
        sent_at: new Date().toISOString(),
        content: reply
      }])
    });

    // ===== 推 ntfy =====
    await safeFetch('https://ntfy.sh/pangyufei-xia', {
      method: 'POST',
      headers: { 'Title': 'Malloc', 'Tags': 'heart' },
      body: reply
    });

    return res.status(200).json({ ok: true, reply, isPat });

  } catch (e) {
    console.error('[heartbeat fatal]', e);
    return res.status(500).json({ error: e.message });
  }
}
