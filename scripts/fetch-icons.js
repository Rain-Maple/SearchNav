/**
 * 构建脚本：通过第三方服务获取网站图标并本地化
 * 数据源（按顺序尝试）：
 *   1. Google faviconV2
 *   2. DuckDuckGo icons
 *   3. api.xinac.net
 * 最终回退：内置占位 SVG
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

// 匹配 index.html 中所有需要本地化的图标域名
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
        'Accept': 'image/*,*/*',
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

// ---------- 通过文件头判断真实图片格式 ----------
function detectImageType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00) return '.ico';
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x02 && buffer[3] === 0x00) return '.ico';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return '.png';
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return '.jpg';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return '.gif';
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return '.webp';
  const head = buffer.slice(0, 512).toString('utf8').toLowerCase();
  if (head.includes('<svg') || (head.includes('<?xml') && head.includes('svg'))) return '.svg';
  return null;
}

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

// ---------- 构造三个服务的 URL ----------
function buildServiceUrls(domain) {
  const encoded = encodeURIComponent(domain);
  const encodedWithProtocol = encodeURIComponent(`https://${domain}`);

  return [
    // 1) Google faviconV2
    `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=64`,
    // 2) DuckDuckGo（注意 .ico 后缀是接口格式的一部分，不是真实格式）
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    // 3) api.xinac.net
    `https://api.xinac.net/icon/?url=${domain}/`,
  ];
}

// ---------- 通过三个服务依次尝试获取图标 ----------
async function fetchIcon(domain) {
  const urls = buildServiceUrls(domain);

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const sourceLabel = ['Google faviconV2', 'DuckDuckGo', 'api.xinac.net'][i];
    try {
      const res = await httpGet(url, { timeout: 8000 });
      if (!res.buffer || res.buffer.length === 0) continue;

      // 有些服务即使找不到图标也会返回一张默认占位图（非 2xx 之外）
      // 这里通过文件头检测来过滤明显不是图标的响应（例如 HTML 错误页）
      const detectedExt = detectImageType(res.buffer);
      if (!detectedExt) {
        console.warn(`  [warn] ${sourceLabel} 返回内容不是有效图片 (${domain}), 继续下一个`);
        continue;
      }

      return {
        buffer: res.buffer,
        ext: detectedExt,
        source: sourceLabel,
        url,
      };
    } catch (err) {
      // 单个服务失败不中断，继续尝试下一个
      continue;
    }
  }

  // 全部失败
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
  console.log('🚀 开始构建：通过第三方服务获取网站图标...');

  const html = await fsp.readFile(SRC_HTML, 'utf8');

  const domains = new Set();
  const scanRe = new RegExp(ICON_API_PATTERN.source, 'g');
  let match;
  while ((match = scanRe.exec(html)) !== null) {
    domains.add(match[1]);
  }
  const domainList = Array.from(domains);
  console.log(`📋 发现 ${domainList.length} 个域名需要获取图标`);

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

        const tag = icon.source === 'placeholder' ? ' [占位图]' : ` [${icon.source}]`;
        console.log(`  ✅ ${domain} -> ${filename} (${icon.buffer.length}B)${tag}`);
      } catch (err) {
        console.error(`  ❌ ${domain}: ${err.message}`);
        domainExtMap.set(domain, '.svg');
        await fsp.writeFile(path.join(DIST_ICONS, `${domain}.svg`), PLACEHOLDER_SVG);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // 重写 HTML 中的图标地址
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