export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, apikey, Authorization, Prefer');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const SUPABASE_URL = 'https://mulbmncmfeadvrienvqb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_lTxspnB5QDQqpFza_kZmXA_5EspN3y8';

  // 取出原始路径，比如 /rest/v1/config
  const path = req.url.replace(/^\/api\/supabase/, '') || '/';

  const url = SUPABASE_URL + path;

  try {
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
    };
    if (req.headers['prefer']) {
      headers['Prefer'] = req.headers['prefer'];
    }

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const resp = await fetch(url, fetchOptions);
    const text = await resp.text();

    res.status(resp.status);
    res.setHeader('Content-Type', resp.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}