// ==================== 工具函数 ====================

/**
 * 将数字（1~30）转换为中文数字，支持“初一”~“三十”
 * @param {number|string} num - 数字或数字字符串
 * @returns {string} 中文数字
 */
function numberToChinese(num) {
    // 如果是字符串且包含非数字字符（如“初一”），直接返回原值
    if (typeof num === 'string' && !/^\d+$/.test(num)) {
        return num;
    }
    const n = parseInt(num, 10);
    if (isNaN(n) || n < 1 || n > 30) {
        // 超出范围时尝试返回原字符串
        return String(num);
    }
    const chineseDigits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                           '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九',
                           '二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六',
                           '二十七', '二十八', '二十九', '三十'];
    return chineseDigits[n - 1]; // 索引0对应数字1
}

/**
 * 将农历月份（数字或中文）转换为中文月份，支持闰月
 * @param {string|number} month - 月份值（如 1, '正月', '闰正月'）
 * @returns {string} 中文月份（不含“月”字，如“正”、“闰正”）
 */
function lunarMonthToChinese(month) {
    if (typeof month === 'string') {
        // 检查是否已包含“闰”字
        const isLeap = month.startsWith('闰');
        let baseMonth = isLeap ? month.slice(1) : month;
        // 如果已经是中文（如“正月”、“二月”），去掉“月”字
        if (baseMonth.endsWith('月')) {
            baseMonth = baseMonth.slice(0, -1);
        }
        // 如果去掉“月”后是纯中文数字（如“正”、“二”），直接返回（保留闰前缀）
        if (['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'].includes(baseMonth)) {
            return isLeap ? `闰${baseMonth}` : baseMonth;
        }
        // 否则尝试按数字处理（如“闰1”）
        const num = parseInt(baseMonth, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) {
            const chineseMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
            const result = chineseMonths[num - 1];
            return isLeap ? `闰${result}` : result;
        }
        // 无法转换则返回原值（但去掉可能多余的“月”）
        return month.replace(/月$/, '');
    }
    // 数字类型处理
    if (typeof month === 'number') {
        const chineseMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
        return chineseMonths[month - 1] || String(month);
    }
    return String(month);
}

// ==================== 农历库加载与获取 ====================

let lunarLibraryReady = false;          // 标记库是否已加载
let lunarRetryTimer = null;             // 重试定时器句柄
const MAX_RETRY_ATTEMPTS = 30;          // 最多重试30次（30秒）
let retryCount = 0;

/**
 * 获取农历对象（支持多种命名方式）
 * @returns {object|null} 农历库对象或 null
 */
function getLunarInstance() {
    // 常见的全局命名
    const names = ['Lunar', 'window.Lunar', 'window.lunar', 'window.LunarCalendar', 'window.lunarCalendar'];
    for (const name of names) {
        try {
            // 使用 eval 或动态获取
            const parts = name.split('.');
            let obj = typeof window !== 'undefined' ? window : globalThis;
            for (const part of parts) {
                if (obj && typeof obj[part] !== 'undefined') {
                    obj = obj[part];
                } else {
                    obj = null;
                    break;
                }
            }
            if (obj) {
                return obj;
            }
        } catch (e) {
            // 忽略
        }
    }
    // 直接检查全局
    if (typeof Lunar !== 'undefined') return Lunar;
    if (typeof window !== 'undefined' && window.Lunar) return window.Lunar;
    return null;
}

/**
 * 尝试初始化农历库，若未加载则设置重试
 */
function ensureLunarLibrary() {
    const instance = getLunarInstance();
    if (instance) {
        lunarLibraryReady = true;
        if (lunarRetryTimer) {
            clearInterval(lunarRetryTimer);
            lunarRetryTimer = null;
        }
        // 加载成功后立即更新农历信息
        updateLunarDateInfo();
        return true;
    }
    // 如果尚未加载，启动重试机制（每秒一次）
    if (!lunarRetryTimer && retryCount < MAX_RETRY_ATTEMPTS) {
        lunarRetryTimer = setInterval(() => {
            retryCount++;
            const inst = getLunarInstance();
            if (inst) {
                lunarLibraryReady = true;
                clearInterval(lunarRetryTimer);
                lunarRetryTimer = null;
                updateLunarDateInfo();
            } else if (retryCount >= MAX_RETRY_ATTEMPTS) {
                clearInterval(lunarRetryTimer);
                lunarRetryTimer = null;
                console.warn('农历库加载超时，将不再重试');
                // 显示错误信息
                const elem = document.getElementById('show_lunar');
                if (elem) elem.textContent = '农历信息不可用（库未加载）';
            }
        }, 1000);
    }
    return false;
}

// ==================== 日期时间更新核心函数 ====================

let lastDateStr = ''; // 用于检测日期是否变化

/**
 * 更新日期显示（年月日 + 星期）
 */
function updateDateInfo() {
    const now = new Date();
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);
    const weekOptions = { weekday: 'long' };
    const formattedWeekday = now.toLocaleDateString('zh-CN', weekOptions);
    const combinedDisplay = `${formattedDate} ${formattedWeekday}`;

    const elem = document.getElementById('show_date');
    if (elem) elem.textContent = combinedDisplay;
}

