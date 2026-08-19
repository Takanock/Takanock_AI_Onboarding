// Live feed of the AI Catalogue (Airtable) — powers the "What's Live" page.
// Reads the master registry so the Hub never goes stale: the Catalogue is the
// single source of truth for what's built; this endpoint just mirrors it.
const CATALOGUE_BASE = 'appPZMqespKQVOfxo';
const CATALOGUE_TABLE = 'tblgyUfaXovElkJ9s';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.AIRTABLE_CATALOGUE_TOKEN || process.env.AIRTABLE_TOKEN;
  const fields = ['Name', 'Type', 'Status', 'One-liner', 'How to use / Where to run', "Who it's for", 'Live link', 'Owner'];
  const params = new URLSearchParams();
  params.set('filterByFormula', "{Status} = 'Live'");
  fields.forEach((f, i) => params.append(`fields[${i}]`, f));
  params.set('sort[0][field]', 'Type');
  const url = `https://api.airtable.com/v0/${CATALOGUE_BASE}/${CATALOGUE_TABLE}?${params}`;

  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Airtable ${response.status}`);
    const data = await response.json();
    const tools = (data.records || [])
      // TKN builds only — Anthropic built-ins (xlsx/pdf/docx/pptx) are platform features, not company builds
      .filter(r => !String(r.fields['Owner'] || '').toLowerCase().includes('anthropic'))
      .map(r => ({
      name: r.fields['Name'],
      type: r.fields['Type'],
      oneLiner: r.fields['One-liner'] || '',
      howTo: r.fields['How to use / Where to run'] || '',
      audience: r.fields["Who it's for"] || '',
      link: r.fields['Live link'] || '',
      owner: r.fields['Owner'] || ''
    }));
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.status(200).json({ tools });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch catalogue' });
  }
}
