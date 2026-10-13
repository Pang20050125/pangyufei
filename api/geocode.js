export default async function handler(req, res) {
  const lat = req.query.lat;
  const lon = req.query.lon;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'missing lat or lon' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=zh-CN`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Malloc/1.0 (https://www.pangyufei.com)'
      }
    });
    const data = await r.json();

    let name = '';
    if (data && data.address) {
      const a = data.address;
      name = a.city || a.town || a.county || a.state || '';
      const district = a.city_district || a.suburb || a.district || '';
      const road = a.road || '';
      if (district && district !== name) name = name + district;
      if (road) name = name + road;
    }
    if (!name && data && data.display_name) {
      name = data.display_name;
    }

    res.status(200).json({
      name: name || '未知地点',
      lat: lat,
      lon: lon
    });
  } catch (e) {
    res.status(500).json({ error: 'geocode failed' });
  }
}
