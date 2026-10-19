export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { audio } = req.body || {};
  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({ error: 'audio required (base64)' });
  }

  const VOLC_TTS_KEY = process.env.VOLC_TTS_KEY;
  if (!VOLC_TTS_KEY) {
    return res.status(500).json({ error: 'missing VOLC_TTS_KEY' });
  }

  // 录音文件识别极速版（HTTP 同步接口，适合短音频）
  const url = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  const body = {
    user: { uid: 'malloc' },
    audio: audio,
    request: { model_name: 'bigmodel' }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': VOLC_TTS_KEY,
        'X-Api-Resource-Id': 'volc.bigasr.auc_turbo',
        'X-Api-Request-Id': reqId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify(body)
    });

    const statusCode = r.headers.get('X-Api-Status-Code');
    const statusMsg = r.headers.get('X-Api-Message');

    if (!r.ok || (statusCode && statusCode !== '20000000')) {
      const errText = await r.text().catch(() => '');
      return res.status(500).json({
        error: 'stt failed',
        status: r.status,
        api_status: statusCode,
        api_msg: statusMsg,
        detail: errText
      });
    }

    const data = await r.json();
    const text = data?.result?.text || '';

    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