/**
 * 更新时间显示（时分秒，24小时制）
 */
function updateTimeInfo() {
    const now = new Date();
    const timeOptions = { hour12: false, hour: 'numeric', minute: '2-digit', second: '2-digit' };
    const formattedTime = now.toLocaleTimeString('zh-CN', timeOptions);
    const elem = document.getElementById('show_time');
    if (elem) elem.textContent = formattedTime;

    // 检测日期是否变化（跨天），若变化则刷新日期和农历
    const todayStr = now.toDateString();
    if (lastDateStr && lastDateStr !== todayStr) {
        updateDateInfo();
        if (lunarLibraryReady) {
            updateLunarDateInfo();
        } else {
            ensureLunarLibrary(); // 如果库尚未就绪，重试
        }
    }
    lastDateStr = todayStr;
}

/**
 * 更新农历日期显示
 */
function updateLunarDateInfo() {
    const lunarElem = document.getElementById('show_lunar');
    if (!lunarElem) return;

    try {
        const LunarObj = getLunarInstance();
        if (!LunarObj) {
            throw new Error('Lunar库未加载');
        }

        const now = new Date();
        // 调用 formatDate，可能返回对象
        const lunar = LunarObj.formatDate(now);
        if (!lunar || typeof lunar !== 'object') {
            throw new Error('formatDate 返回无效对象');
        }

        // ---- 获取年份（如果需要可后续使用，此处仅用于生肖） ----
        // 但生肖通常由年份计算，因此保留 zodiac 获取

        // ---- 获取月份 ----
        let monthValue = '';
        // 按优先级尝试常见方法
        if (typeof lunar.getMonth === 'function') {
            monthValue = lunar.getMonth();
        } else if (typeof lunar.month === 'function') {
            monthValue = lunar.month();
        } else if (typeof lunar.getMonthName === 'function') {
            monthValue = lunar.getMonthName();
        } else if (typeof lunar.getLunarMonth === 'function') {
            monthValue = lunar.getLunarMonth();
        }
        // 若 monthValue 是数字，转为字符串
        const monthChinese = lunarMonthToChinese(monthValue);

        // ---- 获取日期 ----
        let dayValue = '';
        if (typeof lunar.getDay === 'function') {
            dayValue = lunar.getDay();
        } else if (typeof lunar.day === 'function') {
            dayValue = lunar.day();
        } else if (typeof lunar.getDayName === 'function') {
            dayValue = lunar.getDayName();
        } else if (typeof lunar.getLunarDay === 'function') {
            dayValue = lunar.getLunarDay();
        }
        // 如果 dayValue 是数字，转为中文；否则直接使用（可能已中文）
        let dayChinese = '';
        if (typeof dayValue === 'number' || /^\d+$/.test(dayValue)) {
            dayChinese = numberToChinese(parseInt(dayValue, 10));
        } else {
            dayChinese = dayValue; // 已经是中文如“初一”
        }
        // 如果 dayChinese 仍为空，尝试使用 getDate 等
        if (!dayChinese && typeof lunar.getDate === 'function') {
            const d = lunar.getDate();
            dayChinese = numberToChinese(parseInt(d, 10));
        }

        // ---- 获取生肖 ----
        let zodiac = '';
        // 按优先级尝试
        const zodiacMethods = ['getZodiac', 'zodiac', 'getZodiacName', 'getYearZodiac', 'getAnimal', 'animal'];
        for (const method of zodiacMethods) {
            if (typeof lunar[method] === 'function') {
                const val = lunar[method]();
                if (val && typeof val === 'string') {
                    zodiac = val;
                    break;
                }
            }
        }
        // 如果仍未获取到，尝试从年份推算（备用方案）
        if (!zodiac) {
            // 获取年份数字
            let yearNum = null;
            if (typeof lunar.getYear === 'function') {
                yearNum = lunar.getYear();
            } else if (typeof lunar.year === 'function') {
                yearNum = lunar.year();
            }
            if (typeof yearNum === 'number') {
                const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
                const offset = (yearNum - 4) % 12;
                zodiac = zodiacs[offset >= 0 ? offset : offset + 12];
            }
        }

        // ---- 构建农历字符串 ----
        // 月份与日期组合，若有闰月则已在 monthChinese 中包含“闰”字
        let lunarStr = `农历 ${monthChinese}月${dayChinese}日`;
        if (zodiac) {
            lunarStr += ` (${zodiac}年)`;
        }
        lunarElem.textContent = lunarStr;
    } catch (error) {
        console.error('获取农历日期失败:', error);
        lunarElem.textContent = '农历信息不可用';
    }
}

// ==================== 初始化 ====================

// 立即更新日期和时间
updateDateInfo();
updateTimeInfo();

// 尝试加载农历库（如果已经存在则直接更新，否则启动重试）
if (!ensureLunarLibrary()) {
    // 如果库未就绪，先显示占位信息
    const lunarElem = document.getElementById('show_lunar');
    if (lunarElem) lunarElem.textContent = '农历加载中...';
}

// 每秒更新一次时间（并在内部检测日期变化）
setInterval(updateTimeInfo, 1000);