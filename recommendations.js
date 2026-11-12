const recommendationApi = 'https://oimdeoszgxfumwtmapok.supabase.co/rest/v1';
const recommendationKey = 'sb_publishable_ZovEIH8JuRiKuf24MTIKLg_sz2Tnui8';
async function recommendationRequest(path, options = {}) {
  const response = await fetch(recommendationApi + path, {
    signal: AbortSignal.timeout(5000),
    ...options,
    headers: { apikey: recommendationKey, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) throw new Error(String(response.status));
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
