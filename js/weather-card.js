// weather-card.js
// 功能：当前天气 + 空气质量(简评) + 逐小时预报 + 未来5日预报 + 日出日落
// 默认地点：大连 (38.914, 121.6147)
// 天地图 API Key 已内置，请务必在天地图控制台配置 HTTP Referer 白名单，防止盗用

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

    // ---------- 天地图密钥 ----------
    // ⚠️ 重要：请到 https://console.tianditu.gov.cn/ 为这个 Key 添加您的网站域名到 HTTP Referer 白名单
    // 否则他人可能盗用该 Key。白名单示例：localhost、127.0.0.1、yourdomain.com
    static TIANDITU_KEY = '5205cd59204a6ef3187772bfb75d77cf';

    _initTemplate() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    --primary-color: #2c7cb6;
                    --card-bg: rgba(255, 255, 255, 0.92);
                    --border-radius: 24px;
                    display: block;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 10000;
                    width: 90%;
                    max-width: 960px;
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
                    background: rgba(44, 124, 182, 0.15);
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
                    font-size: 1.2rem;
                    cursor: pointer;
                    border-radius: 30px;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: 0.2s;
                    line-height: 1;
                    padding: 0;
                }
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
                    flex-wrap: wrap;
                    font-size: 0.85rem;
                }
                .city-name {
                    font-weight: 600;
                    background: rgba(44,124,182,0.15);
                    padding: 4px 12px;
                    border-radius: 30px;
                    color: #1f3a5f;
                    display: inline-flex;
                    align-items: center;
                    line-height: 1.2;
                }
                .coords {
                    font-family: monospace;
                    font-size: 0.7rem;
                    opacity: 0.7;
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
                }
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
                    scrollbar-width: thin;
                    -webkit-overflow-scrolling: touch;
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
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                        padding: 0.8rem;
                    }
                    .weather-main {
                        gap: 12px;
                    }
                    .big-icon {
                        font-size: 2.6rem;
                    }
                    .temp-box .temp {
                        font-size: 2rem;
                    }
                    .info-column {
                        flex-direction: row;
                        flex-wrap: wrap;
                        justify-content: space-between;
                        gap: 8px;
                        min-width: auto;
                    }
                    .info-row {
                        flex: 1;
                        min-width: 70px;
                        justify-content: center;
                        gap: 5px;
                        font-size: 0.7rem;
                    }
                    .hour-card {
                        min-width: 60px;
                    }
                    .forecast-card {
                        min-width: 70px;
                    }
                    .sun-times {
                        font-size: 0.7rem;
                        gap: 10px;
                    }
                }
                @media (max-width: 480px) {
                    .info-column {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    .info-row {
                        justify-content: space-between;
                    }
                    .hour-card {
                        min-width: 55px;
                        padding: 4px 3px;
                    }
                    .hour-icon {
                        font-size: 1.1rem;
                    }
                    .forecast-card {
                        min-width: 65px;
                        padding: 6px 3px;
                    }
                }
            </style>

            <div class="glass-card">
                <div class="drag-header">
                    <div class="title"><span>🌤️ 天气·空气</span></div>
                    <button class="close-btn" aria-label="关闭">✕</button>
                </div>
                <div class="location-bar">
                    <div class="location-info">
                        <span class="city-name" id="cityName">定位中...</span>
                        <span class="coords" id="coordsText">--,--</span>
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
        this.$closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.remove();
        });
        this._outsideClickHandler = (e) => {
            if (!this.contains(e.target) && !e.composedPath().includes(this)) {
                this.remove();
            }
        };
        setTimeout(() => document.addEventListener('click', this._outsideClickHandler), 100);
    }

    _initDrag() {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let initialRect = null;
        const startDrag = (e) => {
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
            console.warn("定位失败，使用默认地点：大连", err.message);
            lat = 38.914;
            lon = 121.6147;
            locationFailed = true;
        }
        this.currentLat = lat;
        this.currentLon = lon;
        this.$coordsText.innerText = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
        if (locationFailed) {
            this.$cityName.innerText = "大连 (默认)";
        }
        await this._loadWeatherData(lat, lon, false);
        // 仅当城市名仍为默认“定位中...”或“大连 (默认)”时才尝试解析真实地名
        if (this.$cityName.innerText === "定位中..." || this.$cityName.innerText === "大连 (默认)") {
            this._fetchLocationName(lat, lon).catch(() => {});
        }
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
        this.$coordsText.innerText = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    }

    // 使用天地图 API 进行反向地理编码
    async _fetchLocationName(lat, lon) {
        const key = WeatherCard.TIANDITU_KEY;
        // 注意：必须为这个 Key 配置 HTTP Referer 白名单，否则请求会被拒绝
        const url = `https://api.tianditu.gov.cn/geocoder?postStr={"lon":${lon},"lat":${lat},"ver":1}&type=geocode&tk=${key}`;
        try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            if (data && data.status === "0" && data.result) {
                const result = data.result;
                let cityName = "";
                if (result.formatted_address) {
                    cityName = result.formatted_address;
                } else if (result.addressComponent) {
                    const comp = result.addressComponent;
                    cityName = [comp.city, comp.district].filter(Boolean).join("");
                    if (!cityName && comp.province) cityName = comp.province;
                }
                if (cityName && cityName !== "undefinedundefined") {
                    // 限制长度
                    cityName = cityName.length > 20 ? cityName.slice(0, 18) + ".." : cityName;
                    this.$cityName.innerText = cityName;
                } else {
                    this.$cityName.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
                }
            } else {
                console.warn("天地图返回失败", data);
                this.$cityName.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
            }
        } catch (err) {
            console.error("天地图请求异常", err);
            this.$cityName.innerText = `${lat.toFixed(1)},${lon.toFixed(1)}`;
        }
    }
}

if (!customElements.get('weather-card')) {
    customElements.define('weather-card', WeatherCard);
}