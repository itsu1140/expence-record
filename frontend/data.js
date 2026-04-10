// ─── Data Loading ─────────────────────────────────────────────────────────────
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

async function loadYearList() {
    const years = await api.get("/api/years");
    const sel = document.getElementById("year-select");
    sel.innerHTML = "";
    if (years.length === 0) years.push(state.year);
    years.forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = `${y}年`;
        if (y === state.year) opt.selected = true;
        sel.appendChild(opt);
    });
}

async function loadYearData() {
    const [summary, stateData] = await Promise.all([
        api.get(`/api/${state.year}/summary`),
        api.get(`/api/${state.year}/state`),
    ]);
    state.yearSummary = summary;
    state.month = stateData.last_opened_month;
    renderSidebar();
}

async function loadMonthData() {
    const [entries, recurring, groups, recurringGroups, summary] = await Promise.all([
        api.get(`/api/${state.year}/entries?month=${state.month}`),
        api.get(`/api/${state.year}/recurring`),
        api.get(`/api/${state.year}/groups`),
        api.get(`/api/${state.year}/recurring-groups`),
        api.get(`/api/${state.year}/month/${state.month}/summary`),
    ]);
    state.entries = entries;
    state.recurring = recurring;
    state.groups = groups;
    state.recurringGroups = recurringGroups;
    state.monthSummary = summary;
    state.editingEntryId = null;
    state.editingRecurringId = null;
    renderMonthHeader();
    renderEntries();
    renderRecurring();
    renderCharts();
    renderSidebar();
    api.put(`/api/${state.year}/state`, { last_opened_month: state.month });
}

// Refresh current month view (keep editing state)
async function refresh() {
    const [entries, groups, yearSummary, monthSummary] = await Promise.all([
        api.get(`/api/${state.year}/entries?month=${state.month}`),
        api.get(`/api/${state.year}/groups`),
        api.get(`/api/${state.year}/summary`),
        api.get(`/api/${state.year}/month/${state.month}/summary`),
    ]);
    state.entries = entries;
    state.groups = groups;
    state.yearSummary = yearSummary;
    state.monthSummary = monthSummary;
    renderMonthHeader();
    renderEntries();
    renderSidebar();
    renderCharts();
}

// Full refresh including recurring (used after undo/redo)
async function hardRefresh() {
    const [entries, recurring, groups, recurringGroups, yearSummary, monthSummary] = await Promise.all([
        api.get(`/api/${state.year}/entries?month=${state.month}`),
        api.get(`/api/${state.year}/recurring`),
        api.get(`/api/${state.year}/groups`),
        api.get(`/api/${state.year}/recurring-groups`),
        api.get(`/api/${state.year}/summary`),
        api.get(`/api/${state.year}/month/${state.month}/summary`),
    ]);
    state.entries = entries;
    state.recurring = recurring;
    state.groups = groups;
    state.recurringGroups = recurringGroups;
    state.yearSummary = yearSummary;
    state.monthSummary = monthSummary;
    renderMonthHeader();
    renderEntries();
    renderRecurring();
    renderSidebar();
    renderCharts();
}
