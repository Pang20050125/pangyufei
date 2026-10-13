export default async function handler(req, res) {
  const lat = req.query.lat;
  const lon = req.query.lon;
  const name = req.query.name || '';

  if (!lat || !lon) {
    return res.status(400).json({ error: 'missing lat or lon' });
  }

  const key = process.env.TENCENT_MAP_KEY;
  if (!key) {
    return res.status(500).json({ error: 'missing TENCENT_MAP_KEY' });
  }

  try {
    const center = `${lat},${lon}`;
    const marker = `color:red|${lat},${lon}`;
    const url = `https://apis.map.qq.com/ws/staticmap/v2/?center=${center}&zoom=16&size=600*300&maptype=roadmap&markers=${encodeURIComponent(marker)}&key=${key}`;

    const r = await fetch(url);
    if (!r.ok) {
      return res.status(500).json({ error: 'tencent map failed' });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
