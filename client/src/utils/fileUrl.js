export function formatFileUrl(url) {
  if (!url) return '#';
  // Already an absolute URL (Google Drive, external links)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // In production, client and server are same-origin — use relative path
  // In development, fall back to localhost:5000
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}
