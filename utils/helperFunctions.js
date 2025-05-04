// utils/extractLinkId.js
export function extractGoogleId(urlOrId) {
  if (!urlOrId) return null;
  if (/^[\w-]{20,}$/.test(urlOrId)) return urlOrId;
  const patterns = [
    /\/folders\/([\w-]+)/,   // Drive folder URL
    /\/d\/([\w-]+)/,         // /d/FILE_ID/ or /d/SPREADSHEET_ID/
  ];
  for (const re of patterns) {
    const m = urlOrId.match(re);
    if (m) return m[1];
  }
  return null;
}