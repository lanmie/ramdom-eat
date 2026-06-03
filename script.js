// Supabase 配置 (请在此处填入您的 URL 和 Anon Key)
// 您可以从 Supabase 控制台获取：Project Settings -> API
const SUPABASE_CONFIG = {
    URL: 'https://cfjzwvoytylvjkomgpli.supabase.co',
    ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmanp3dm95dHlsdmprb21ncGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTMzMTUsImV4cCI6MjA5NTk2OTMxNX0.1Q4AQcphJ8Ws0mgMKbDTrUzb6jzt8euxDE7YoEs-g2I'
};

// 初始化 Supabase
let supabaseClient = null;
let isCloudConnected = false;

if (SUPABASE_CONFIG.URL !== 'YOUR_SUPABASE_URL' && SUPABASE_CONFIG.URL.trim() !== '') {
    try {
        let cleanUrl = SUPABASE_CONFIG.URL.trim();
        if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
        if (cleanUrl.endsWith('/rest/v1')) cleanUrl = cleanUrl.replace('/rest/v1', '');
        
        console.log('正在尝试连接 Supabase...', cleanUrl);
        supabaseClient = window.supabase.createClient(cleanUrl, SUPABASE_CONFIG.ANON_KEY);
        isCloudConnected = true;
        console.log('Supabase 客户端初始化成功');
    } catch (e) {
        console.error('Supabase 初始化代码执行失败:', e);
    }
} else {
    console.warn('Supabase 配置尚未填入，当前处于本地存储模式');
}

// 菜单列表
let menu = JSON.parse(localStorage.getItem('menuData')) || {
    1: "米村",
    2: "炒粉",
    3: "米线",
    4: "山石榴",
    5: "太二",
    6: "刘文祥",
    7: "子固路"
};

const dayNames = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };
const ALLOWED_USERS = ['gina', 'pin'];

// 周数据
let weekData = JSON.parse(localStorage.getItem('weekData')) || { 1: null, 2: null, 3: null, 4: null, 5: null };
let currentRecordId = localStorage.getItem('currentRecordId') || null;
let userName = localStorage.getItem('userName') || '';

// --- 日期工具函数 ---

// 获取本周一的日期对象
function getThisMonday() {
    const today = new Date();
    const day = today.getDay() || 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// 获取本周五的日期对象
function getThisFriday() {
    const monday = getThisMonday();
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    friday.setHours(23, 59, 59, 999);
    return friday;
}

// 格式化日期：M月D日
function formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 更新日期范围显示
function updateDateDisplay() {
    const monday = getThisMonday();
    const friday = getThisFriday();
    const displayEl = document.getElementById('week-range-display');
    if (displayEl) {
        displayEl.innerText = `${formatDate(monday)} - ${formatDate(friday)}`;
    }
}

// --- 业务逻辑 ---

function getTodayIndex() {
    const d = new Date().getDay();
    return (d >= 1 && d <= 5) ? d : null;
}

function isUserAuthorized() {
    return ALLOWED_USERS.includes(userName.toLowerCase());
}

function saveUserName(name) {
    userName = name.trim();
    localStorage.setItem('userName', userName);
    renderWeek();
}

function updateStatusUI(connected) {
    const statusEl = document.getElementById('cloud-status');
    if (statusEl) {
        statusEl.className = `cloud-status ${connected ? 'connected' : 'disconnected'}`;
        statusEl.title = connected ? '已连接 Supabase 同步' : '未连接云端（使用本地存储）';
    }
}

async function fetchMenuData() {
    if (!isCloudConnected || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('configs')
            .select('value')
            .eq('key', 'menu_data')
            .maybeSingle(); // 使用 maybeSingle 替代 single，避免 406 错误
        
        if (error) throw error;
        
        if (data && data.value) {
            menu = data.value;
            localStorage.setItem('menuData', JSON.stringify(menu));
            renderWeek();
        }
    } catch (error) {
        // 如果是表不存在的错误，静默失败，使用默认菜单
        if (error.code === '42P01') {
            console.warn('configs 表不存在，将使用本地默认菜单');
        } else {
            console.error('获取菜单失败:', error);
        }
    }
}

async function saveMenuToCloud() {
    localStorage.setItem('menuData', JSON.stringify(menu));
    if (!isCloudConnected || !supabaseClient) return;
    try {
        await supabaseClient.from('configs').upsert({ key: 'menu_data', value: menu });
    } catch (error) {
        console.error('保存菜单失败:', error);
    }
}

// 修改：根据本周一的日期获取数据
async function fetchCloudData() {
    if (!isCloudConnected || !supabaseClient) return;

    const mondayStr = getThisMonday().toISOString().split('T')[0];

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .eq('week_monday', mondayStr)
            .limit(1);

        // 如果报错是因为字段不存在，我们需要提醒用户
        if (error) {
            if (error.code === '42703') {
                console.error('数据库缺少 week_monday 字段，请运行 SQL 迁移脚本！');
            }
            throw error;
        }

        if (data && data.length > 0) {
            const plan = data[0];
            weekData = plan.data;
            currentRecordId = plan.id;
            localStorage.setItem('weekData', JSON.stringify(weekData));
            localStorage.setItem('currentRecordId', currentRecordId);
            renderWeek();
            updateStatusUI(true);
        } else {
            // 如果本周确实没记录，且当前 ID 是旧的，才清空
            if (currentRecordId) {
                console.log('检测到新的一周，正在切换到空白计划');
                weekData = { 1: null, 2: null, 3: null, 4: null, 5: null };
                currentRecordId = null;
                localStorage.removeItem('currentRecordId');
                renderWeek();
            }
        }
    } catch (error) {
        console.error('获取云端数据失败:', error);
        updateStatusUI(false);
    }
}

