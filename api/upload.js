import OSS from 'ali-oss';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const client = new OSS({
      region: process.env.OSS_REGION,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET,
    });

    const { base64, fileName } = req.body;
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await client.put(fileName, buffer);

	return res.status(200).json({ url: result.url.replace('http://', 'https://') });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}