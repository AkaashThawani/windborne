// Vercel Serverless Function to proxy WindBorne balloon data
// This handles requests to /api/00.json, /api/01.json, etc.

export default async function handler(req, res) {
  const { hour } = req.query;

  // Validate hour parameter
  if (!hour || !/^\d{2}\.json$/.test(hour)) {
    return res.status(400).json({ error: 'Invalid hour parameter' });
  }

  try {
    // Fetch from WindBorne API
    const response = await fetch(
      `https://a.windbornesystems.com/treasure/${hour}`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `Failed to fetch data: ${response.statusText}` 
      });
    }

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');

    // Return the data
    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching balloon data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