async function saveToCloud() {
    if (!isCloudConnected || !supabaseClient) return;

    const mondayStr = getThisMonday().toISOString().split('T')[0];

    try {
        let result;
        const payload = { 
            data: weekData, 
            week_monday: mondayStr // 关键：保存本周一的日期
        };

        if (currentRecordId) {
            result = await supabaseClient
                .from('week_plans')
                .update(payload)
                .eq('id', currentRecordId)
                .select();
        } else {
            result = await supabaseClient
                .from('week_plans')
                .insert([payload])
                .select();
        }

        if (result.data && result.data.length > 0) {
            currentRecordId = result.data[0].id;
        }
        updateStatusUI(true);
    } catch (error) {
        console.error('保存到云端失败:', error);
        updateStatusUI(false);
    }
}

async function saveDay(dayIndex, value) {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        renderWeek();
        return;
    }
    const foodId = value ? parseInt(value) : null;
    weekData[dayIndex] = foodId ? { id: foodId, user: userName } : null;
    renderWeek();
    await saveToCloud();
}

async function randomDay(dayIndex) {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    const usedIds = Object.entries(weekData)
        .filter(([d, val]) => parseInt(d) !== dayIndex && val !== null)
        .map(([, val]) => val.id);

    const available = Object.keys(menu)
        .map(id => parseInt(id))
        .filter(id => !usedIds.includes(id));

    if (available.length === 0) {
        alert('当前菜单中的选项都已在周计划中，或者菜单为空！');
        return;
    }

    const selectedId = available[Math.floor(Math.random() * available.length)];
    weekData[dayIndex] = { id: selectedId, user: userName };
    renderWeek();
    await saveToCloud();
}

function pickToday() {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    const today = getTodayIndex();
    if (!today) {
        alert('今天是周末，好好休息！🎉');
        return;
    }
    randomDay(today);
}

// 修改：重置本周
async function newWeek() {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    if (!confirm('确认清空本周所有记录并重新开始？')) return;
    weekData = { 1: null, 2: null, 3: null, 4: null, 5: null };
    renderWeek();
    await saveToCloud();
}

async function toggleHistory() {
    const modal = document.getElementById('history-modal');
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        switchTab('calendar');
        await loadHistory();
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-view`);
    });
    if (tabName === 'menu') renderMenuEditor();
}

// 历史记录中的日期范围工具
function getWeekRangeString(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay() || 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day - 1));
    const friday = new Date(date);
    friday.setDate(date.getDate() + (4)); // 这里改为+4，因为周五是周一+4天
    const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${format(monday)} - ${format(friday)}`;
}

