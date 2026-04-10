// ─── Navigation ───────────────────────────────────────────────────────────────
async function selectMonth(month) {
    state.month = month;
    state.editingEntryId = null;
    state.editingRecurringId = null;
    await loadMonthData();
}

async function changeYear(year) {
    state.year = parseInt(year, 10);
    state.editingEntryId = null;
    state.editingRecurringId = null;
    history.past = [];
    history.future = [];
    await loadYearData();
    await loadMonthData();
    await loadYearList();
}

async function addNewYear() {
    const input = prompt("追加する年を入力してください");
    if (!input) return;
    const year = parseInt(input, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
        alert("有効な年を入力してください (2000〜2100)");
        return;
    }
    await api.get(`/api/${year}/state`);
    const years = await api.get("/api/years");
    if (years.includes(year - 1)) {
        const prevSummary = await api.get(`/api/${year - 1}/summary`);
        if (prevSummary.ending_balance !== 0) {
            await api.put(`/api/${year}/state`, { initial_balance: prevSummary.ending_balance });
        }
    }
    await changeYear(year);
}

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────
function initKeyboard() {
    document.addEventListener("keydown", (e) => {
        const tag = document.activeElement?.tagName;
        const isEditing = tag === "INPUT" || tag === "TEXTAREA" ||
            document.activeElement?.contentEditable === "true";

        if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
            e.preventDefault();
            undo();
            return;
        }
        if (e.ctrlKey && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
            e.preventDefault();
            redo();
            return;
        }

        // N: 明細追加 (entries tab) or 固定費追加 (recurring tab)
        if (!isEditing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === "n") {
            e.preventDefault();
            if (state.activeTab === "entries") {
                if (state.editingEntryId) return;
                state.editingEntryId = "new";
                renderEntries();
            } else if (state.activeTab === "recurring") {
                if (state.editingRecurringId) return;
                state.editingRecurringId = "new";
                renderRecurring();
            }
        }
    });
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function switchTab(tabName) {
    state.activeTab = tabName;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");
    document.getElementById(`tab-${tabName}`).classList.add("active");
    if (tabName === "charts") renderCharts();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    initKeyboard();

    document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    document.getElementById("add-entry-btn").addEventListener("click", () => {
        state.editingEntryId = "new";
        switchTab("entries");
        renderEntries();
    });

    document.getElementById("add-recurring-btn").addEventListener("click", () => {
        state.editingRecurringId = "new";
        renderRecurring();
    });

    document.getElementById("new-year-btn").addEventListener("click", addNewYear);
    document.getElementById("year-select").addEventListener("change", (e) => changeYear(e.target.value));

    // Update button labels to show shortcut
    document.getElementById("add-entry-btn").textContent = "+ 追加 (N)";
    document.getElementById("add-recurring-btn").textContent = "+ 追加 (N)";

    await loadYearList();
    await loadYearData();
    await loadMonthData();
}

document.addEventListener("DOMContentLoaded", init);
