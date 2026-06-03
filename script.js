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
        // 自动修正 URL：Supabase SDK 会自动处理 /rest/v1，如果用户手动加了会导致路径错误
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

// 菜单列表 (默认为空，将从云端加载或使用本地缓存)
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

// 授权用户列表
const ALLOWED_USERS = ['gina', 'pin'];

// 周数据：key 为 1~5（周一~周五），value 为 { id: 食物ID, user: 用户名 } 或 null
let weekData = JSON.parse(localStorage.getItem('weekData')) || { 1: null, 2: null, 3: null, 4: null, 5: null };
let currentRecordId = localStorage.getItem('currentRecordId') || null;
let userName = localStorage.getItem('userName') || '';

// 获取今天是周几（1~5），周末返回 null
function getTodayIndex() {
    const d = new Date().getDay(); // 0=周日, 1=周一 ... 6=周六
    return (d >= 1 && d <= 5) ? d : null;
}

// 校验用户是否有权限
function isUserAuthorized() {
    return ALLOWED_USERS.includes(userName.toLowerCase());
}

// 保存用户名
function saveUserName(name) {
    userName = name.trim();
    localStorage.setItem('userName', userName);
    renderWeek();
}

// 更新云端连接状态 UI
function updateStatusUI(connected) {
    const statusEl = document.getElementById('cloud-status');
    if (statusEl) {
        statusEl.className = `cloud-status ${connected ? 'connected' : 'disconnected'}`;
        statusEl.title = connected ? '已连接 Supabase 同步' : '未连接云端（使用本地存储）';
    }
}

// 从云端获取菜单数据
async function fetchMenuData() {
    if (!isCloudConnected || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('configs')
            .select('value')
            .eq('key', 'menu_data')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 是未找到记录
        if (data) {
            menu = data.value;
            localStorage.setItem('menuData', JSON.stringify(menu));
            renderWeek();
            renderMenuEditor();
        }
    } catch (error) {
        console.error('获取菜单失败:', error);
    }
}

// 保存菜单到云端
async function saveMenuToCloud() {
    localStorage.setItem('menuData', JSON.stringify(menu));
    if (!isCloudConnected || !supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('configs')
            .upsert({ key: 'menu_data', value: menu });
        if (error) throw error;
    } catch (error) {
        console.error('保存菜单失败:', error);
    }
}

// 从云端获取最新数据
async function fetchCloudData() {
    if (!isCloudConnected || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Supabase 查询请求报错:', error.message, error.details, error.hint);
            throw error;
        }

        if (data && data.length > 0) {
            console.log('成功获取云端数据:', data[0]);
            const plan = data[0];
            weekData = plan.data;
            currentRecordId = plan.id;
            localStorage.setItem('weekData', JSON.stringify(weekData));
            localStorage.setItem('currentRecordId', currentRecordId);
            renderWeek();
            updateStatusUI(true);
        }
    } catch (error) {
        console.error('获取云端数据失败:', error);
        updateStatusUI(false);
    }
}

// 保存数据到云端
async function saveToCloud() {
    localStorage.setItem('weekData', JSON.stringify(weekData));
    
    if (!isCloudConnected || !supabaseClient) return;

    try {
        let result;
        if (currentRecordId) {
            // 更新现有记录
            result = await supabaseClient
                .from('week_plans')
                .update({ data: weekData })
                .eq('id', currentRecordId)
                .select();
        } else {
            // 创建新记录
            result = await supabaseClient
                .from('week_plans')
                .insert([{ data: weekData }])
                .select();
        }

        if (result.error) throw result.error;

        if (result.data && result.data.length > 0) {
            currentRecordId = result.data[0].id;
            localStorage.setItem('currentRecordId', currentRecordId);
        }
        updateStatusUI(true);
    } catch (error) {
        console.error('保存到云端失败:', error);
        updateStatusUI(false);
    }
}

