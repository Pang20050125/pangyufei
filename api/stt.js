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

  // 使用流式识别的单向流接口
  const url = 'https://openspeech.bytedance.com/api/v3/sauc/bigmodel_nostream';
  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  const body = {
    user: { uid: 'malloc' },
    audio: { 
      format: 'mp4', // 浏览器 MediaRecorder 默认多数是 mp4 或 webm
      data: audio 
    },
    request: { model_name: 'bigmodel' }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': VOLC_TTS_KEY,
        'X-Api-Resource-Id': 'volc.bigasr.sauc.duration', // 流式识别的资源 ID
        'X-Api-Request-Id': reqId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify(body)
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(500).json({ error: 'stt failed', status: r.status, detail: errText });
    }

    // 由于是 HTTP 单向流，返回的可能包含多段 JSON 数据，需要提取
    const textData = await r.text();
    let resultText = '';
    
    // 尝试逐行解析（火山流式返回通常是换行分隔的 JSON 或 SSE 格式）
    const lines = textData.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let jsonStr = trimmed;
      if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
      if (!jsonStr.startsWith('{')) continue;
      try {
        const obj = JSON.parse(jsonStr);
        if (obj.result && obj.result.text) {
          resultText += obj.result.text;
        }
      } catch (e) {}
    }

    // 如果逐行解析没拿到，尝试直接解析整体
    if (!resultText) {
       try {
         const obj = JSON.parse(textData);
         if (obj.result && obj.result.text) resultText = obj.result.text;
       } catch(e) {}
    }

    return res.status(200).json({ text: resultText.trim() });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
