// 你的菜单列表
const menu = {
    1: "米村",
    2: "炒粉",
    3: "米线",
    4: "山石榴",
    5: "太二",
    6: "刘文祥",
    7: "子固路"
};

// 从本地存储获取历史记录（只保留最近5次，刚好完美解决周五到周一、以及工作日5天不重复的问题）
let historyQueue = JSON.parse(localStorage.getItem('eatHistory')) || [];

function updateHistoryDisplay() {
    const listDiv = document.getElementById('history-list');
    if (historyQueue.length === 0) {
        listDiv.innerHTML = '暂无记录';
        return;
    }
    listDiv.innerHTML = historyQueue.map((id, index) =>
        `<span class="history-item">${menu[id]}<span class="delete-btn" onclick="deleteHistory(${index})">✕</span></span>`
    ).join('');
}

function deleteHistory(index) {
    historyQueue.splice(index, 1);
    localStorage.setItem('eatHistory', JSON.stringify(historyQueue));
    updateHistoryDisplay();
}

function pickFood() {
    // 过滤掉历史记录中已经存在的ID
    const availableIds = Object.keys(menu).filter(id => !historyQueue.includes(parseInt(id)));

    if (availableIds.length === 0) {
        alert("所有餐厅都吃过一轮啦！重置历史记录。");
        historyQueue = [];
        localStorage.setItem('eatHistory', JSON.stringify(historyQueue));
        updateHistoryDisplay();
        return;
    }

    // 随机抽取
    const randomIndex = Math.floor(Math.random() * availableIds.length);
    const selectedId = parseInt(availableIds[randomIndex]);
    const foodName = menu[selectedId];

    // 动效
    let count = 0;
    const resultDiv = document.getElementById('result');
    const interval = setInterval(() => {
        const tempIds = Object.keys(menu);
        resultDiv.innerText = menu[tempIds[Math.floor(Math.random() * tempIds.length)]];
        count++;
        if (count > 10) {
            clearInterval(interval);
            // 显示最终结果
            resultDiv.innerText = foodName;

            // 更新历史队列：加入新记录，保持长度不超过 5
            historyQueue.push(selectedId);
            if (historyQueue.length > 5) {
                historyQueue.shift(); // 移出最早的一次
            }

            // 持久化保存
            localStorage.setItem('eatHistory', JSON.stringify(historyQueue));
            updateHistoryDisplay();
        }
    }, 50);
}

// 初始化显示
updateHistoryDisplay();
