/**
 * 构建脚本：抓取 index.html 中所有 api.xinac.net 的网站图标并本地化
 * 输出：dist/ 目录（包含重写后的 index.html、图标、css、js、本地资源）
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const SRC_HTML = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const DIST_ICONS = path.join(DIST, 'images', 'icons');

// 匹配形如 https://api.xinac.net/icon/?url=www.baidu.com/
// 捕获组 1 = 域名（不含末尾斜杠、引号、&等）
const ICON_API_PATTERN = /https?:\/\/api\.xinac\.net\/icon\/\?url=([^"'&\s/]+)/g;

// 内置占位图标（灰底问号 SVG）
const PLACEHOLDER_SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="12" fill="#e0e0e0"/>' +
  '<text x="32" y="40" font-family="Arial, sans-serif" font-size="28" fill="#999" text-anchor="middle">?</text>' +
  '</svg>'
);

// ---------- HTTP 下载 ----------
function httpGet(url, { timeout = 10000, maxRedirects = 3 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('无效 URL: ' + url)); }

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DHX-IconFetcher/1.0)',
        'Accept': 'image/*,text/html,*/*',
      },
      timeout,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).href;
        return httpGet(nextUrl, { timeout, maxRedirects: maxRedirects - 1 }).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`超时: ${url}`)));
  });
}

// ---------- Content-Type → 扩展名 ----------
function extFromContentType(ct) {
  ct = (ct || '').toLowerCase();
  if (ct.includes('svg')) return '.svg';
  if (ct.includes('png')) return '.png';
  if (ct.includes('jpeg') || ct.includes('jpg')) return '.jpg';
  if (ct.includes('gif')) return '.gif';
  if (ct.includes('webp')) return '.webp';
  if (ct.includes('icon') || ct.includes('vnd.microsoft')) return '.ico';
  return '.png';
}

// ---------- 从页面 HTML 中解析 <link rel="icon"> ----------
function extractIconLink(html, origin) {
  const patterns = [
    /<link[^>]+rel=["'](?:shortcut\s+icon|icon)["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut\s+icon|icon)["']/i,
    /<link[^>]+rel=["']apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      try { return new URL(m[1], origin).href; } catch { /* ignore */ }
    }
  }
  return null;
}

// ---------- 为一个域名抓取图标 ----------
async function fetchIcon(domain) {
  const origin = `https://${domain}`;
  const candidates = [];

  // 1) 访问首页，解析 HTML 中的 <link rel="icon">
  try {
    const page = await httpGet(origin, { timeout: 8000 });
    const iconLink = extractIconLink(page.buffer.toString('utf8'), origin);
    if (iconLink) candidates.push(iconLink);
  } catch (err) {
    console.warn(`  [warn] 无法访问 ${domain} 首页: ${err.message}`);
  }

  // 2) 常见回退路径
  candidates.push(`${origin}/favicon.ico`);
  candidates.push(`${origin}/favicon.png`);
  candidates.push(`${origin}/apple-touch-icon.png`);

  for (const url of candidates) {
    try {
      const res = await httpGet(url, { timeout: 8000 });
      if (res.buffer.length > 0) {
        return {
          buffer: res.buffer,
          ext: extFromContentType(res.headers['content-type']),
          source: url,
        };
      }
    } catch { /* 尝试下一个 */ }
  }

  // 3) Google favicon 服务兜底（仅构建时一次性请求）
  try {
    const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
    const res = await httpGet(googleUrl, { timeout: 8000 });
    if (res.buffer.length > 0) {
      return {
        buffer: res.buffer,
        ext: extFromContentType(res.headers['content-type']),
        source: googleUrl,
        isFallback: true,
      };
    }
  } catch (err) {
    console.warn(`  [warn] Google 兜底失败 ${domain}: ${err.message}`);
  }

  // 4) 使用内置占位图
  return { buffer: PLACEHOLDER_SVG, ext: '.svg', source: 'placeholder' };
}

// ---------- 递归复制目录 ----------
async function copyDir(src, dest, exclude = new Set()) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fsp.copyFile(s, d);
  }
}

// ---------- 主流程 ----------
async function main() {
  console.log('🚀 开始构建：本地化网站图标...');

  // 读取源 HTML
  const html = await fsp.readFile(SRC_HTML, 'utf8');

  // 1) 收集所有需要下载的域名
  const domains = new Set();
  const scanRe = new RegExp(ICON_API_PATTERN.source, 'g');
  let match;
  while ((match = scanRe.exec(html)) !== null) {
    domains.add(match[1]);
  }
  const domainList = Array.from(domains);
  console.log(`📋 发现 ${domainList.length} 个域名需要下载图标`);

  // 2) 并发下载（最多 6 并发）
  await fsp.mkdir(DIST_ICONS, { recursive: true });
  await fsp.writeFile(path.join(DIST_ICONS, 'default.svg'), PLACEHOLDER_SVG);

  const domainExtMap = new Map();
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < domainList.length) {
      const domain = domainList[cursor++];
      try {
        const icon = await fetchIcon(domain);
        const filename = `${domain}${icon.ext}`;
        await fsp.writeFile(path.join(DIST_ICONS, filename), icon.buffer);
        domainExtMap.set(domain, icon.ext);
        console.log(`  ✅ ${domain} -> ${filename} (${icon.buffer.length}B)${icon.isFallback ? ' [Google兜底]' : ''}`);
      } catch (err) {
        console.error(`  ❌ ${domain}: ${err.message}`);
        domainExtMap.set(domain, '.svg');
        await fsp.writeFile(path.join(DIST_ICONS, `${domain}.svg`), PLACEHOLDER_SVG);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 3) 重写 HTML 中的图标 src
  const rewrittenHtml = html.replace(
    new RegExp(ICON_API_PATTERN.source, 'g'),
    (_full, domain) => {
      const ext = domainExtMap.get(domain) || '.svg';
      return `images/icons/${domain}${ext}`;
    }
  );
  await fsp.writeFile(path.join(DIST, 'index.html'), rewrittenHtml);
  console.log('📄 已生成 dist/index.html');

  // 4) 复制静态资源
  for (const dir of ['css', 'js', 'images']) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(DIST, dir);
    if (dir === 'images') {
      // 复制 images/ 但跳过 icons 子目录（避免覆盖刚下载的图标）
      await copyDir(src, dest, new Set(['icons']));
    } else {
      await copyDir(src, dest);
    }
    console.log(`📁 已复制 ${dir}/`);
  }

  // 5) 复制 favicon.ico（如果存在）
  const faviconSrc = path.join(ROOT, 'favicon.ico');
  if (fs.existsSync(faviconSrc)) {
    await fsp.copyFile(faviconSrc, path.join(DIST, 'favicon.ico'));
    console.log('📁 已复制 favicon.ico');
  }

  console.log('🎉 构建完成！输出目录: dist/');
}

main().catch((err) => {
  console.error('❌ 构建失败:', err);
  process.exit(1);
});