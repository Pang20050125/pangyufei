export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text required' });
  }

  const VOLC_TTS_KEY = process.env.VOLC_TTS_KEY;
  const VOLC_TTS_SPEAKER = process.env.VOLC_TTS_SPEAKER || 'ICL_uranus_zh_female_aojiaonvyou_tob';

  if (!VOLC_TTS_KEY) {
    return res.status(500).json({ error: 'missing VOLC_TTS_KEY' });
  }

  const url = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

  const body = {
    user: { uid: 'malloc' },
    req_params: {
      text: text,
      speaker: VOLC_TTS_SPEAKER,
      audio_params: {
        format: 'mp3',
        sample_rate: 24000
      }
    }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': VOLC_TTS_KEY,
        'X-Api-Resource-Id': 'seed-tts-2.0'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('[tts] volc http fail', r.status, errText);
      return res.status(500).json({ error: 'volc tts failed', status: r.status, detail: errText });
    }

    // 流式读：一行一行（或一段一段）地读，提取 data 里的 base64
    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let audioBase64 = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按换行切，完整行处理，最后一个可能不完整，留回 buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // 去掉可能的 "data: " 前缀
        let jsonStr = trimmed;
        if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
        if (!jsonStr.startsWith('{')) continue;
        try {
          const obj = JSON.parse(jsonStr);
          if (obj && typeof obj.data === 'string' && obj.data.length > 0) {
            audioBase64 += obj.data;
          }
        } catch (e) {
          // 不是完整 JSON，跳过
        }
      }
    }

    // 处理 buffer 里残留的最后一段
    const tail = buffer.trim();
    if (tail) {
      let jsonStr = tail;
      if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
      if (jsonStr.startsWith('{')) {
        try {
          const obj = JSON.parse(jsonStr);
          if (obj && typeof obj.data === 'string' && obj.data.length > 0) {
            audioBase64 += obj.data;
          }
        } catch (e) {}
      }
    }

    if (!audioBase64) {
      console.error('[tts] no audio data parsed');
      return res.status(500).json({ error: 'no audio data' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audioBuffer);

  } catch (e) {
    console.error('[tts] fatal', e);
    return res.status(500).json({ error: e.message });
  }
}
