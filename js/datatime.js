// 获取农历对象的辅助函数
function getLunarInstance() {
    if (typeof Lunar !== 'undefined') {
        return Lunar;
    } else if (typeof window.Lunar !== 'undefined') {
        return window.Lunar;
    }
    return null;
}

// 数字转中文数字
function numberToChinese(num) {
    const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    return chineseNumbers[num] || num.toString();
}

// 农历月份转换
function lunarMonthToChinese(month) {
    if (typeof month === 'string') {
// 如果已经是中文，直接返回
        if (['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '腊', '十二'].includes(month)) {
            return month;
        }
// 如果是“正月”、“二月”等格式
        if (month.endsWith('月')) {
            return month.replace('月', '');
        }
    }
// 数字转中文
    const num = parseInt(month);
    if (!isNaN(num) && num >= 1 && num <= 12) {
        const chineseMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
        return chineseMonths[num - 1];
    }
    return month; // 如果无法转换，返回原值
}

function updateLunarDateInfo() {
    const now = new Date();
// 获取农历日期
    let lunarDateStr = '';
    try {
        const LunarObj = getLunarInstance();
        if (!LunarObj) {
            throw new Error('Lunar库未加载');
        }

        const lunar = LunarObj.formatDate(now);

        // 获取农历月份和日期
        let yearName = '', monthName = '', dayName = '', zodiac = '';
        // 获取年份
        if (typeof lunar.getYear === 'function') {
            yearName = lunar.getYear();
        } else if (typeof lunar.year === 'function') {
            yearName = lunar.year();
        } else if (typeof lunar.getYearName === 'function') {
            yearName = lunar.getYearName();
        }

        // 获取月份 - 转换为中文
        let monthValue = '';
        if (typeof lunar.getMonth === 'function') {
            monthValue = lunar.getMonth();
        } else if (typeof lunar.month === 'function') {
            monthValue = lunar.month();
        } else if (typeof lunar.getMonthName === 'function') {
            monthValue = lunar.getMonthName();
        }
        monthName = lunarMonthToChinese(monthValue);

        // 获取日期 - 转换为中文
        let dayValue = '';
        if (typeof lunar.getDay === 'function') {
            dayValue = lunar.getDay();
        } else if (typeof lunar.day === 'function') {
            dayValue = lunar.day();
        } else if (typeof lunar.getDayName === 'function') {
            dayValue = lunar.getDayName();
        }
        dayName = numberToChinese(parseInt(dayValue));

        // 获取生肖
        let zodiacValue = '';
        if (typeof lunar.getZodiac === 'function') {
            zodiacValue = lunar.getZodiac();
        } else if (typeof lunar.zodiac === 'function') {
            zodiacValue = lunar.zodiac();
        } else if (typeof lunar.getZodiacName === 'function') {
            zodiacValue = lunar.getZodiacName();
        } else if (typeof lunar.getYearZodiac === 'function') {
            zodiacValue = lunar.getYearZodiac();
        } else if (typeof lunar.getAnimal === 'function') {
            zodiacValue = lunar.getAnimal();
        } else if (typeof lunar.animal === 'function') {
            zodiacValue = lunar.animal();
        }
        zodiac = zodiacValue;

        // 构建农历日期字符串
        lunarDateStr = `农历 ${monthName}月${dayName}日 (${zodiac}年)`;
    } catch (error) {
        console.error('获取农历日期失败:', error);
        lunarDateStr = '农历信息不可用';
    }

    // 更新农历日期显示内容
    document.getElementById('show_lunar').textContent = lunarDateStr;
}

function updateDateInfo() {
    const now = new Date();
    // 格式化日期和星期
    const dateOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);

    const weekOptions = {
        weekday: 'long'
    };
    const formattedWeekday = now.toLocaleDateString('zh-CN', weekOptions);

    // 合并日期和星期
    const combinedDisplay = `${formattedDate} ${formattedWeekday}`;

    // 更新日期和星期显示内容
    document.getElementById('show_date').textContent = combinedDisplay;
}

function updateTimeInfo() {
    const now = new Date();
    // 格式化时间
    const timeOptions = {
        hour12: false,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    };
    const formattedTime = now.toLocaleTimeString('zh-CN', timeOptions);

    // 更新时间显示内容
    document.getElementById('show_time').textContent = formattedTime;
}

// 初始加载时更新日期、时间和农历日期
updateDateInfo();
updateTimeInfo();
updateLunarDateInfo();

// 每秒更新一次时间
setInterval(updateTimeInfo, 1000);