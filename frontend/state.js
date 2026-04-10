// ─── State ────────────────────────────────────────────────────────────────────
const state = {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    entries: [],
    recurring: [],
    recurringGroups: [],
    groups: [],
    yearSummary: null,
    monthSummary: null,
    editingEntryId: null,     // null | 'new' | '<uuid>'
    editingRecurringId: null, // null | 'new' | '<uuid>'
    collapsedGroups: new Set(),
    collapsedRecurringGroups: new Set(),
    activeTab: 'entries',
};

// ─── History (undo/redo) ──────────────────────────────────────────────────────
const history = { past: [], future: [], MAX: 40 };

async function withHistory(fn) {
    const snapshot = await api.get(`/api/${state.year}/full`);
    await fn();
    history.past.push(snapshot);
    history.future = [];
    if (history.past.length > history.MAX) history.past.shift();
}

async function undo() {
    if (history.past.length === 0) return;
    const current = await api.get(`/api/${state.year}/full`);
    history.future.push(current);
    const snapshot = history.past.pop();
    await api.put(`/api/${state.year}/restore`, snapshot);
    state.editingEntryId = null;
    state.editingRecurringId = null;
    await hardRefresh();
}

async function redo() {
    if (history.future.length === 0) return;
    const current = await api.get(`/api/${state.year}/full`);
    history.past.push(current);
    const snapshot = history.future.pop();
    await api.put(`/api/${state.year}/restore`, snapshot);
    state.editingEntryId = null;
    state.editingRecurringId = null;
    await hardRefresh();
}
