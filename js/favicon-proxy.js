export default async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    const size = searchParams.get("size") || "48";

    if (!targetUrl) {
      return new Response("missing url param", { status: 400 });
    }
    const host = new URL(targetUrl).hostname;

    // 多上游降级：gstaticV2 → google s2 → duckduckgo
    const upstreamList = [
      `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${targetUrl}&size=${size}`,
      `https://www.google.com/s2/favicons?domain=${host}&sz=${size}`,
      `https://icons.duckduckgo.com/ip3/${host}.ico`
    ];

    let imgRes = null;
    for (const url of upstreamList) {
      const res = await fetch(url);
      if (res.ok) {
        imgRes = res;
        break;
      }
    }

    if (!imgRes) {
      return new Response("fetch icon fail", { status: 502 });
    }

    const headers = new Headers(imgRes.headers);
    headers.set("Cache‑Control", "public, max‑age=86400");
    headers.set("Access‑Control‑Allow‑Origin", "*");
    return new Response(imgRes.body, { headers });
  } catch (err) {
    return new Response("proxy internal error", { status: 500 });
  }
};

export const config = {
  path: "/api/favicon"
};