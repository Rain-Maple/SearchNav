export default async (req) => {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    const size = searchParams.get("size") || "48";

    if (!targetUrl) {
        return new Response("missing url param", { status: 400 });
    }

    // 优先 duckduckgo 源，你也可以换成 t0.gstatic.cn
    // const upstream = `https://icons.duckduckgo.com/ip3/${new URL(targetUrl).hostname}.ico`;
    const upstream = `https://t0.gstatic.cn/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${targetUrl}&size=${size}`;
    
    const imgRes = await fetch(upstream);
    if (!imgRes.ok) return new Response("fetch icon fail", { status: 502 });

    // 缓存 + CORS 头，静态页面直接引用无跨域问题
    const headers = new Headers(imgRes.headers);
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("Access-Control-Allow-Origin", "*");

    return new Response(imgRes.body, { headers });
};

export const config = {
    path: "/api/favicon"
};