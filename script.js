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
let menu = {
    1: "米村",
    2: "炒粉",
    3: "米线",
    4: "山石榴",
    5: "太二",
    6: "刘文祥",
    7: "子固路"
};

const dayNames = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六' };
const ALLOWED_USERS = ['gina', 'pin'];

// 周数据 - 只在内存中存储
let weekData = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
let currentRecordId = null;
let userName = localStorage.getItem('userName') || ''; // 用户名还是保留在本地
let isLoading = false; // 加载状态

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

// 获取本周六的日期对象
function getThisSaturday() {
    const monday = getThisMonday();
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    saturday.setHours(23, 59, 59, 999);
    return saturday;
}

// 格式化日期：M月D日
function formatDate(date) {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}

// 更新日期范围显示
function updateDateDisplay() {
    const monday = getThisMonday();
    const saturday = getThisSaturday();
    const displayEl = document.getElementById('week-range-display');
    if (displayEl) {
        displayEl.innerText = `${formatDate(monday)} - ${formatDate(saturday)}`;
    }
}

// --- 业务逻辑 ---

function getTodayIndex() {
    const d = new Date().getDay();
    return (d >= 1 && d <= 6) ? d : null;
}

function isUserAuthorized() {
    return ALLOWED_USERS.includes(userName.toLowerCase());
}

function saveUserName(name) {
    userName = name.trim();
    localStorage.setItem('userName', userName); // 用户名还是保留在本地
    renderWeek();
}

function updateStatusUI(connected) {
    const statusEl = document.getElementById('cloud-status');
    if (statusEl) {
        statusEl.className = `cloud-status ${connected ? 'connected' : 'disconnected'}`;
        statusEl.title = connected ? '已连接 Supabase 同步' : '未连接云端（使用本地存储）';
    }
}

// 加载状态 - 只是标记，不影响UI
function setLoading(loading) {
    isLoading = loading;
}

// 检查是否正在加载
function checkLoading() {
    return isLoading; // 只是返回状态，不显示alert了
}

async function fetchMenuData() {
    if (!isCloudConnected || !supabaseClient) return;
    try {
        const { data, error } = await supabaseClient
            .from('configs')
            .select('value')
            .eq('key', 'menu_data')
            .maybeSingle();
        
        if (error) throw error;
        
        if (data && data.value) {
            menu = data.value;
            renderWeek();
        }
    } catch (error) {
        console.error('获取菜单失败:', error);
    }
}

async function saveMenuToCloud() {
    if (!isCloudConnected || !supabaseClient) return;
    try {
        await supabaseClient.from('configs').upsert({ key: 'menu_data', value: menu });
    } catch (error) {
        console.error('保存菜单失败:', error);
    }
}

