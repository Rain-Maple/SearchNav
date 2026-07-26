(function() {
    'use strict';

    // ==================== DOM 引用 ====================
    const dateElem = document.getElementById('show_date');
    const timeElem = document.getElementById('show_time');
    const lunarElem = document.getElementById('show_lunar');

    // ==================== 日期时间更新 ====================
    let lastDateStr = '';

    function updateDateInfo() {
        if (!dateElem) return;
        const now = new Date();
        const formattedDate = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedWeekday = now.toLocaleDateString('zh-CN', { weekday: 'long' });
        dateElem.textContent = `${formattedDate} ${formattedWeekday}`;
    }

    function updateTimeInfo() {
        if (!timeElem) return;
        const now = new Date();
        const formattedTime = now.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
        });
        timeElem.textContent = formattedTime;

        // 检测日期是否变化（跨天）
        const todayStr = now.toDateString();
        if (lastDateStr && lastDateStr !== todayStr) {
            updateDateInfo();
            if (typeof Solar !== 'undefined') {
                updateLunarDateInfo();
            } else {
                ensureLunarLibrary();
            }
        }
        lastDateStr = todayStr;
    }

    // ==================== 农历更新（适配 lunar-javascript） ====================
    function updateLunarDateInfo() {
        if (!lunarElem) return;

        if (typeof Solar === 'undefined') {
            lunarElem.textContent = '农历信息不可用（库未加载）';
            return;
        }

        try {
            const now = new Date();
            const solar = Solar.fromDate(now);
            const lunar = solar.getLunar();

            // 月份（中文，含闰月）
            let monthChinese = lunar.getMonthInChinese(); // 如 "正月" 或 "闰二月"
            if (monthChinese.endsWith('月')) {
                monthChinese = monthChinese.slice(0, -1);
            }

            // 日期（中文）
            const dayChinese = lunar.getDayInChinese(); // 如 "初一"

            // 生肖
            const zodiac = lunar.getYearShengXiao();

            lunarElem.textContent = `农历 ${monthChinese}月${dayChinese} | ${zodiac}年`;
        } catch (error) {
            console.error('更新农历信息失败:', error);
            lunarElem.textContent = '农历信息不可用';
        }
    }

    // ==================== 库加载保障 ====================
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRY = 30; // 最多重试30秒

    function ensureLunarLibrary() {
        if (typeof Solar !== 'undefined') {
            updateLunarDateInfo();
            if (retryTimer) {
                clearInterval(retryTimer);
                retryTimer = null;
            }
            return true;
        }

        if (!retryTimer && retryCount < MAX_RETRY) {
            retryTimer = setInterval(() => {
                retryCount++;
                if (typeof Solar !== 'undefined') {
                    clearInterval(retryTimer);
                    retryTimer = null;
                    updateLunarDateInfo();
                } else if (retryCount >= MAX_RETRY) {
                    clearInterval(retryTimer);
                    retryTimer = null;
                    if (lunarElem) {
                        lunarElem.textContent = '农历信息不可用（加载超时）';
                    }
                    console.warn('lunar-javascript 库加载超时');
                }
            }, 1000);
        }
        return false;
    }

    // ==================== 初始化 ====================
    function init() {
        updateDateInfo();
        updateTimeInfo();
        ensureLunarLibrary();

        // 每秒更新一次时间（内部会检测跨天）
        setInterval(updateTimeInfo, 1000);
    }

    // 确保 DOM 加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();