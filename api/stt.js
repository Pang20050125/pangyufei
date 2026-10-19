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

  // 使用流式语音识别的 HTTP 单向流接口
  const url = 'https://openspeech.bytedance.com/api/v3/sauc/bigmodel';
  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  // 构造请求体 (这里用流式识别的协议格式)
  const body = {
    user: { uid: 'malloc' },
    audio: { format: 'mp3', data: audio },
    request: { model_name: 'bigmodel' }
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': VOLC_TTS_KEY,
        'X-Api-Resource-Id': 'volc.bigasr.sauc.duration', // 流式识别的 ResourceId
        'X-Api-Request-Id': reqId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify(body)
    });

    // 流式接口返回可能是分块的 JSON，我们直接读文本
    const textData = await r.text();
    
    // 解析返回的内容 (流式接口的返回有时带换行或前缀)
    let resultText = '';
    const lines = textData.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let jsonStr = trimmed;
      if (jsonStr.startsWith('data:')) jsonStr = jsonStr.slice(5).trim();
      if (!jsonStr.startsWith('{')) continue;
      try {
        const obj = JSON.parse(jsonStr);
        // 提取识别出的文字
        if (obj.result && obj.result.text) {
          resultText += obj.result.text;
        } else if (obj.data && obj.data.result && obj.data.result.text) {
           resultText += obj.data.result.text;
        }
      } catch (e) {}
    }

    if (!resultText) {
      // 兜底尝试直接解析整个返回
      try {
        const fullObj = JSON.parse(textData);
        if (fullObj.result && fullObj.result.text) {
          resultText = fullObj.result.text;
        }
      } catch(e) {}
    }

    if (!resultText) {
      console.error('[stt] 无法解析返回', textData);
      return res.status(500).json({ error: 'no text recognized', raw: textData });
    }

    return res.status(200).json({ text: resultText });

  } catch (e) {
    console.error('[stt] fatal', e);
    return res.status(500).json({ error: e.message });
  }
}