// 格式化本地日期为 YYYY-MM-DD，避免时区偏移
function toLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取某日期所在周的周一
function getMondayOfDate(dateInput) {
    const date = new Date(dateInput);
    const day = date.getDay() || 7;
    const monday = new Date(date);
    monday.setDate(date.getDate() - (day - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

let isFirstLoad = true;

// 根据本周一的日期获取数据 - 简化版
async function fetchCloudData(showLoading = false) {
    if (!isCloudConnected || !supabaseClient) {
        return;
    }

    if (showLoading) {
        setLoading(true);
    }
    const mondayStr = toLocalDateString(getThisMonday());
    console.log('正在获取周数据，本周一:', mondayStr);

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .eq('week_monday', mondayStr)
            .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
            const plan = data[0];
            weekData = plan.data;
            currentRecordId = plan.id;
            console.log('成功加载本周数据');
            renderWeek();
            updateStatusUI(true);
        } else {
            console.log('本周没有记录，初始化空白计划');
            weekData = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
            currentRecordId = null;
            renderWeek();
        }
    } catch (error) {
        console.error('获取云端数据失败:', error);
        updateStatusUI(false);
    } finally {
        if (showLoading) {
            setLoading(false);
        }
        isFirstLoad = false;
    }
}

async function saveToCloud() {
    if (!isCloudConnected || !supabaseClient) return;

    const mondayStr = toLocalDateString(getThisMonday());

    try {
        let result;
        const payload = { 
            data: weekData, 
            week_monday: mondayStr
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

// 切换奶茶状态
async function toggleMilkTea(dayIndex) {
    if (checkLoading()) return; // 加载中不操作
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        renderWeek();
        return;
    }
    if (!weekData[dayIndex]) {
        weekData[dayIndex] = { id: null, name: null, user: null, hasMilkTea: true };
    } else {
        weekData[dayIndex].hasMilkTea = !weekData[dayIndex].hasMilkTea;
    }
    renderWeek();
    await saveToCloud();
}

// 随机某天
async function randomDay(dayIndex) {
    if (checkLoading()) return;
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    const usedIds = Object.entries(weekData)
        .filter(([d, val]) => parseInt(d) !== dayIndex && val !== null && val.id !== null)
        .map(([, val]) => val.id);

    const available = Object.keys(menu)
        .map(id => parseInt(id))
        .filter(id => !usedIds.includes(id));

    if (available.length === 0) {
        alert('当前菜单中的选项都已在周计划中，或者菜单为空！');
        return;
    }

    const selectedId = available[Math.floor(Math.random() * available.length)];
    const existingMilkTea = weekData[dayIndex]?.hasMilkTea || false;
    
    weekData[dayIndex] = { 
        id: selectedId, 
        name: menu[selectedId], 
        user: userName,
        hasMilkTea: existingMilkTea
    };
    renderWeek();
    await saveToCloud();
}

function pickToday() {
    if (checkLoading()) return;
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    const today = getTodayIndex();
    if (!today) {
        alert('今天是周日，好好休息！🎉');
        return;
    }
    randomDay(today);
}

// 重置本周
async function newWeek() {
    if (checkLoading()) return;
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        return;
    }
    if (!confirm('确认清空本周所有记录并重新开始？')) return;
    weekData = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
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
function getWeekRangeString(dateStr, weekMonday) {
    const monday = weekMonday ? new Date(weekMonday) : getMondayOfDate(dateStr);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);
    
    const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${format(monday)} - ${format(saturday)}`;
}

async function loadHistory() {
    const listEl = document.getElementById('history-list');
    const statsEl = document.getElementById('stats-list');
    if (!isCloudConnected || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('week_plans')
            .select('*')
            .order('week_monday', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) {
            listEl.innerHTML = statsEl.innerHTML = '<p class="no-data">暂无历史记录</p>';
            return;
        }

        const months = {};
        const stats = {};

        data.forEach(record => {
            const mondayDate = record.week_monday ? new Date(record.week_monday) : getMondayOfDate(record.created_at);
            const monthKey = `${mondayDate.getFullYear()}年${mondayDate.getMonth() + 1}月`;
            
            if (!months[monthKey]) months[monthKey] = [];
            months[monthKey].push({ ...record, calculated_monday: mondayDate });

            Object.values(record.data).forEach(entry => {
                if (entry) {
                    const foodName = entry.name || (entry.id && menu[entry.id]) || "未知食物";
                    stats[foodName] = (stats[foodName] || 0) + 1;
                }
            });
        });

        listEl.innerHTML = Object.entries(months).map(([month, records]) => {
            const recordHtml = records.map(record => {
                const range = getWeekRangeString(record.created_at, record.week_monday);
                
                const details = Object.entries(dayNames).map(([idx, name]) => {
                    const entry = record.data[idx];
                    if (!entry) return '';
                    const foodName = entry.name || (entry.id && menu[entry.id]) || "未知";
                    const milkTeaEmoji = entry.hasMilkTea ? ' 🧋' : '';
                    const customLabel = entry.id === null ? ' ✏️' : '';
                    return `<div class="history-day">${name}<b>${foodName}${milkTeaEmoji}${customLabel}</b></div>`;
                }).filter(h => h).join('');

                return `
                    <div class="history-item">
                        <div class="history-date">
                            <span style="font-weight: bold; color: #2c3e50;">${range}</span>
                            <span style="font-size: 10px; opacity: 0.6">同步于: ${new Date(record.created_at).toLocaleDateString()}</span>
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
};

function renderWeek() {
    const today = getTodayIndex();
    const grid = document.getElementById('week-grid');
    const isAuth = isUserAuthorized();

    grid.innerHTML = Object.entries(dayNames).map(([dayIndex, dayName]) => {
        const idx = parseInt(dayIndex);
        const entry = weekData[idx];
        const selectedId = entry ? entry.id : null;
        const selectedName = entry ? entry.name : '';
        const user = entry ? entry.user : '';
        const hasMilkTea = entry ? entry.hasMilkTea : false;
        const isCustom = entry && entry.id === null && entry.name;
        const isToday = idx === today;
        
        return `
            <div class="day-row ${isToday ? 'today' : ''} ${!isAuth ? 'readonly' : ''}" data-day="${idx}">
                <div class="day-info">
                    <span class="day-label">${dayName}${isToday ? ' 📍' : ''}</span>
                    ${user ? `<span class="user-badge" title="选择者">${user}</span>` : ''}
                </div>
                <div class="day-select-wrapper">
                    <div class="custom-select-wrapper">
                        <input type="text" class="custom-select-input" 
                            placeholder="选择或输入..." 
                            value="${selectedName || ''}" 
                            onfocus="openDropdown(${idx})"
                            onblur="handleInputBlur(${idx})"
                            onkeydown="handleInputKeydown(event, ${idx})"
                            oninput="handleInputChange(${idx}, this.value)"
                            ${!isAuth ? 'disabled' : ''}>
                        <div class="custom-select-arrow" onclick="toggleDropdown(${idx})">▼</div>
                        <div class="custom-select-dropdown" id="dropdown-${idx}">
                            <div class="custom-select-option" data-value="" onclick="selectOption(${idx}, '', '')">— 未选择 —</div>
                            ${Object.entries(menu).map(([id, name]) => 
                                `<div class="custom-select-option ${selectedId == id ? 'selected' : ''}" data-value="${id}" onclick="selectOption(${idx}, '${id}', '${name.replace(/'/g, "\\'")}')">${name}</div>`
                            ).join('')}
                        </div>
                    </div>
                </div>
                <button class="btn-random-day" onclick="randomDay(${idx})" title="随机" ${!isAuth ? 'disabled' : ''}>🎲</button>
                <button class="btn-milk-tea ${hasMilkTea ? 'active' : ''}" onclick="toggleMilkTea(${idx})" title="${hasMilkTea ? '已喝奶茶' : '喝奶茶了吗？'}" ${!isAuth ? 'disabled' : ''}>🧋</button>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.actions button').forEach(btn => btn.disabled = !isAuth);
    const userInp = document.getElementById('user-name');
    if (userInp && !userInp.value) userInp.value = userName;
    
    document.addEventListener('click', handleOutsideClick);
}

let openDropdownIndex = null;
let inputTimeout = null;

function toggleDropdown(dayIndex) {
    const dropdown = document.getElementById(`dropdown-${dayIndex}`);
    const isOpen = dropdown.classList.contains('open');
    
    closeAllDropdowns();
    
    if (!isOpen) {
        dropdown.classList.add('open');
        openDropdownIndex = dayIndex;
    }
}

function openDropdown(dayIndex) {
    closeAllDropdowns();
    const dropdown = document.getElementById(`dropdown-${dayIndex}`);
    dropdown.classList.add('open');
    openDropdownIndex = dayIndex;
}

function closeAllDropdowns() {
    document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.remove('open'));
    openDropdownIndex = null;
}

