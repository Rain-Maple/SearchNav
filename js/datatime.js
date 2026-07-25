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
    // 格式化日期（公历）
    const dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    const formattedDate = now.toLocaleDateString('zh-CN', dateOptions);
    // 获取农历日期
    try {
        const LunarObj = getLunarInstance();
        if (!LunarObj) {
            throw new Error('Lunar库未加载');
        }
        
        const lunar = LunarObj.fromDate(now);
        
        // 获取农历信息 - 使用调试版本中确认有效的方法
        let yearName, monthName, dayName, zodiac;
        
        // 尝试不同的方法名
        if (typeof lunar.getYear === 'function') {
            yearName = lunar.getYear();
        } else if (typeof lunar.year === 'function') {
            yearName = lunar.year();
        } else {
            yearName = '未知';
        }
        
        if (typeof lunar.getMonth === 'function') {
            monthName = lunar.getMonth();
        } else if (typeof lunar.month === 'function') {
            monthName = lunar.month();
        } else {
            monthName = '未知';
        }
        
        if (typeof lunar.getDay === 'function') {
            dayName = lunar.getDay();
        } else if (typeof lunar.day === 'function') {
            dayName = lunar.day();
        } else {
            dayName = '未知';
        }
        
        if (typeof lunar.getZodiac === 'function') {
            zodiac = lunar.getZodiac();
        } else if (typeof lunar.zodiac === 'function') {
            zodiac = lunar.zodiac();
        } else {
            zodiac = null;
        }
        
        // 构建农历日期字符串
        let lunarStr = `农历 ${monthName}月${dayName}日`;
        
        // 添加生肖
        if (zodiac) {
            lunarStr += ` (${zodiac}年)`;
        }
        
        document.getElementById('show_lunar').textContent = lunarStr;
        
    } catch (error) {
        console.error('农历转换错误:', error);
        document.getElementById('show_lunar').textContent = '农历日期获取失败';
    }
    // 更新显示内容
    document.getElementById('show_time').textContent = formattedTime;
    document.getElementById('show_date').textContent = formattedDate;
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
            document.getElementById('show_lunar').textContent = '农历功能不可用';
        };
        document.head.appendChild(script);
    }
    
    // 立即更新时间
    updateClock();
    // 每秒更新一次
    setInterval(updateClock, 1000);
});