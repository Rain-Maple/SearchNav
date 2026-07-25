// 获取Lunar对象的辅助函数
function getLunarInstance() {
    if (typeof Lunar !== 'undefined') {
        return Lunar;
    } else if (typeof window.Lunar !== 'undefined') {
        return window.Lunar;
    }
    return null;
}

function updateClock() {
    const now = new Date();
    
    // 格式化时间
    const timeOptions = {
        hour12: false,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    };
    const formattedTime = now.toLocaleTimeString('zh-CN', timeOptions);
    
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
        
        // 获取农历信息 - 使用多种方法
        let yearName = '未知', monthName = '未知', dayName = '未知', zodiac = null;
        
        // 获取年份
        if (typeof lunar.getYear === 'function') {
            yearName = lunar.getYear();
        } else if (typeof lunar.year === 'function') {
            yearName = lunar.year();
        } else if (typeof lunar.getYearName === 'function') {
            yearName = lunar.getYearName();
        }
        
        // 获取月份
        if (typeof lunar.getMonth === 'function') {
            monthName = lunar.getMonth();
        } else if (typeof lunar.month === 'function') {
            monthName = lunar.month();
        } else if (typeof lunar.getMonthName === 'function') {
            monthName = lunar.getMonthName();
        }
        
        // 获取日期
        if (typeof lunar.getDay === 'function') {
            dayName = lunar.getDay();
        } else if (typeof lunar.day === 'function') {
            dayName = lunar.day();
        } else if (typeof lunar.getDayName === 'function') {
            dayName = lunar.getDayName();
        }
        
        // 获取生肖 - 多种方法尝试
        if (typeof lunar.getZodiac === 'function') {
            zodiac = lunar.getZodiac();
        } else if (typeof lunar.zodiac === 'function') {
            zodiac = lunar.zodiac();
        } else if (typeof lunar.getZodiacName === 'function') {
            zodiac = lunar.getZodiacName();
        } else if (typeof lunar.getYearZodiac === 'function') {
            zodiac = lunar.getYearZodiac();
        } else if (typeof lunar.getAnimal === 'function') {
            zodiac = lunar.getAnimal();
        } else if (typeof lunar.animal === 'function') {
            zodiac = lunar.animal();
        } else if (typeof lunar.getShengXiao === 'function') {
            zodiac = lunar.getShengXiao();
        }
        
        // 如果以上方法都失败，尝试直接从对象属性获取
        if (!zodiac && lunar.zodiac !== undefined) {
            zodiac = lunar.zodiac;
        }
        if (!zodiac && lunar.animal !== undefined) {
            zodiac = lunar.animal;
        }
        
        // 构建农历日期字符串
        lunarStr = `农历 ${monthName}月${dayName}日`;
        
        // 添加生肖
        if (zodiac) {
            lunarStr += ` (${zodiac}年)`;
        } else {
            // 如果仍然获取不到生肖，尝试通过年份计算
            try {
                const year = now.getFullYear();
                const zodiacs = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
                const calculatedZodiac = zodiacs[(year - 4) % 12];
                lunarStr += ` (${calculatedZodiac}年)`;
            } catch (e) {
                lunarStr += ` (未知年)`;
            }
        }
        
    } catch (error) {
        console.error('农历转换错误:', error);
        lunarStr = '农历日期获取失败';
    }
    
    // 合并显示：公历 + 空格 + 星期 + 空格 + 农历
    const combinedDisplay = `${formattedDate} ${formattedWeek} ${lunarStr}`;
    
    // 更新显示内容
    document.getElementById('show_time').textContent = formattedTime;
    document.getElementById('show_date').textContent = combinedDisplay;
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
            updateClock();
        };
        script.onerror = function() {
            console.error('Lunar库加载失败');
            document.getElementById('show_date').textContent = '农历功能不可用';
        };
        document.head.appendChild(script);
    } else {
        // 输出Lunar对象的方法用于调试
        console.log('Lunar对象已加载，可用方法:', Object.getOwnPropertyNames(LunarObj.prototype || {}));
    }
    
    // 立即更新时间
    updateClock();
    // 每秒更新一次
    setInterval(updateClock, 1000);
});