function handleOutsideClick(event) {
    if (!event.target.closest('.custom-select-wrapper')) {
        closeAllDropdowns();
    }
}

function selectOption(dayIndex, id, name) {
    if (checkLoading()) return;
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        renderWeek();
        return;
    }
    
    const existingMilkTea = weekData[dayIndex]?.hasMilkTea || false;
    const existingUser = weekData[dayIndex]?.user || null;
    
    if (id) {
        weekData[dayIndex] = { 
            id: parseInt(id), 
            name: name, 
            user: userName || existingUser,
            hasMilkTea: existingMilkTea
        };
    } else {
        if (existingMilkTea) {
            weekData[dayIndex] = { 
                id: null, 
                name: null, 
                user: existingUser,
                hasMilkTea: existingMilkTea
            };
        } else {
            weekData[dayIndex] = null;
        }
    }
    
    renderWeek();
    saveToCloud();
}

function handleInputKeydown(event, dayIndex) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const input = event.target;
        saveInputValue(dayIndex, input.value);
        closeAllDropdowns();
    } else if (event.key === 'Escape') {
        closeAllDropdowns();
        event.target.blur();
    } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        openDropdown(dayIndex);
    }
}

function handleInputChange(dayIndex, value) {
    if (inputTimeout) {
        clearTimeout(inputTimeout);
    }
    openDropdown(dayIndex);
}

function handleInputBlur(dayIndex) {
    setTimeout(() => {
        const dayRow = document.querySelector(`.day-row[data-day="${dayIndex}"]`);
        const input = dayRow.querySelector('.custom-select-input');
        saveInputValue(dayIndex, input.value);
    }, 150);
}

async function saveInputValue(dayIndex, value) {
    if (checkLoading()) return;
    const trimmedValue = value.trim();
    
    if (!trimmedValue) {
        const entry = weekData[dayIndex];
        if (entry && entry.hasMilkTea) {
            weekData[dayIndex] = {
                id: null,
                name: null,
                user: entry.user,
                hasMilkTea: true
            };
        } else {
            weekData[dayIndex] = null;
        }
        renderWeek();
        await saveToCloud();
        return;
    }
    
    if (!isUserAuthorized()) {
        alert('抱歉，只有指定用户可以操作！');
        renderWeek();
        return;
    }
    
    let matchedId = null;
    let matchedName = null;
    for (const [id, name] of Object.entries(menu)) {
        if (name === trimmedValue) {
            matchedId = id;
            matchedName = name;
            break;
        }
    }
    
    const existingMilkTea = weekData[dayIndex]?.hasMilkTea || false;
    const existingUser = weekData[dayIndex]?.user || null;
    
    if (matchedId) {
        weekData[dayIndex] = {
            id: parseInt(matchedId),
            name: matchedName,
            user: userName || existingUser,
            hasMilkTea: existingMilkTea
        };
    } else {
        weekData[dayIndex] = {
            id: null,
            name: trimmedValue,
            user: userName || existingUser,
            hasMilkTea: existingMilkTea
        };
    }
    
    renderWeek();
    await saveToCloud();
}

// 初始化执行
updateDateDisplay();
updateStatusUI(isCloudConnected);

// 初始渲染 - 先显示空白的
weekData = { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null };
currentRecordId = null;
renderWeek();

if (isCloudConnected) {
    (async () => {
        setLoading(true);
        try {
            await fetchMenuData();
            await fetchCloudData(false);
        } finally {
            setLoading(false);
        }
    })();
    // 移除定时刷新，只在初始化时加载一次
}
