/**
 * 构建脚本：抓取 index.html 中所有 api.xinac.net 的网站图标并本地化
 * 输出：dist/ 目录（包含重写后的 index.html、图标、css、js、本地资源）
 *
 * 改进点：
 *   - 用 magic bytes 检测真实图片格式，避免服务器 Content-Type 标错导致扩展名错误
 *   - <link rel="icon"> 解析改为多标签打分，优先 ico / shortcut icon
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

const ICON_API_PATTERN = /https?:\/\/api\.xinac\.net\/icon\/\?url=([^"'&\s/]+)/g;

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

// ---------- 【新增】通过文件头检测真实图片格式 ----------
function detectImageType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // ICO:  00 00 01 00
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return '.ico';
  // CUR:  00 00 02 00（游标文件，与 ico 同源，按 ico 处理）
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x02 && buffer[3] === 0x00) return '.ico';
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return '.png';
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return '.jpg';
  // GIF:  47 49 46 38（GIF8）
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return '.gif';
  // WEBP: RIFF....WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return '.webp';
  // BMP:  42 4D
  if (buffer[0] === 0x42 && buffer[1] === 0x4D) return '.bmp';

  // SVG 是文本，检测头部
  const head = buffer.slice(0, 512).toString('utf8').toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('svg'))) return '.svg';

  return null;
}

// ---------- Content-Type → 扩展名（作为 magic bytes 检测的补充） ----------
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

// ---------- 【重写】从页面 HTML 中按优先级解析所有 icon 链接 ----------
function extractIconLinks(html, origin) {
  const results = [];
  // 匹配所有 <link ...>
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [])[1];
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    const type = (tag.match(/\btype\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!rel || !href) continue;

    const relLower = rel.toLowerCase();
    if (!relLower.includes('icon')) continue;

    let abs;
    try { abs = new URL(href, origin).href; } catch { continue; }

    let score = 0;
    if (relLower.includes('shortcut') && relLower.includes('icon')) score = 100;      // shortcut icon 最优先
    else if (relLower === 'icon') score = 80;                                          // 普通 icon
    else if (relLower.includes('apple-touch-icon')) score = 20;                        // touch icon 最后

    if (type) {
      const tl = type.toLowerCase();
      if (tl.includes('x-icon') || tl.includes('vnd.microsoft.icon')) score += 15;     // 明确 ico
      else if (tl.includes('svg')) score += 10;
      else if (tl.includes('png')) score += 5;
    }

    results.push({ href: abs, score, type: type || '' });
  }

  // 按分数降序排列
  results.sort((a, b) => b.score - a.score);
  return results.map((r) => r.href);
}

// ---------- 为一个域名抓取图标 ----------
async function fetchIcon(domain) {
  const origin = `https://${domain}`;
  const candidates = [];

  // 1) 访问首页，收集所有 icon link（按优先级排序）
  try {
    const page = await httpGet(origin, { timeout: 8000 });
    const links = extractIconLinks(page.buffer.toString('utf8'), origin);
    for (const l of links) candidates.push(l);
  } catch (err) {
    console.warn(`  [warn] 无法访问 ${domain} 首页: ${err.message}`);
  }

  // 2) 补充常见路径
  candidates.push(`${origin}/favicon.ico`);
  candidates.push(`${origin}/favicon.png`);
  candidates.push(`${origin}/apple-touch-icon.png`);

  // 去重
  const seen = new Set();
  const uniqueCandidates = candidates.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  // 3) 按顺序尝试，取第一个成功下载的
  for (const url of uniqueCandidates) {
    try {
      const res = await httpGet(url, { timeout: 8000 });
      if (res.buffer.length > 0) {
        // 【关键】优先用 magic bytes 检测真实格式
        const detectedExt = detectImageType(res.buffer);
        const contentTypeExt = extFromContentType(res.headers['content-type']);
        const ext = detectedExt || contentTypeExt;

        return {
          buffer: res.buffer,
          ext,
          source: url,
          actualFormat: detectedExt,        // 真实检测到的格式（可能为 null）
          contentType: res.headers['content-type'],
        };
      }
    } catch { /* 尝试下一个 */ }
  }

  // 4) Google 兜底（使用新版 faviconV2 接口）
    try {
        const size = 64; // 可根据需要调整为 16 / 32 / 64 / 128 / 256
        const googleUrl = `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(domain)}&size=${size}`;

        const res = await httpGet(googleUrl, { timeout: 8000 });
        if (res.buffer.length > 0) {
            const detectedExt = detectImageType(res.buffer);
            const ext = detectedExt || extFromContentType(res.headers['content-type']);
            return {
                buffer: res.buffer,
                ext,
                source: googleUrl,
                isFallback: true,
                actualFormat: detectedExt,
                contentType: res.headers['content-type'],
            };
        }
    } catch (err) {
        console.warn(`  [warn] Google 兜底失败 ${domain}: ${err.message}`);
    }

  // 5) 内置占位图
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

  const html = await fsp.readFile(SRC_HTML, 'utf8');

  // 收集所有需要下载的域名
  const domains = new Set();
  const scanRe = new RegExp(ICON_API_PATTERN.source, 'g');
  let match;
  while ((match = scanRe.exec(html)) !== null) {
    domains.add(match[1]);
  }
  const domainList = Array.from(domains);
  console.log(`📋 发现 ${domainList.length} 个域名需要下载图标`);

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

        // 日志中附上实际格式与 Content-Type，便于排查
        const detail = icon.actualFormat
          ? `实际:${icon.actualFormat}`
          : `按ContentType:${icon.contentType || '未知'}`;
        const tag = icon.isFallback ? ' [Google兜底]' : icon.source === 'placeholder' ? ' [占位图]' : '';
        console.log(`  ✅ ${domain} -> ${filename} (${icon.buffer.length}B, ${detail})${tag}`);
      } catch (err) {
        console.error(`  ❌ ${domain}: ${err.message}`);
        domainExtMap.set(domain, '.svg');
        await fsp.writeFile(path.join(DIST_ICONS, `${domain}.svg`), PLACEHOLDER_SVG);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 重写 HTML
  const rewrittenHtml = html.replace(
    new RegExp(ICON_API_PATTERN.source, 'g'),
    (_full, domain) => {
      const ext = domainExtMap.get(domain) || '.svg';
      return `images/icons/${domain}${ext}`;
    }
  );
  await fsp.writeFile(path.join(DIST, 'index.html'), rewrittenHtml);
  console.log('📄 已生成 dist/index.html');

  // 复制静态资源
  for (const dir of ['css', 'js', 'images']) {
    const src = path.join(ROOT, dir);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(DIST, dir);
    if (dir === 'images') {
      await copyDir(src, dest, new Set(['icons']));
    } else {
      await copyDir(src, dest);
    }
    console.log(`📁 已复制 ${dir}/`);
  }

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