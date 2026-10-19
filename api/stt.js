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

  const { audio, format } = req.body || {};
  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({ error: 'audio required (base64)' });
  }
  const audioFormat = format || 'mp3';

  const APPKEY = process.env.ALI_STT_APPKEY;
  const TOKEN = process.env.ALI_STT_TOKEN;

  if (!APPKEY || !TOKEN) {
    return res.status(500).json({ error: 'missing ali cloud appkey or token' });
  }

  try {
    // 直接用临时 Token 调一句话识别
    const sttUrl = `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${APPKEY}&format=${audioFormat}`;
    
    const audioBuffer = Buffer.from(audio, 'base64');

    const sttRes = await fetch(sttUrl, {
      method: 'POST',
      headers: {
        'X-NLS-Token': TOKEN,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBuffer
    });

    const sttData = await sttRes.json();

    if (sttData.status === 20000000 && sttData.result) {
      return res.status(200).json({ text: sttData.result });
    } else {
      return res.status(500).json({ error: 'ali stt failed', detail: sttData });
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
