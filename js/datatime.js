// 获取Lunar对象
function getLunarInstance() {
    return (typeof Lunar !== 'undefined') ? Lunar : (window.Lunar || null);
}

// 数字转中文数字（1~30）
function numberToChinese(num) {
    const chineseNums = [
        '零', '一', '二', '三', '四', '五', '六', '七', '八', '九',
        '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九',
        '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
    ];
    return chineseNums[num] || num.toString();
}

// 农历月份转中文
function lunarMonthToChinese(month) {
    const chineseMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'];
    if (typeof month === 'string') {
        // 如果已经是中文月份（可能带“月”字）
        if (month.includes('月')) {
            return month.replace('月', '');
        }
        // 尝试数字解析
        const num = parseInt(month, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) {
            return chineseMonths[num - 1];
        }
        return month;
    } else if (typeof month === 'number') {
        return chineseMonths[month - 1] || month.toString();
    }
    return month;
}

// 更新日期（公历 + 星期 + 农历月日）
function updateDateInfo() {
    const now = new Date();

    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const weekOptions = { weekday: 'long' };
    const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);
    const formattedWeek = now.toLocaleDateString('zh-CN', weekOptions);

    let lunarStr = '';
    try {
        const LunarObj = getLunarInstance();
        if (!LunarObj) throw new Error('Lunar库未加载');
        const lunar = LunarObj.fromDate(now);

        // 获取农历月份和日期（数字）
        const monthNum = (typeof lunar.getMonth === 'function') ? lunar.getMonth() :
                         (typeof lunar.month === 'function') ? lunar.month() : 1;
        const dayNum = (typeof lunar.getDay === 'function') ? lunar.getDay() :
                       (typeof lunar.day === 'function') ? lunar.day() : 1;

        const monthChinese = lunarMonthToChinese(monthNum);
        const dayChinese = numberToChinese(dayNum);
        lunarStr = `${monthChinese}月${dayChinese}日`;
    } catch (e) {
        console.error('农历转换错误:', e);
        lunarStr = '日期获取失败';
    }

    document.getElementById('show_date').textContent = `${formattedDate} ${formattedWeek} ${lunarStr}`;
}

// 更新时间（每秒）
function updateTime() {
    const now = new Date();
    const timeOptions = { hour12: false, hour: 'numeric', minute: '2-digit', second: '2-digit' };
    document.getElementById('show_time').textContent = now.toLocaleTimeString('zh-CN', timeOptions);
}

// 页面初始化
document.addEventListener('DOMContentLoaded', function() {
    const LunarObj = getLunarInstance();

    if (!LunarObj) {
        console.warn('Lunar库未加载，尝试重新加载...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lunar-javascript/1.6.10/lunar.min.js';
        script.onload = function() {
            console.log('Lunar库重新加载成功');
            updateDateInfo();
            updateTime();
        };
        script.onerror = function() {
            console.error('Lunar库加载失败');
            document.getElementById('show_date').textContent = '日期功能不可用';
            updateTime();
        };
        document.head.appendChild(script);
    } else {
        console.log('Lunar库已加载');
        updateDateInfo();
        updateTime();
    }

    setInterval(updateTime, 1000);
});