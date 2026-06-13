/**
 * 深色模式 - 跟随系统/浏览器设置
 * 单击切换：手动覆盖
 * 双击重置：恢复跟随系统
 */
(function() {
    'use strict';

    function getStoredTheme() {
        return localStorage.getItem('theme');
    }

    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function getCurrentTheme() {
        const stored = getStoredTheme();
        if (stored === 'dark' || stored === 'light') {
            return stored;
        }
        return getSystemTheme();
    }

    function applyTheme(theme) {
        const root = document.documentElement;
        root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    }

    function initTheme() {
        applyTheme(getCurrentTheme());
    }

    function watchSystemTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            if (!localStorage.getItem('theme')) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        };
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else if (mediaQuery.addListener) {
            mediaQuery.addListener(handleChange);
        }
    }

    function createToggleButton() {
        if (document.getElementById('darkmode-toggle')) return;

        const button = document.createElement('button');
        button.id = 'darkmode-toggle';
        button.className = 'darkmode-toggle';
        button.setAttribute('aria-label', '切换深色模式 | 双击重置');
        button.innerHTML = getCurrentTheme() === 'dark' ? '☀️' : '🌙';
        
        // ========== 按钮样式（修改这里） ==========
        button.style.cssText = `
            position: fixed;
            bottom: 30px;      /* 距离底部距离，改大往上移，改小往下移 */
            right: 30px;       /* 距离右侧距离，改大往左移，改小往右移 */
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: var(--bg-secondary, #2196F3);
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            z-index: 999;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        
        // 单击：手动切换
        button.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            button.innerHTML = newTheme === 'dark' ? '☀️' : '🌙';
        });
        
        // 双击：重置为跟随系统
        button.addEventListener('dblclick', () => {
            localStorage.removeItem('theme');
            const systemTheme = getSystemTheme();
            applyTheme(systemTheme);
            button.innerHTML = systemTheme === 'dark' ? '☀️' : '🌙';
        });
        
        document.body.appendChild(button);
    }

    initTheme();
    watchSystemTheme();
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createToggleButton);
    } else {
        createToggleButton();
    }
})();