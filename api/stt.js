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

  const reqId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

  // ===== 1. 提交任务（Submit） =====
  const submitUrl = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit';
  
  try {
    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': VOLC_TTS_KEY,
        'X-Api-Resource-Id': 'volc.bigasr.auc', // 录音文件识别 2.0 标准版
        'X-Api-Request-Id': reqId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify({
        user: { uid: 'malloc' },
        audio: { data: audio },
        request: { model_name: 'bigmodel' }
      })
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      return res.status(500).json({ error: 'submit failed', status: submitRes.status, detail: errText });
    }

    // ===== 2. 轮询查询结果（Query） =====
    const queryUrl = `https://openspeech.bytedance.com/api/v3/auc/bigmodel/query?task_id=${reqId}`;
    let textResult = '';
    
    // 最多查 10 次，每次等 1.5 秒
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500));
      
      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': VOLC_TTS_KEY,
          'X-Api-Resource-Id': 'volc.bigasr.auc',
          'X-Api-Request-Id': reqId
        },
        body: JSON.stringify({})
      });

      if (!queryRes.ok) {
        const errText = await queryRes.text();
        return res.status(500).json({ error: 'query failed', status: queryRes.status, detail: errText });
      }

      const data = await queryRes.json();
      
      // 如果状态是完成，提取文字
      if (data.result && data.result.text) {
        textResult = data.result.text;
        break;
      }
      
      // 状态码如果是 20000001 (处理中)，继续等
      const statusCode = data.header?.code;
      if (statusCode && statusCode !== '20000000' && statusCode !== '20000001') {
        return res.status(500).json({ error: 'query error', detail: data });
      }
    }

    if (!textResult) {
      return res.status(500).json({ error: 'timeout or no text' });
    }

    return res.status(200).json({ text: textResult });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