// 手动选择某天的食物
async function saveDay(dayIndex, value) {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
        renderWeek();
        return;
    }
    const foodId = value ? parseInt(value) : null;
    weekData[dayIndex] = foodId ? { id: foodId, user: userName } : null;
    renderWeek();
    await saveToCloud();
}

// 随机某天
async function randomDay(dayIndex) {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
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

// 随机今天
function pickToday() {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
        return;
    }
    const today = getTodayIndex();
    if (!today) {
        alert('今天是周末，好好休息！🎉');
        return;
    }
    randomDay(today);
}

// 新的一周
async function newWeek() {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
        return;
    }
    if (!confirm('确认清空本周所有记录并开始新的一周？')) return;
    weekData = { 1: null, 2: null, 3: null, 4: null, 5: null };
    currentRecordId = null; // 开启新记录
    renderWeek();
    await saveToCloud();
}

// 弹窗逻辑
async function toggleHistory() {
    const modal = document.getElementById('history-modal');
    if (!modal) return;

    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    } else {
        modal.style.display = 'block';
        switchTab('calendar'); // 默认打开日历视图
        await loadHistory();
    }
}

function switchTab(tabName) {
    // 切换按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(tabName));
    });
    // 切换内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-view`);
    });
    
    if (tabName === 'menu') {
        renderMenuEditor();
    }
}

// 获取某日期所在周的周一和周五的日期范围字符串
function getWeekRangeString(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDay() || 7; // 1-7 (周一到周日)
    
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day - 1));
    
    const friday = new Date(date);
    friday.setDate(date.getDate() + (5 - day));
    
    const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${format(monday)} - ${format(friday)}`;
}

async function loadHistory() {
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('stats-list');
    if (!listEl || !statsEl) return;

    if (!isCloudConnected || !supabaseClient) {
        listEl.innerHTML = statsEl.innerHTML = '<p class="no-data">未连接云端，无法查看历史记录</p>';
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            listEl.innerHTML = statsEl.innerHTML = '<p class="no-data">暂无历史记录</p>';
            return;
        }

        const months = {};
        const stats = {};

        data.forEach(record => {
            const dateObj = new Date(record.created_at);
            const monthKey = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月`;
            
            if (!months[monthKey]) months[monthKey] = [];
            months[monthKey].push(record);

            // 统计逻辑
            Object.values(record.data).forEach(entry => {
                if (entry && entry.id && menu[entry.id]) {
                    const foodName = menu[entry.id];
                    stats[foodName] = (stats[foodName] || 0) + 1;
                }
            });
        });

        // 渲染日历视图
        listEl.innerHTML = Object.entries(months).map(([month, records]) => {
            const recordHtml = records.map(record => {
                const weekRange = getWeekRangeString(record.created_at);
                
                const details = Object.entries(dayNames).map(([idx, name]) => {
                    const entry = record.data[idx];
                    // 修复 undefined 问题：只有当有数据且菜单里存在该食物时才显示
                    if (!entry || !menu[entry.id]) return '';
                    return `<div class="history-day">${name}<b>${menu[entry.id]}</b></div>`;
                }).filter(html => html !== '').join(''); // 过滤掉空字符串

                return `
                    <div class="history-item">
                        <div class="history-date">
                            <span style="font-weight: bold; color: #2c3e50;">${weekRange}</span>
                            <span style="font-size: 10px; opacity: 0.6">同步于: ${new Date(record.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="history-details">${details || '<div class="no-data" style="padding:0">本周暂无记录</div>'}</div>
                    </div>
                `;
            }).join('');

            return `
                <div class="month-group">
                    <div class="month-title">${month}</div>
                    ${recordHtml}
                </div>
            `;
        }).join('');

        // 2. 渲染统计视图
        const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        const maxCount = sortedStats.length > 0 ? sortedStats[0][1] : 1;

        statsEl.innerHTML = sortedStats.map(([name, count], index) => {
            const percentage = (count / maxCount) * 100;
            return `
                <div class="stats-item">
                    <div class="stats-rank">${index + 1}</div>
                    <div class="stats-name">${name}</div>
                    <div class="stats-bar-container">
                        <div class="stats-bar" style="width: ${percentage}%"></div>
                    </div>
                    <div class="stats-count">${count}次</div>
                </div>
            `;
        }).join('') || '<p class="no-data">暂无统计数据</p>';

    } catch (error) {
        console.error('加载历史记录失败:', error);
        listEl.innerHTML = statsEl.innerHTML = '<p class="no-data">加载失败，请检查网络</p>';
    }
}

