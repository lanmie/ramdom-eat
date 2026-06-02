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
        alert('本周所有餐厅都已安排！');
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
    fetchCloudData();
    // 每 30 秒自动同步一次
    setInterval(fetchCloudData, 30000);
}
