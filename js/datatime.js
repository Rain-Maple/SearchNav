// 获取Lunar对象的辅助函数
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
    const chineseNums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    return chineseNums[num] || num.toString();
}

// 农历月份转换
function lunarMonthToChinese(month) {
    if (typeof month === 'string') {
        // 如果已经是中文，直接返回
        if (['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'].includes(month)) {
            return month;
        }
        // 如果是"正月"、"二月"等格式
        if (month.includes('月')) {
            return month.replace('月', '');
        }
    }
    // 数字转中文
    const num = parseInt(month);
    if (!isNaN(num) && num >= 1 && num <= 12) {
        const chineseMonths = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '腊'];
        return chineseMonths[num - 1];
    }
    return month;
}

// 获取并更新日期信息（只在页面加载时执行）
function updateDateInfo() {
    const now = new Date();
    
    // 分别获取公历日期和星期
    const dateOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);
    
    const weekOptions = {
        weekday: 'long'
    };
    const formattedWeek = now.toLocaleDateString('zh-CN', weekOptions);
    
    // 获取农历日期
    let lunarStr = '';
    try {
        const LunarObj = getLunarInstance();
        if (!LunarObj) {
            throw new Error('Lunar库未加载');
        }
        
        const lunar = LunarObj.fromDate(now);
        
        // 获取农历信息
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
        
        // 获取日期 - 转换为中文数字
        let dayValue = '';
        if (typeof lunar.getDay === 'function') {
            dayValue = lunar.getDay();
        } else if (typeof lunar.day === 'function') {
            dayValue = lunar.day();
        } else if (typeof lunar.getDayName === 'function') {
            dayValue = lunar.getDayName();
        }
        dayName = numberToChinese(parseInt(dayValue));
        
        // 获取生肖 - 修正生肖映射
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
        
        // 如果获取到的生肖是"貉"，说明是错误映射，通过年份重新计算
        if (zodiacValue === '貉' || !zodiacValue) {
            const year = now.getFullYear();
            const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
            zodiac = zodiacs[(year - 4) % 12];
        } else {
            zodiac = zodiacValue;
        }
        
        // 构建农历日期字符串
        lunarStr = `农历 ${monthName}月${dayName}日`;
        
        // 添加生肖
        if (zodiac) {
            lunarStr += ` (${zodiac}年)`;
        }
        
    } catch (error) {
        console.error('农历转换错误:', error);
        lunarStr = '农历日期获取失败';
    }
    
    // 合并显示：公历 + 空格 + 星期 + 空格 + 农历
    const combinedDisplay = `${formattedDate} ${formattedWeek} ${lunarStr}`;
    
    // 更新日期显示
    document.getElementById('show_date').textContent = combinedDisplay;
}

// 更新时间（每秒执行）
function updateTime() {
    const now = new Date();
    const timeOptions = {
        hour12: false,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    };
    const formattedTime = now.toLocaleTimeString('zh-CN', timeOptions);
    document.getElementById('show_time').textContent = formattedTime;
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查库是否加载
    const LunarObj = getLunarInstance();
    if (!LunarObj) {
        console.warn('Lunar库未加载，尝试重新加载...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lunar-javascript/1.6.10/lunar.min.js';
        script.onload = function() {
            console.log('Lunar库重新加载成功');
            // 库加载成功后更新日期
            updateDateInfo();
            updateTime();
        };
        script.onerror = function() {
            console.error('Lunar库加载失败');
            document.getElementById('show_date').textContent = '农历功能不可用';
            updateTime();
        };
        document.head.appendChild(script);
    } else {
        console.log('Lunar库已加载');
        // 更新日期（只在页面加载时执行一次）
        updateDateInfo();
        // 更新时间
        updateTime();
    }
    
    // 每秒更新时间（不更新日期）
    setInterval(updateTime, 1000);
});