// 菜单编辑器逻辑
function renderMenuEditor() {
    const listEl = document.getElementById('menu-items-list');
    if (!listEl) return;
    
    const isAuth = isUserAuthorized();
    
    listEl.innerHTML = Object.entries(menu).map(([id, name]) => `
        <div class="menu-item-row">
            <span>${name}</span>
            ${isAuth ? `<button class="btn-delete" onclick="deleteMenuItem('${id}')">×</button>` : ''}
        </div>
    `).join('') || '<p class="no-data">暂无菜单选项</p>';
}

async function addMenuItem() {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
        return;
    }
    
    const input = document.getElementById('new-food-name');
    const name = input.value.trim();
    if (!name) return;
    
    // 生成一个新ID
    const nextId = Math.max(0, ...Object.keys(menu).map(Number)) + 1;
    menu[nextId] = name;
    
    input.value = '';
    renderMenuEditor();
    renderWeek();
    await saveMenuToCloud();
}

async function deleteMenuItem(id) {
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户（Gina 或 Pin）可以操作！');
        return;
    }
    
    if (!confirm(`确定删除“${menu[id]}”吗？`)) return;
    
    delete menu[id];
    renderMenuEditor();
    renderWeek();
    await saveMenuToCloud();
}

// 点击弹窗外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('history-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// 渲染周视图
function renderWeek() {
    const today = getTodayIndex();
    const grid = document.getElementById('week-grid');
    if (!grid) return;

    const isAuth = isUserAuthorized();

    grid.innerHTML = Object.entries(dayNames).map(([dayIndex, dayName]) => {
        const idx = parseInt(dayIndex);
        const entry = weekData[idx];
        const selectedId = entry ? entry.id : null;
        const user = entry ? entry.user : '';
        const isToday = idx === today;

        const options = `<option value="">— 未选择 —</option>` +
            Object.entries(menu).map(([id, name]) =>
                `<option value="${id}" ${selectedId == id ? 'selected' : ''}>${name}</option>`
            ).join('');

        return `
            <div class="day-row ${isToday ? 'today' : ''} ${!isAuth ? 'readonly' : ''}">
                <div class="day-info">
                    <span class="day-label">${dayName}${isToday ? ' 📍' : ''}</span>
                    ${user ? `<span class="user-badge" title="选择者">${user}</span>` : ''}
                </div>
                <select class="day-select ${selectedId ? 'selected' : ''}" onchange="saveDay(${idx}, this.value)" ${!isAuth ? 'disabled' : ''}>
                    ${options}
                </select>
                <button class="btn-random-day" onclick="randomDay(${idx})" title="随机" ${!isAuth ? 'disabled' : ''}>🎲</button>
            </div>
        `;
    }).join('');

    // 更新底部按钮状态
    document.querySelectorAll('.actions button').forEach(btn => {
        btn.disabled = !isAuth;
    });

    // 初始化用户名输入框
    const userInp = document.getElementById('user-name');
    if (userInp && !userInp.value) {
        userInp.value = userName;
    }
}

// 初始化
updateStatusUI(isCloudConnected);
renderWeek();
if (isCloudConnected) {
    fetchMenuData(); // 先加载菜单
    fetchCloudData();
    // 每 30 秒自动同步一次
    setInterval(() => {
        fetchMenuData();
        fetchCloudData();
    }, 30000);
}
