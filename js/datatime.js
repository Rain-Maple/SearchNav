function updateDateInfo() {
	const now = new Date();

	// 格式化日期
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

	const combinedDisplay = `${formattedDate} ${formattedWeekday}`;

	// 更新显示内容
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

	// 更新显示内容
	document.getElementById('show_time').textContent = formattedTime;
}

// 初始加载时更新日期和时间
updateDateInfo();
updateTimeInfo();
// 每秒更新一次时间
setInterval(updateTimeInfo, 1000);