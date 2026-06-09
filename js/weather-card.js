// weather-card.js
// 功能：当前天气 + 空气质量(简评) + 逐小时预报 + 未来5日预报 + 日出日落
// 默认地点：北京 (39.9042, 116.4074)
// 优先使用天地图反向地理编码，失败时自动回退到 Open‑Meteo Geocode API
// 城市名过长时自动滚动显示（固定9字符宽度）
// 逐小时/五日预报滚动条隐藏，支持鼠标拖拽滚动（PC端）

class WeatherCard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.currentLat = null;
        this.currentLon = null;
        this.abortController = null;
        this._outsideClickHandler = null;
        this._initTemplate();
        this._initElements();
        this._initEventListeners();
        this._initDrag();
    }

    static TIANDITU_KEY = '5205cd59204a6ef3187772bfb75d77cf';

    _initTemplate() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --primary-color: #2c7cb6;
                    --card-bg: rgba(255, 255, 255, 0.66);
                    --border-radius: 24px;
                    display: block;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10000;
                    width: 90%;
                    max-width: 520px;
                    min-width: 280px;
                    backdrop-filter: blur(8px);
                    font-family: 'Segoe UI', Roboto, system-ui, -apple-system, sans-serif;
                    transition: box-shadow 0.2s;
                }

                .glass-card {
                    background: var(--card-bg);
                    border-radius: var(--border-radius);
                    box-shadow: 0 20px 35px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.4) inset;
                    overflow: hidden;
                    backdrop-filter: blur(2px);
                }

                .drag-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 18px;
                    cursor: move;
                    border-bottom: 1px solid rgba(255,255,255,0.3);
                    user-select: none;
                }

                .title {
                    font-weight: 700;
                    font-size: 1.1rem;
                    color: #1e3a5f;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .close-btn {
                    background: rgba(0,0,0,0.1);
                    border: none;
                    font-size: 1.3rem;
                    cursor: pointer;
                    border-radius: 30px;
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: 0.2s;
                    line-height: 1;
                    padding: 0;
                    -webkit-tap-highlight-color: transparent;
                }
                .close-btn:active { background: rgba(0,0,0,0.25); }
                .close-btn:hover { background: rgba(0,0,0,0.2); color: #c0392b; }

                .location-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 18px;
                    background: rgba(245, 248, 250, 0.7);
                    flex-wrap: wrap;
                    gap: 8px;
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                }

                .location-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.85rem;
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                }
                .city-name {
                    font-weight: 600;
                    background: rgba(44,124,182,0.15);
                    padding: 4px 12px;
                    border-radius: 30px;
                    color: #1f3a5f;
                    display: inline-block;
                    line-height: 1.2;
                    white-space: nowrap;
                    width: 9ch;
                    overflow: hidden;
                    text-overflow: clip;
                }
                .city-name-text {
                    display: inline-block;
                    white-space: nowrap;
                    transform: translateX(0);
                }
                .city-name-text.auto-scroll {
                    animation: scrollText 10s linear infinite;
                }
                @keyframes scrollText {
                    0% { transform: translateX(0); }
                    20% { transform: translateX(0); }
                    80% { transform: translateX(calc(-100% + 9ch)); }
                    100% { transform: translateX(calc(-100% + 9ch)); }
                }
                .city-name.auto-scroll:hover {
                    animation-play-state: paused;
                }
                .coords {
                    font-family: monospace;
                    font-size: 0.7rem;
                    opacity: 0.7;
                    flex-shrink: 0;
                    white-space: nowrap;
                }
                .refresh-icon {
                    background: rgba(44,124,182,0.15);
                    border: none;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    cursor: pointer;
                    font-size: 1.1rem;
                    transition: 0.2s;
                    flex-shrink: 0;
                }
                .refresh-icon:active { background: rgba(44,124,182,0.4); }
                .refresh-icon:hover { background: #2c7cb6; color: white; transform: rotate(25deg); }

                .weather-dynamic {
                    padding: 0.8rem 1rem 1.2rem;
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .current-section {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 16px;
                    background: rgba(255,255,245,0.6);
                    border-radius: 1.5rem;
                    padding: 1rem;
                    margin-bottom: 1rem;
                    justify-content: space-between;
                    align-items: center;
                }
                .weather-main {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                    flex: 2;
                }
                .big-icon {
                    font-size: 3.2rem;
                    width: auto;
                    height: auto;
                    background: none;
                    box-shadow: none;
                    border-radius: 0;
                }
                .temp-box .temp {
                    font-size: 2.4rem;
                    font-weight: 700;
                    line-height: 1;
                    color: #1e4663;
                }
                .feels-like {
                    font-size: 0.75rem;
                    margin-top: 4px;
                    color: #2a5a7c;
                }
                .desc-badge {
                    background: #eef2fa;
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 30px;
                    margin-top: 6px;
                    font-weight: 500;
                    font-size: 0.8rem;
                }
                .sun-times {
                    display: flex;
                    gap: 12px;
                    margin-top: 8px;
                    font-size: 0.75rem;
                    color: #2a5a7c;
                }
                .sun-item {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .info-column {
                    background: rgba(210, 230, 245, 0.6);
                    border-radius: 20px;
                    padding: 10px 16px;
                    min-width: 120px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .info-row {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 0.8rem;
                    justify-content: space-between;
                }
                .info-label {
                    font-weight: 500;
                    color: #1f3a5f;
                }
                .info-value {
                    font-weight: 600;
                    color: #1e4663;
                }

                .hourly-title, .forecast-title {
                    font-weight: 600;
                    margin: 0.6rem 0 0.4rem 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #1f3a5f;
                    font-size: 0.9rem;
                }
                .hourly-scroll, .forecast-scroll {
                    display: flex;
                    overflow-x: auto;
                    gap: 10px;
                    padding: 6px 2px 10px;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;      /* Firefox */
                    -ms-overflow-style: none;   /* IE/Edge */
                    cursor: grab;
                }
                .hourly-scroll::-webkit-scrollbar, .forecast-scroll::-webkit-scrollbar {
                    display: none;              /* Chrome/Safari/Opera */
                }
                .hour-card, .forecast-card {
                    background: white;
                    text-align: center;
                    border-radius: 1rem;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                    flex-shrink: 0;
                }
                .hour-card {
                    min-width: 70px;
                    padding: 6px 4px;
                    font-size: 0.7rem;
                }
                .hour-time {
                    font-weight: 600;
                    margin-bottom: 3px;
                }
                .hour-icon {
                    font-size: 1.3rem;
                    margin: 4px 0;
                }
                .hour-temp {
                    font-weight: 700;
                }
                .hour-feels {
                    font-size: 0.6rem;
                    color: gray;
                }
                .forecast-card {
                    min-width: 80px;
                    padding: 8px 4px;
                }
                .forecast-day {
                    font-weight: 600;
                    font-size: 0.8rem;
                }
                .forecast-icon {
                    font-size: 1.6rem;
                    margin: 5px 0;
                }
                .forecast-temp {
                    font-weight: 700;
                    font-size: 0.9rem;
                }
                .forecast-temp-min {
                    font-size: 0.65rem;
                    color: gray;
                    margin-left: 3px;
                }

                .loading, .error-msg {
                    text-align: center;
                    padding: 1.5rem;
                    color: #2c5a7a;
                    font-size: 0.9rem;
                }
                .error-msg { color: #c0392b; }
                footer {
                    font-size: 0.6rem;
                    text-align: center;
                    background: rgba(0,0,0,0.03);
                    padding: 6px;
                    color: #4a627a;
                }

                @media (max-width: 640px) {
                    :host {
                        width: 95%;
                        top: 48%;
                    }
                    .drag-header {
                        padding: 10px 14px;
                    }
                    .title {
                        font-size: 1rem;
                    }
                    .close-btn {
                        width: 34px;
                        height: 34px;
                        font-size: 1.2rem;
                    }
                    .location-bar {
                        padding: 8px 14px;
                    }
                    .location-info {
                        font-size: 0.75rem;
                        gap: 6px;
                    }
                    .city-name {
                        font-size: 0.8rem;
                        padding: 3px 10px;
                    }
                    .coords {
                        font-size: 0.65rem;
                    }
                    .weather-dynamic {
                        padding: 0.6rem 0.8rem 1rem;
                    }
                    .current-section {
                        gap: 12px;
                        padding: 0.8rem;
                    }
                    .weather-main {
                        gap: 10px;
                    }
                    .big-icon {
                        font-size: 2.4rem;
                    }
                    .temp-box .temp {
                        font-size: 1.8rem;
                    }
                    .desc-badge {
                        font-size: 0.7rem;
                    }
                    .sun-times {
                        font-size: 0.65rem;
                        gap: 8px;
                    }
                    .info-column {
                        padding: 8px 12px;
                        min-width: 100px;
                        gap: 8px;
                    }
                    .info-row {
                        font-size: 0.7rem;
                        gap: 8px;
                    }
                    .hour-card {
                        min-width: 60px;
                        padding: 5px 3px;
                    }
                    .forecast-card {
                        min-width: 70px;
                        padding: 6px 3px;
                    }
                    .hour-icon {
                        font-size: 1.2rem;
                    }
                    .forecast-icon {
                        font-size: 1.4rem;
                    }
                }
                @media (max-width: 480px) {
                    .info-column {
                        min-width: 85px;
                        padding: 6px 10px;
                    }
                    .info-row {
                        font-size: 0.65rem;
                        gap: 6px;
                    }
                    .big-icon {
                        font-size: 2rem;
                    }
                    .temp-box .temp {
                        font-size: 1.6rem;
                    }
                    .desc-badge {
                        font-size: 0.65rem;
                        padding: 2px 8px;
                    }
                    .hour-card {
                        min-width: 55px;
                        font-size: 0.65rem;
                    }
                    .forecast-card {
                        min-width: 65px;
                    }
                }
            </style>

            <div class="glass-card">
                <div class="drag-header">
                    <div class="title">🌤️ 天气预报</div>
                    <button class="close-btn" aria-label="关闭">✕</button>
                </div>
                <div class="location-bar">
                    <div class="location-info">
                        <span class="city-name" id="cityName">
                            <span class="city-name-text">定位中...</span>
                        </span>
                        <span class="coords" id="coordsText">纬度: --, 经度: --</span>
                    </div>
                    <button class="refresh-icon" id="refreshWeatherBtn" title="刷新">⟳</button>
                </div>
                <div id="weatherContent" class="weather-dynamic">
                    <div class="loading">🌐 加载天气数据...</div>
                </div>
                <footer>数据: Open‑Meteo | 空气质量简评 | 逐小时预报</footer>
            </div>
        `;
    }

    _initElements() {
        this.$cityName = this.shadowRoot.getElementById('cityName');
        this.$cityNameText = this.shadowRoot.querySelector('.city-name-text');
        this.$coordsText = this.shadowRoot.getElementById('coordsText');
        this.$refreshBtn = this.shadowRoot.getElementById('refreshWeatherBtn');
        this.$closeBtn = this.shadowRoot.querySelector('.close-btn');
        this.$content = this.shadowRoot.getElementById('weatherContent');
        this.$dragHeader = this.shadowRoot.querySelector('.drag-header');
    }

    _initEventListeners() {
        this.$refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentLat && this.currentLon) {
                this._loadWeatherData(this.currentLat, this.currentLon, true);
            } else {
                this._initLocationAndWeather();
            }
        });
        // 关闭按钮同时监听 click 和 touchstart，确保移动端有效，并阻止冒泡避免拖拽冲突
        const closeHandler = (e) => {
            e.stopPropagation();
            this.remove();
        };
        this.$closeBtn.addEventListener('click', closeHandler);
        this.$closeBtn.addEventListener('touchstart', closeHandler, { passive: false });
        
        this._outsideClickHandler = (e) => {
            if (!this.contains(e.target) && !e.composedPath().includes(this)) {
                this.remove();
            }
        };
        setTimeout(() => document.addEventListener('click', this._outsideClickHandler), 100);

        // 注意：拖拽滚动绑定将在每次渲染完成后调用，这里不再调用
    }

    _initDrag() {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let initialRect = null;
        const startDrag = (e) => {
            // 如果点击的是关闭按钮或其内部，不启动拖拽
            if (e.target.closest('.close-btn')) return;
            e.preventDefault();
            isDragging = true;
            const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
            startX = clientX; startY = clientY;
            initialRect = this.getBoundingClientRect();
            initialLeft = initialRect.left;
            initialTop = initialRect.top;
            document.addEventListener('mousemove', drag);
            document.addEventListener('touchmove', drag, { passive: false });
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchend', stopDrag);
        };
        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
            const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
            const dx = clientX - startX;
            const dy = clientY - startY;
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            const vw = window.innerWidth, vh = window.innerHeight;
            const w = this.offsetWidth, h = this.offsetHeight;
            newLeft = Math.max(0, Math.min(newLeft, vw - w));
            newTop = Math.max(0, Math.min(newTop, vh - h));
            this.style.left = newLeft + 'px';
            this.style.top = newTop + 'px';
            this.style.transform = 'none';
        };
        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);
        };
        if (this.$dragHeader) {
            this.$dragHeader.addEventListener('mousedown', startDrag);
            this.$dragHeader.addEventListener('touchstart', startDrag, { passive: false });
        }
    }

    // 为滚动区域添加鼠标拖拽滚动（每次渲染后调用，确保元素存在）
    _initDragScroll() {
        const scrollContainers = ['.hourly-scroll', '.forecast-scroll'];
        scrollContainers.forEach(selector => {
            const container = this.shadowRoot.querySelector(selector);
            if (!container) return;

            // 移除旧监听避免重复（简单起见，先解绑再重新绑定，保留原容器）
            // 使用事件监听选项，确保不会重复添加
            let isDown = false;
            let startX = 0;
            let scrollLeft = 0;
            let startTime = 0;
            let velocity = 0;
            let lastX = 0;
            let lastTime = 0;
            let inertiaFrame = null;

            const stopInertia = () => {
                if (inertiaFrame) {
                    cancelAnimationFrame(inertiaFrame);
                    inertiaFrame = null;
                }
            };

            const onMouseDown = (e) => {
                stopInertia();
                isDown = true;
                startX = e.pageX - container.offsetLeft;
                scrollLeft = container.scrollLeft;
                startTime = Date.now();
                lastX = startX;
                lastTime = startTime;
                velocity = 0;
                container.style.cursor = 'grabbing';
                e.preventDefault();
            };

            const onMouseMove = (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - container.offsetLeft;
                const now = Date.now();
                const dx = x - lastX;
                const dt = Math.max(1, now - lastTime);
                velocity = dx / dt; // 像素/毫秒
                lastX = x;
                lastTime = now;
                const walk = (x - startX) * 1.5;
                container.scrollLeft = scrollLeft - walk;
            };

            const onMouseUp = () => {
                if (!isDown) return;
                isDown = false;
                container.style.cursor = 'grab';
                // 惯性滚动
                if (Math.abs(velocity) < 0.02) return;
                let lastScrollLeft = container.scrollLeft;
                let lastTimestamp = performance.now();
                let vel = velocity * 100; // 调整系数，控制惯性距离
                const decay = 0.95; // 衰减系数
                const minVel = 0.5;   // 最小速度阈值

                const step = (now) => {
                    if (!container.isConnected) {
                        inertiaFrame = null;
                        return;
                    }
                    let dt = Math.min(50, now - lastTimestamp);
                    if (dt < 5) {
                        inertiaFrame = requestAnimationFrame(step);
                        return;
                    }
                    lastTimestamp = now;
                    vel *= Math.pow(decay, dt / 16);
                    if (Math.abs(vel) < minVel) {
                        inertiaFrame = null;
                        return;
                    }
                    container.scrollLeft -= vel * (dt / 16);
                    // 边界检查（可选，到达边界时停止）
                    if (container.scrollLeft <= 0 || container.scrollLeft >= container.scrollWidth - container.clientWidth) {
                        inertiaFrame = null;
                        return;
                    }
                    inertiaFrame = requestAnimationFrame(step);
                };
                inertiaFrame = requestAnimationFrame((t) => {
                    lastTimestamp = t;
                    step(t);
                });
            };

            const onMouseLeave = () => {
                if (isDown) {
                    onMouseUp();
                }
            };

            // 移除可能存在的旧监听（避免重复绑定）
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.addEventListener('mousedown', onMouseDown);
            container.addEventListener('mousemove', onMouseMove);
            container.addEventListener('mouseup', onMouseUp);
            container.addEventListener('mouseleave', onMouseLeave);
            container.style.cursor = 'grab';
        });
    }

    async connectedCallback() {
        await this._initLocationAndWeather();
    }

    disconnectedCallback() {
        if (this._outsideClickHandler) document.removeEventListener('click', this._outsideClickHandler);
        if (this.abortController) this.abortController.abort();
    }

    async _initLocationAndWeather() {
        this.$content.innerHTML = '<div class="loading">📍 获取位置中...</div>';
        let lat, lon;
        let locationFailed = false;
        try {
            const pos = await this._getUserPosition();
            lat = pos.lat;
            lon = pos.lon;
        } catch (err) {
            console.warn("定位失败，使用默认地点：北京", err.message);
            // 北京坐标
            lat = 39.9042;
            lon = 116.4074;
            locationFailed = true;
        }
        this.currentLat = lat;
        this.currentLon = lon;
        this.$coordsText.innerText = `纬度: ${lat.toFixed(2)}, 经度: ${lon.toFixed(2)}`;
        if (locationFailed) {
            this.$cityNameText.innerText = "北京 (默认)";
        } else {
            this.$cityNameText.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        }
        this._checkCityNameOverflow();
        await this._loadWeatherData(lat, lon, false);
        this._fetchLocationName(lat, lon).catch(() => {});
    }

    _getUserPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject(new Error("浏览器不支持定位"));
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
                (err) => {
                    if (err.code === 1) reject(new Error("用户拒绝权限"));
                    else reject(new Error("定位不可用"));
                },
                { timeout: 6000, enableHighAccuracy: false }
            );
        });
    }

    async _loadWeatherData(lat, lon, showLoading = true) {
        if (showLoading) this.$content.innerHTML = '<div class="loading">🔄 刷新数据中...</div>';
        if (this.abortController) this.abortController.abort();
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relativehumidity_2m,wind_speed_10m,weathercode,apparent_temperature,us_aqi,pressure_msl&hourly=temperature_2m,apparent_temperature,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=6`;
            const resp = await fetch(url, { signal });
            if (!resp.ok) throw new Error(`API响应 ${resp.status}`);
            const data = await resp.json();
            const current = data.current;
            const hourly = data.hourly;
            const daily = data.daily;
            if (!current || !hourly || !daily) throw new Error("返回数据无效");

            this._renderFullUI(current, hourly, daily, lat, lon);
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error(err);
            this.$content.innerHTML = `<div class="error-msg">⚠️ 加载失败: ${err.message}<br><button id="retryLocal" style="margin-top:10px;background:#2c7cb6;color:white;border:none;padding:6px 16px;border-radius:30px;font-size:0.8rem;">重试</button></div>`;
            const retryBtn = this.$content.querySelector('#retryLocal');
            if (retryBtn) retryBtn.onclick = () => this._loadWeatherData(lat, lon, true);
        } finally {
            if (this.abortController?.signal === signal) this.abortController = null;
        }
    }

    _kmhToBeaufort(kmh) {
        const ms = kmh / 3.6;
        if (ms < 0.3) return 0;
        if (ms < 1.6) return 1;
        if (ms < 3.4) return 2;
        if (ms < 5.5) return 3;
        if (ms < 8.0) return 4;
        if (ms < 10.8) return 5;
        if (ms < 13.9) return 6;
        if (ms < 17.2) return 7;
        if (ms < 20.8) return 8;
        if (ms < 24.5) return 9;
        if (ms < 28.5) return 10;
        if (ms < 32.7) return 11;
        return 12;
    }

    _getAqiRating(usAqi) {
        if (usAqi === null) return "暂无";
        if (usAqi <= 50) return "优";
        if (usAqi <= 100) return "良";
        return "差";
    }

    _getWeatherInfo(code) {
        const map = {
            0: { icon: "☀️", desc: "晴" }, 1: { icon: "🌤️", desc: "主要晴朗" },
            2: { icon: "⛅", desc: "局部多云" }, 3: { icon: "☁️", desc: "阴天" },
            45: { icon: "🌫️", desc: "雾" }, 48: { icon: "🌫️", desc: "雾" },
            51: { icon: "🌦️", desc: "细雨" }, 53: { icon: "🌧️", desc: "细雨" }, 55: { icon: "🌧️", desc: "密集细雨" },
            56: { icon: "🌨️", desc: "冻细雨" },57: { icon: "🌨️", desc: "强冻细雨" },
            61: { icon: "🌧️", desc: "小雨" },63: { icon: "🌧️", desc: "中雨" },65: { icon: "🌧️", desc: "大雨" },
            66: { icon: "🌨️❄️", desc: "冻雨" },67: { icon: "🌨️❄️", desc: "强冻雨" },
            71: { icon: "❄️", desc: "小雪" },73: { icon: "❄️", desc: "中雪" },75: { icon: "❄️❄️", desc: "大雪" },
            77: { icon: "🌨️", desc: "雪粒" },80: { icon: "☔", desc: "阵雨" },81: { icon: "☔💧", desc: "强阵雨" },
            82: { icon: "💧💧", desc: "猛烈阵雨" },85: { icon: "❄️🌨️", desc: "小雪阵" },86: { icon: "❄️🌨️🌨️", desc: "大雪阵" },
            95: { icon: "⛈️", desc: "雷暴" },96: { icon: "⛈️🧊", desc: "雷暴+冰雹" },99: { icon: "⛈️🧊🧊", desc: "强雷暴" }
        };
        return map[code] || { icon: "🌡️", desc: "多变" };
    }

    _getWeekday(dateStr) {
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return weekdays[new Date(dateStr).getDay()];
    }

    _formatHour(timeStr) {
        if (!timeStr) return "";
        const date = new Date(timeStr);
        return `${date.getHours().toString().padStart(2,'0')}:00`;
    }

    _formatSunTime(isoString) {
        if (!isoString) return "--:--";
        const date = new Date(isoString);
        return `${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    }

    _checkCityNameOverflow() {
        if (!this.$cityNameText) return;
        const textEl = this.$cityNameText;
        const container = this.$cityName;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const textWidth = textEl.scrollWidth;
        if (textWidth > containerWidth) {
            textEl.classList.add('auto-scroll');
        } else {
            textEl.classList.remove('auto-scroll');
        }
    }

    _renderFullUI(current, hourly, daily, lat, lon) {
        const wInfo = this._getWeatherInfo(current.weathercode);
        const temp = Math.round(current.temperature_2m);
        const feels = Math.round(current.apparent_temperature);
        const humidity = current.relativehumidity_2m;
        const windKmh = current.wind_speed_10m;
        const windBeaufort = this._kmhToBeaufort(windKmh);
        const pressure = current.pressure_msl ? Math.round(current.pressure_msl) : null;
        const usAqi = current.us_aqi !== undefined ? Math.round(current.us_aqi) : null;
        const aqiText = this._getAqiRating(usAqi);

        let sunriseStr = "--:--", sunsetStr = "--:--";
        if (daily.sunrise && daily.sunrise.length > 0 && daily.sunset && daily.sunset.length > 0) {
            sunriseStr = this._formatSunTime(daily.sunrise[0]);
            sunsetStr = this._formatSunTime(daily.sunset[0]);
        }

        // 逐小时
        const hourlyTimes = hourly.time || [];
        const hourlyTemp = hourly.temperature_2m || [];
        const hourlyFeels = hourly.apparent_temperature || [];
        const hourlyCode = hourly.weathercode || [];
        const now = new Date();
        const currentHourIndex = hourlyTimes.findIndex(t => new Date(t) >= now);
        const startIdx = currentHourIndex === -1 ? 0 : currentHourIndex;
        const endIdx = Math.min(startIdx + 24, hourlyTimes.length);
        let hourlyHtml = "";
        if (startIdx < hourlyTimes.length) {
            let hourItems = [];
            for (let i = startIdx; i < endIdx; i++) {
                const timeLabel = this._formatHour(hourlyTimes[i]);
                const icon = this._getWeatherInfo(hourlyCode[i]).icon;
                const t = Math.round(hourlyTemp[i]);
                const feelsH = Math.round(hourlyFeels[i]);
                hourItems.push(`
                    <div class="hour-card">
                        <div class="hour-time">${timeLabel}</div>
                        <div class="hour-icon">${icon}</div>
                        <div class="hour-temp">${t}°</div>
                        <div class="hour-feels">体感 ${feelsH}°</div>
                    </div>
                `);
            }
            if (hourItems.length) {
                hourlyHtml = `
                    <div class="hourly-title">⏱️ 逐小时预报</div>
                    <div class="hourly-scroll">${hourItems.join('')}</div>
                `;
            }
        } else {
            hourlyHtml = `<div style="padding:8px;">暂无小时数据</div>`;
        }

        // 五日预报
        let forecastItems = [];
        for (let i = 1; i < daily.time.length && i <= 6; i++) {
            const maxT = Math.round(daily.temperature_2m_max[i]);
            const minT = Math.round(daily.temperature_2m_min[i]);
            const code = daily.weathercode[i];
            const { icon } = this._getWeatherInfo(code);
            forecastItems.push(`
                <div class="forecast-card">
                    <div class="forecast-day">${this._getWeekday(daily.time[i])}</div>
                    <div class="forecast-icon">${icon}</div>
                    <div class="forecast-temp">${maxT}°<span class="forecast-temp-min">${minT}°</span></div>
                </div>
            `);
        }
        const forecastHtml = forecastItems.length ? `
            <div class="forecast-title">📅 未来五日预报</div>
            <div class="forecast-scroll">${forecastItems.join('')}</div>
        ` : `<div>暂无预报数据</div>`;

        const infoColumnHtml = `
            <div class="info-column">
                <div class="info-row">
                    <span class="info-label">💧 湿度</span>
                    <span class="info-value">${humidity}%</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🌬️ 风速</span>
                    <span class="info-value">${windBeaufort} 级</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🌡️ 气压</span>
                    <span class="info-value">${pressure !== null ? pressure + " hPa" : "—"}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">🌱 空气质量</span>
                    <span class="info-value">${aqiText}</span>
                </div>
            </div>
        `;

        const sunHtml = `
            <div class="sun-times">
                <div class="sun-item">🌅 ${sunriseStr}</div>
                <div class="sun-item">🌇 ${sunsetStr}</div>
            </div>
        `;

        const mainCurrent = `
            <div class="current-section">
                <div class="weather-main">
                    <div class="big-icon">${wInfo.icon}</div>
                    <div class="temp-box">
                        <div class="temp">${temp}°C</div>
                        <div class="feels-like">体感 ${feels}°C</div>
                        <div class="desc-badge">${wInfo.desc}</div>
                        ${sunHtml}
                    </div>
                </div>
                ${infoColumnHtml}
            </div>
        `;

        this.$content.innerHTML = mainCurrent + hourlyHtml + forecastHtml;
        this.$coordsText.innerText = `纬度: ${lat.toFixed(2)}, 经度: ${lon.toFixed(2)}`;

        // 渲染完成后重新绑定拖拽滚动（因为上面 innerHTML 重建了 .hourly-scroll 和 .forecast-scroll 元素）
        this._initDragScroll();
    }

    async _fetchLocationName(lat, lon) {
        // 尝试天地图
        try {
            const key = WeatherCard.TIANDITU_KEY;
            const url = `https://api.tianditu.gov.cn/geocoder?postStr={"lon":${lon},"lat":${lat},"ver":1}&type=geocode&tk=${key}`;
            const resp = await fetch(url);
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.status === "0" && data.result) {
                    let cityName = data.result.formatted_address || (data.result.addressComponent?.city + data.result.addressComponent?.district) || null;
                    if (cityName && cityName !== "undefinedundefined") {
                        cityName = cityName.length > 30 ? cityName.slice(0, 28) + "…" : cityName;
                        this.$cityNameText.innerText = cityName;
                        this._checkCityNameOverflow();
                        return;
                    }
                }
            }
            console.warn("天地图失败，回退到 Open-Meteo");
        } catch (e) {
            console.warn("天地图异常:", e);
        }

        // 备用：Open-Meteo Geocode
        try {
            const geoUrl = `https://api.open-meteo.com/v1/geocode?latitude=${lat}&longitude=${lon}&count=1&language=zh`;
            const resp = await fetch(geoUrl);
            if (resp.ok) {
                const data = await resp.json();
                if (data.results && data.results.length > 0) {
                    const loc = data.results[0];
                    let full = (loc.name || '') + (loc.admin1 ? `, ${loc.admin1}` : '') + (loc.country ? `, ${loc.country}` : '');
                    if (full.length > 30) full = full.slice(0, 28) + '…';
                    this.$cityNameText.innerText = full;
                    this._checkCityNameOverflow();
                    return;
                }
            }
            this.$cityNameText.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        } catch (err) {
            console.error("地理编码失败:", err);
            this.$cityNameText.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        }
        this._checkCityNameOverflow();
    }
}

if (!customElements.get('weather-card')) {
    customElements.define('weather-card', WeatherCard);
}