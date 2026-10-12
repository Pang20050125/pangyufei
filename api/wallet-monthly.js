const SUPABASE_URL = 'https://mulbmncmfeadvrienvqb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lTxspnB5QDQqpFza_kZmXA_5EspN3y8';
const OWNER = 'xia';

export default async function handler(req, res) {
  try {
    // 本月 1 号 0 点（北京时间）
    const now = new Date();
    const bj = new Date(now.getTime() + 8 * 3600 * 1000);
    const y = bj.getUTCFullYear();
    const m = bj.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0) - 8 * 3600 * 1000).toISOString();

    // 查本月有没有"每月生活费"
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/wallet?owner=eq.${OWNER}&type=eq.income&note=eq.每月生活费&created_at=gte.${monthStart}&limit=1`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const list = await checkRes.json();

    if (Array.isArray(list) && list.length > 0) {
      return res.status(200).json({ ok: true, skipped: true, msg: '本月已加过' });
    }

    // 插入
    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/wallet`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        owner: OWNER,
        type: 'income',
        amount: 3000,
        note: '每月生活费'
      })
    });

    if (!insRes.ok) throw new Error('插入失败');

    return res.status(200).json({ ok: true, added: 3000 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