async function loadHistory() {
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('stats-list');
    if (!isCloudConnected || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .order('week_monday', { ascending: false }); // 改为按周一日期排序

        if (error) throw error;
        if (!data || data.length === 0) {
            listEl.innerHTML = statsEl.innerHTML = '<p class="no-data">暂无历史记录</p>';
            return;
        }

        const months = {};
        const stats = {};

        data.forEach(record => {
            const dateObj = new Date(record.week_monday || record.created_at);
            const monthKey = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月`;
            if (!months[monthKey]) months[monthKey] = [];
            months[monthKey].push(record);

            Object.values(record.data).forEach(entry => {
                if (entry && entry.id && menu[entry.id]) {
                    const foodName = menu[entry.id];
                    stats[foodName] = (stats[foodName] || 0) + 1;
                }
            });
        });

        listEl.innerHTML = Object.entries(months).map(([month, records]) => {
            const recordHtml = records.map(record => {
                const monday = new Date(record.week_monday || record.created_at);
                const friday = new Date(monday);
                friday.setDate(monday.getDate() + 4);
                const range = `${monday.getMonth() + 1}月${monday.getDate()}日 - ${friday.getMonth() + 1}月${friday.getDate()}日`;
                
                const details = Object.entries(dayNames).map(([idx, name]) => {
                    const entry = record.data[idx];
                    if (!entry || !menu[entry.id]) return '';
                    return `<div class="history-day">${name}<b>${menu[entry.id]}</b></div>`;
                }).filter(h => h).join('');

                return `
                    <div class="history-item">
                        <div class="history-date">
                            <span style="font-weight: bold; color: #2c3e50;">${range}</span>
                            <span style="font-size: 10px; opacity: 0.6">${new Date(record.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="history-details">${details || '<div class="no-data" style="padding:0">本周暂无记录</div>'}</div>
                    </div>
                `;
            }).join('');

            return `<div class="month-group"><div class="month-title">${month}</div>${recordHtml}</div>`;
        }).join('');

        const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        const maxCount = sortedStats.length > 0 ? sortedStats[0][1] : 1;
        statsEl.innerHTML = sortedStats.map(([name, count], index) => {
            const percentage = (count / maxCount) * 100;
            return `<div class="stats-item"><div class="stats-rank">${index + 1}</div><div class="stats-name">${name}</div><div class="stats-bar-container"><div class="stats-bar" style="width: ${percentage}%"></div></div><div class="stats-count">${count}次</div></div>`;
        }).join('') || '<p class="no-data">暂无统计数据</p>';

    } catch (error) {
        console.error('加载历史记录失败:', error);
    }
}

function renderMenuEditor() {
    const listEl = document.getElementById('menu-items-list');
    const isAuth = isUserAuthorized();
    listEl.innerHTML = Object.entries(menu).map(([id, name]) => `
        <div class="menu-item-row"><span>${name}</span>${isAuth ? `<button class="btn-delete" onclick="deleteMenuItem('${id}')">×</button>` : ''}</div>
    `).join('') || '<p class="no-data">暂无菜单选项</p>';
}

async function addMenuItem() {
    if (!isUserAuthorized()) return alert('抱歉，只有指定用户可以操作！');
    const input = document.getElementById('new-food-name');
    const name = input.value.trim();
    if (!name) return;
    const nextId = Math.max(0, ...Object.keys(menu).map(Number)) + 1;
    menu[nextId] = name;
    input.value = '';
    renderMenuEditor();
    renderWeek();
    await saveMenuToCloud();
}

async function deleteMenuItem(id) {
    if (!isUserAuthorized()) return alert('抱歉，只有指定用户可以操作！');
    if (!confirm(`确定删除“${menu[id]}”吗？`)) return;
    delete menu[id];
    renderMenuEditor();
    renderWeek();
    await saveMenuToCloud();
}

window.onclick = (event) => {
    const modal = document.getElementById('history-modal');
    if (event.target == modal) modal.style.display = 'none';
}

function renderWeek() {
    const today = getTodayIndex();
    const grid = document.getElementById('week-grid');
    const isAuth = isUserAuthorized();

    grid.innerHTML = Object.entries(dayNames).map(([dayIndex, dayName]) => {
        const idx = parseInt(dayIndex);
        const entry = weekData[idx];
        const selectedId = entry ? entry.id : null;
        const user = entry ? entry.user : '';
        const isToday = idx === today;
        const options = `<option value="">— 未选择 —</option>` +
            Object.entries(menu).map(([id, name]) => `<option value="${id}" ${selectedId == id ? 'selected' : ''}>${name}</option>`).join('');

        return `
            <div class="day-row ${isToday ? 'today' : ''} ${!isAuth ? 'readonly' : ''}">
                <div class="day-info"><span class="day-label">${dayName}${isToday ? ' 📍' : ''}</span>${user ? `<span class="user-badge" title="选择者">${user}</span>` : ''}</div>
                <select class="day-select ${selectedId ? 'selected' : ''}" onchange="saveDay(${idx}, this.value)" ${!isAuth ? 'disabled' : ''}>${options}</select>
                <button class="btn-random-day" onclick="randomDay(${idx})" title="随机" ${!isAuth ? 'disabled' : ''}>🎲</button>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.actions button').forEach(btn => btn.disabled = !isAuth);
    const userInp = document.getElementById('user-name');
    if (userInp && !userInp.value) userInp.value = userName;
}

// 初始化执行
updateDateDisplay();
updateStatusUI(isCloudConnected);
renderWeek();

if (isCloudConnected) {
    (async () => {
        await fetchMenuData();
        await fetchCloudData();
    })();
    setInterval(fetchMenuData, 15000);
    setInterval(fetchCloudData, 30000);
}
