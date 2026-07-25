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
		const lunar = Lunar.fromDate(now);
        
		// 获取农历年份的天干地支
		const yearName = lunar.getYear();
		const monthName = lunar.getMonth();
		const dayName = lunar.getDay();
        
		// 构建农历日期字符串
		let lunarStr = `农历 ${yearName}年 ${monthName}月 ${dayName}`;
        
		// 添加生肖
		const zodiac = lunar.getZodiac();
		lunarStr += ` (${zodiac}年)`;
        
		// 添加节气信息（如果有）
		const jieQi = lunar.getJieQi();
		if (jieQi) {
			lunarStr += ` 今日${jieQi}`;
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

// 初始加载时立即更新时间
updateClock();
// 每秒更新一次时间
setInterval(updateClock, 1000);