const MIME_LOOKUP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.json5': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

const extensionOf = (path: string): string => {
  const match = /\.([^.\/]+)$/.exec(path);
  return match ? `.${match[1].toLowerCase()}` : '';
};

export function inferMimeType(path: string): string {
  const ext = extensionOf(path);
  if (ext && MIME_LOOKUP[ext]) return MIME_LOOKUP[ext];
  if (/\.m?js$/i.test(path)) return 'application/javascript; charset=utf-8';
  if (/\.json$/i.test(path)) return 'application/json; charset=utf-8';
  if (/\.html?$/i.test(path)) return 'text/html; charset=utf-8';
  if (/\.css$/i.test(path)) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}
