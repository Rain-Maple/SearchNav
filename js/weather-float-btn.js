// weather-float-btn.js
// 左上角悬浮按钮，控制天气卡片的显示/隐藏
class WeatherFloatBtn extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    z-index: 10001;
                    display: block;
                }
                .float-weather-btn {
                    width: 54px;
                    height: 54px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #2c7cb6, #1e5a88);
                    border: none;
                    color: white;
                    font-size: 28px;
                    cursor: pointer;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.25);
                    transition: 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .float-weather-btn:hover {
                    transform: scale(1.08) rotate(3deg);
                    background: #4290c2;
                }
                @media (max-width: 500px) {
                    .float-weather-btn { width: 48px; height: 48px; font-size: 26px; top: 12px; left: 12px; }
                }
            </style>
            <button class="float-weather-btn" aria-label="天气助手">🌤️</button>
        `;
        this.btn = this.shadowRoot.querySelector('button');
        this.btn.addEventListener('click', () => this._toggleCard());
    }

    _toggleCard() {
        const existing = document.querySelector('weather-card');
        if (existing) existing.remove();
        else this._createCard();
    }

    _createCard() {
        const card = document.createElement('weather-card');
        card.style.position = 'fixed';
        card.style.top = '50%';
        card.style.left = '50%';
        card.style.transform = 'translate(-50%, -50%)';
        card.style.zIndex = '10001';
        document.body.appendChild(card);
    }
}

// 注册自定义元素
if (!customElements.get('weather-float-btn')) {
    customElements.define('weather-float-btn', WeatherFloatBtn);
}