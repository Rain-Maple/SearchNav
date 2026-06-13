/**
 * 特殊链接处理模块
 * 处理天气卡片、密码生成器等 javascript: 链接的点击事件
 */
(function() {
    'use strict';

    // 天气卡片显示函数
    function showWeatherCard() {
        if (document.querySelector('weather-card')) {
            document.querySelector('weather-card').remove();
            return;
        }
        const card = document.createElement('weather-card');
        card.style.position = 'fixed';
        card.style.top = '50%';
        card.style.left = '50%';
        card.style.transform = 'translate(-50%, -50%)';
        card.style.zIndex = '10001';
        document.body.appendChild(card);
    }

    // 密码生成器显示函数
    function showPasswordGenerator() {
        if (document.querySelector('password-generator')) {
            document.querySelector('password-generator').remove();
            return;
        }
        const generator = document.createElement('password-generator');
        generator.style.position = 'fixed';
        generator.style.top = '50%';
        generator.style.left = '50%';
        generator.style.transform = 'translate(-50%, -50%)';
        generator.style.zIndex = '1001';
        document.body.appendChild(generator);
    }

    // 初始化：为所有特殊链接绑定点击事件
    function initSpecialLinks() {
        document.querySelectorAll('.js-special-link').forEach(link => {
            // 避免重复绑定
            if (link.dataset.specialHandled === 'true') return;
            
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const specialType = this.dataset.special;
                if (specialType === 'weather') {
                    showWeatherCard();
                } else if (specialType === 'password') {
                    showPasswordGenerator();
                }
            });
            
            link.dataset.specialHandled = 'true';
        });
    }

    // 监听 DOM 变化（用于动态加载的内容）
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                initSpecialLinks();
            }
        });
    });

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initSpecialLinks();
            observer.observe(document.body, { childList: true, subtree: true });
        });
    } else {
        initSpecialLinks();
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();