import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb'
    }
  }
};

// 阿里云 RPC 签名算法
function getSignature(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(params[key]))
    .join('&');
  
  const stringToSign = 'POST&%2F&' + encodeURIComponent(canonicalizedQueryString);
  return crypto.createHmac('sha1', secret + '&').update(stringToSign).digest('base64');
}

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

  const APPKEY = process.env.ALI_STT_APPKEY;
  const AK_ID = process.env.ALI_STT_AK_ID;
  const AK_SECRET = process.env.ALI_STT_AK_SECRET;

  if (!APPKEY || !AK_ID || !AK_SECRET) {
    return res.status(500).json({ error: 'missing ali cloud credentials' });
  }

  try {
    // 1. 调阿里云获取 Token
    const tokenParams = {
      AccessKeyId: AK_ID,
      Action: 'CreateToken',
      Format: 'JSON',
      RegionId: 'cn-shanghai',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Date.now().toString(),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2019-02-28'
    };
    tokenParams.Signature = getSignature(tokenParams, AK_SECRET);

    const tokenQuery = Object.keys(tokenParams).map(k => `${k}=${encodeURIComponent(tokenParams[k])}`).join('&');
    const tokenRes = await fetch(`https://nls-meta.cn-shanghai.aliyuncs.com/?${tokenQuery}`, { method: 'POST' });
    const tokenData = await tokenRes.json();
    
    if (!tokenData.Token || !tokenData.Token.Id) {
      return res.status(500).json({ error: 'get ali token failed', detail: tokenData });
    }
    
    const token = tokenData.Token.Id;

    // 2. 调阿里云一句话识别
    const sttUrl = `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${APPKEY}&format=mp3`;
    
    const audioBuffer = Buffer.from(audio, 'base64');

    const sttRes = await fetch(sttUrl, {
      method: 'POST',
      headers: {
        'X-NLS-Token': token,
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
