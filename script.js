// 菜单列表
const menu = {
    1: "米村",
    2: "炒粉",
    3: "米线",
    4: "山石榴",
    5: "太二",
    6: "刘文祥",
    7: "子固路"
};

const dayNames = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };

// 周数据：key 为 1~5（周一~周五），value 为食物 ID 或 null
let weekData = JSON.parse(localStorage.getItem('weekData')) || { 1: null, 2: null, 3: null, 4: null, 5: null };

// 获取今天是周几（1~5），周末返回 null
function getTodayIndex() {
    const d = new Date().getDay(); // 0=周日, 1=周一 ... 6=周六
    return (d >= 1 && d <= 5) ? d : null;
}

// 手动选择某天的食物
function saveDay(dayIndex, value) {
    weekData[dayIndex] = value ? parseInt(value) : null;
    localStorage.setItem('weekData', JSON.stringify(weekData));
    renderWeek();
}

// 随机某天（排除本周已选的餐厅）
function randomDay(dayIndex) {
    const usedIds = Object.entries(weekData)
        .filter(([d, id]) => parseInt(d) !== dayIndex && id !== null)
        .map(([, id]) => id);

    const available = Object.keys(menu)
        .map(id => parseInt(id))
        .filter(id => !usedIds.includes(id));

    if (available.length === 0) {
        alert('本周所有餐厅都已安排！');
        return;
    }

    weekData[dayIndex] = available[Math.floor(Math.random() * available.length)];
    localStorage.setItem('weekData', JSON.stringify(weekData));
    renderWeek();
}

// 随机今天
function pickToday() {
    const today = getTodayIndex();
    if (!today) {
        alert('今天是周末，好好休息！🎉');
        return;
    }
    randomDay(today);
}

// 新的一周：清空本周所有记录
function newWeek() {
    if (!confirm('确认清空本周所有记录？')) return;
    weekData = { 1: null, 2: null, 3: null, 4: null, 5: null };
    localStorage.setItem('weekData', JSON.stringify(weekData));
    renderWeek();
}

// 渲染周视图
function renderWeek() {
    const today = getTodayIndex();
    const grid = document.getElementById('week-grid');

    grid.innerHTML = Object.entries(dayNames).map(([dayIndex, dayName]) => {
        const idx = parseInt(dayIndex);
        const selectedId = weekData[idx];
        const isToday = idx === today;

        const options = `<option value="">— 未选择 —</option>` +
            Object.entries(menu).map(([id, name]) =>
                `<option value="${id}" ${selectedId == id ? 'selected' : ''}>${name}</option>`
            ).join('');

        return `
            <div class="day-row ${isToday ? 'today' : ''}">
                <span class="day-label">${dayName}${isToday ? ' 📍' : ''}</span>
                <select class="day-select ${selectedId ? 'selected' : ''}" onchange="saveDay(${idx}, this.value)">
                    ${options}
                </select>
                <button class="btn-random-day" onclick="randomDay(${idx})" title="随机">🎲</button>
            </div>
        `;
    }).join('');
}

// 初始化
renderWeek();
