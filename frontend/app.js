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

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  async get(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(path, body) {
    const r = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    if (r.status === 204) return null;
    return r.json();
  },
  async patch(path) {
    const r = await fetch(path, { method: "PATCH" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(path) {
    const r = await fetch(path, { method: "DELETE" });
    if (!r.ok && r.status !== 204) throw new Error(await r.text());
  },
};

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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById("month-list");
  list.innerHTML = "";
  (state.yearSummary?.monthly ?? []).forEach((m) => {
    const li = document.createElement("li");
    if (m.month === state.month) li.classList.add("active");
    const bal = m.balance;
    li.innerHTML = `
      <span class="month-name">${MONTHS[m.month - 1]}</span>
      <span class="month-balance ${bal >= 0 ? "positive" : "negative"}">${bal >= 0 ? "+" : ""}${bal.toLocaleString()}</span>
    `;
    li.addEventListener("click", () => selectMonth(m.month));
    list.appendChild(li);
  });

  const s = state.yearSummary;
  const annual = document.getElementById("annual-summary");
  if (!s) return;
  const ending = s.ending_balance;
  annual.innerHTML = `
    <div class="balance-section">
      <div class="balance-label">初期所持金</div>
      <div class="balance-input-wrap">
        <input id="initial-balance-input" class="balance-input" type="number" value="${s.initial_balance}" step="1">
        <span class="balance-unit">円</span>
      </div>
    </div>
    <div class="balance-divider"></div>
    <div class="balance-row">
      <span class="label">年間収支</span>
      <span class="${s.total_balance >= 0 ? "positive" : "negative"}">${s.total_balance >= 0 ? "+" : ""}${s.total_balance.toLocaleString()}円</span>
    </div>
    <div class="balance-row ending">
      <span class="label">現在の所持金</span>
      <span class="value ${ending >= 0 ? "positive" : "negative"}">${ending.toLocaleString()}円</span>
    </div>
  `;

  const input = document.getElementById("initial-balance-input");
  input.addEventListener("change", async () => {
    const val = parseInt(input.value, 10);
    if (isNaN(val)) return;
    await withHistory(() => api.put(`/api/${state.year}/state`, { initial_balance: val }));
    await refresh();
  });
}

function renderMonthHeader() {
  const s = state.monthSummary;
  const el = document.getElementById("month-header");
  if (!s) { el.innerHTML = ""; return; }
  const bal = s.balance;
  el.innerHTML = `
    <span class="month-header-title">${state.year}年 ${MONTHS[state.month - 1]}</span>
    <span class="month-header-stat">収入 <span class="inc">${s.total_income.toLocaleString()}円</span></span>
    <span class="month-header-stat">支出 <span class="exp">${s.total_expense.toLocaleString()}円</span></span>
    <span class="month-header-stat">収支 <span class="${bal >= 0 ? "positive" : "negative"}">${bal >= 0 ? "+" : ""}${Math.abs(bal).toLocaleString()}円</span></span>
  `;
}

// ─── Entry Cards ──────────────────────────────────────────────────────────────
let draggedEntryId = null;
let draggedGroupId = null;
let draggedRecurringId = null;
let draggedRecurringGroupId = null;

function renderEntries() {
  const list = document.getElementById("entry-list");
  list.innerHTML = "";

  if (state.editingEntryId === "new") {
    list.appendChild(createEntryEditCard(null));
  }

  const monthEntryIds = new Set(state.entries.map((e) => e.id));
  const monthGroups = state.groups.filter((g) =>
    g.entry_ids.some((id) => monthEntryIds.has(id))
  );
  const groupedIds = new Set(monthGroups.flatMap((g) => g.entry_ids));
  const ungrouped = state.entries.filter((e) => !groupedIds.has(e.id));

  monthGroups.forEach((g) => {
    const groupEntries = g.entry_ids
      .map((id) => state.entries.find((e) => e.id === id))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date));
    list.appendChild(createGroupCard(g, groupEntries));
  });

  ungrouped.forEach((e) => {
    list.appendChild(
      state.editingEntryId === e.id ? createEntryEditCard(e) : createEntryViewCard(e)
    );
  });
}

function createTypeToggle(isIncome) {
  const wrap = document.createElement("div");
  wrap.className = "type-toggle";
  wrap.innerHTML = `
    <button type="button" class="type-btn${!isIncome ? " active" : ""}" data-value="expense">支出</button>
    <button type="button" class="type-btn${isIncome ? " active" : ""}" data-value="income">収入</button>
  `;
  wrap.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault(); // let bubble → li save handler
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const btns = [...wrap.querySelectorAll(".type-btn")];
        const idx = btns.indexOf(btn);
        const next = e.key === "ArrowRight" ? btns[(idx + 1) % btns.length] : btns[(idx - 1 + btns.length) % btns.length];
        next.focus();
        next.click();
      }
    });
  });
  return wrap;
}

function createEntryViewCard(entry) {
  const li = document.createElement("li");
  li.className = "entry-card";
  li.dataset.id = entry.id;
  li.draggable = true;
  li.tabIndex = 0;

  const date = entry.date.slice(5).replace("-", "/");
  const sign = entry.type === "income" ? "+" : "−";
  li.innerHTML = `
    <div class="card-dot ${entry.type}"></div>
    <span class="card-desc">${entry.description || "（内容なし）"}</span>
    <span class="card-date">${date}</span>
    <span class="card-amount ${entry.type}">${sign}${entry.amount.toLocaleString()}円</span>
    <button class="card-del" title="削除 (Delete)">×</button>
  `;

  li.addEventListener("click", (e) => {
    if (e.target.classList.contains("card-del")) return;
    state.editingEntryId = entry.id;
    renderEntries();
    setTimeout(() => {
      document.querySelector(`[data-id="${entry.id}"].editing .edit-amount`)?.focus();
    }, 30);
  });

  li.addEventListener("keydown", (e) => {
    if (e.key === "Delete") { e.preventDefault(); deleteEntry(entry.id); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); }
  });

  li.querySelector(".card-del").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteEntry(entry.id);
  });

  li.addEventListener("dragstart", (e) => {
    e.stopPropagation(); // prevent group card from starting a group drag
    draggedEntryId = entry.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", entry.id);
    setTimeout(() => li.classList.add("dragging"), 0);
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    draggedEntryId = null;
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedEntryId) li.classList.add("drop-target");
  });
  li.addEventListener("dragleave", (e) => {
    if (!li.contains(e.relatedTarget)) li.classList.remove("drop-target");
  });
  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("drop-target");
    const dropped = e.dataTransfer.getData("text/plain");
    if (dropped && dropped !== entry.id && draggedEntryId) await handleEntryDrop(dropped, entry.id);
  });

  return li;
}

function createEntryEditCard(entry) {
  const li = document.createElement("li");
  li.className = "entry-card editing";
  if (entry) li.dataset.id = entry.id;

  const today = new Date();
  const day = Math.min(today.getDate(), new Date(state.year, state.month, 0).getDate());
  const defaultDate =
    entry?.date ||
    `${state.year}-${String(state.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isIncome = entry?.type === "income";

  const row = document.createElement("div");
  row.className = "edit-row";

  const typeToggle = createTypeToggle(isIncome);
  row.appendChild(typeToggle);

  const dateInput = document.createElement("input");
  dateInput.className = "edit-date";
  dateInput.type = "date";
  dateInput.value = defaultDate;
  row.appendChild(dateInput);

  const descInput = document.createElement("input");
  descInput.className = "edit-desc";
  descInput.type = "text";
  descInput.placeholder = "内容";
  descInput.value = entry?.description || "";
  row.appendChild(descInput);

  const amountInput = document.createElement("input");
  amountInput.className = "edit-amount";
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.placeholder = "金額";
  amountInput.value = entry?.amount || "";
  row.appendChild(amountInput);

  const saveBtn = document.createElement("button");
  saveBtn.className = "edit-save";
  saveBtn.title = "保存 (Enter)";
  saveBtn.textContent = "✓";
  row.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "edit-cancel";
  cancelBtn.title = "キャンセル (Esc)";
  cancelBtn.textContent = "✗";
  row.appendChild(cancelBtn);

  li.appendChild(row);

  const save = async () => {
    const amount = parseInt(amountInput.value, 10);
    if (!amount || amount <= 0) {
      amountInput.classList.add("input-error");
      amountInput.focus();
      setTimeout(() => amountInput.classList.remove("input-error"), 600);
      return;
    }
    const body = {
      type: typeToggle.querySelector(".type-btn.active").dataset.value,
      date: dateInput.value,
      amount,
      description: descInput.value,
      category: "",
    };
    await withHistory(() =>
      entry
        ? api.put(`/api/${state.year}/entries/${entry.id}`, body)
        : api.post(`/api/${state.year}/entries`, body)
    );
    state.editingEntryId = null;
    await refresh();
  };

  const cancel = () => {
    state.editingEntryId = null;
    renderEntries();
  };

  saveBtn.addEventListener("click", save);
  cancelBtn.addEventListener("click", cancel);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === "Escape") cancel();
  });

  if (!entry) setTimeout(() => descInput.focus(), 30);
  return li;
}

// ─── Group Card ───────────────────────────────────────────────────────────────
function createGroupCard(group, entries) {
  const li = document.createElement("li");
  li.className = "group-card";
  li.dataset.groupId = group.id;
  li.draggable = true;

  const total = entries.reduce(
    (s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0
  );
  const totalClass = total >= 0 ? "income" : "expense";
  const totalStr = (total >= 0 ? "+" : "−") + Math.abs(total).toLocaleString() + "円";

  const isCollapsed = state.collapsedGroups.has(group.id);

  const header = document.createElement("div");
  header.className = "group-header";
  header.innerHTML = `
    <button class="group-drag-btn" title="ドラッグで並び替え">⠿</button>
    <button class="group-toggle-btn">${isCollapsed ? "▶" : "▼"}</button>
    <span class="group-name" contenteditable spellcheck="false">${group.name}</span>
    <span class="group-total ${totalClass}">${totalStr}</span>
    <button class="group-ungroup-btn">解除</button>
  `;

  const body = document.createElement("ul");
  body.className = "group-body";
  if (isCollapsed) body.style.display = "none";
  entries.forEach((e) => {
    body.appendChild(
      state.editingEntryId === e.id ? createEntryEditCard(e) : createEntryViewCard(e)
    );
  });

  header.querySelector(".group-toggle-btn").addEventListener("click", () => {
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "";
    header.querySelector(".group-toggle-btn").textContent = open ? "▶" : "▼";
    if (open) state.collapsedGroups.add(group.id);
    else state.collapsedGroups.delete(group.id);
  });

  const nameEl = header.querySelector(".group-name");
  nameEl.addEventListener("blur", async () => {
    const newName = nameEl.textContent.trim() || "グループ";
    if (newName !== group.name) {
      await withHistory(() =>
        api.put(`/api/${state.year}/groups/${group.id}`, { name: newName, entry_ids: group.entry_ids })
      );
      group.name = newName;
    }
  });
  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
  });

  header.querySelector(".group-ungroup-btn").addEventListener("click", async () => {
    await withHistory(() => api.del(`/api/${state.year}/groups/${group.id}`));
    state.collapsedGroups.delete(group.id);
    await refresh();
  });

  // ── Group card drag (reorder groups) ──
  li.addEventListener("dragstart", (e) => {
    // Only start group drag if initiated from the drag handle or header (not from entry inside body)
    if (body.contains(e.target)) return;
    e.stopPropagation();
    draggedGroupId = group.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `group:${group.id}`);
    setTimeout(() => li.classList.add("dragging"), 0);
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    draggedGroupId = null;
    document.querySelectorAll(".group-card.reorder-target").forEach((el) => el.classList.remove("reorder-target"));
  });

  // ── Drop on group card ──
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (draggedGroupId && draggedGroupId !== group.id) {
      li.classList.add("reorder-target");
      li.classList.remove("drop-target");
    } else if (draggedEntryId) {
      li.classList.add("drop-target");
      li.classList.remove("reorder-target");
    }
  });
  li.addEventListener("dragleave", (e) => {
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove("drop-target");
      li.classList.remove("reorder-target");
    }
  });
  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("drop-target");
    li.classList.remove("reorder-target");

    if (draggedGroupId && draggedGroupId !== group.id) {
      await reorderGroups(draggedGroupId, group.id);
    } else if (draggedEntryId) {
      const dropped = e.dataTransfer.getData("text/plain");
      if (dropped && !group.entry_ids.includes(dropped)) {
        await withHistory(() =>
          api.put(`/api/${state.year}/groups/${group.id}`, {
            name: group.name,
            entry_ids: [...group.entry_ids, dropped],
          })
        );
        await refresh();
      }
    }
  });

  li.appendChild(header);
  li.appendChild(body);
  return li;
}

// ─── Entry Drop Handler ───────────────────────────────────────────────────────
async function handleEntryDrop(draggedId, targetId) {
  const draggedGroup = state.groups.find((g) => g.entry_ids.includes(draggedId));
  const targetGroup = state.groups.find((g) => g.entry_ids.includes(targetId));

  await withHistory(async () => {
    if (targetGroup) {
      if (!targetGroup.entry_ids.includes(draggedId)) {
        if (draggedGroup && draggedGroup.id !== targetGroup.id) {
          const remaining = draggedGroup.entry_ids.filter((id) => id !== draggedId);
          if (remaining.length === 0) {
            await api.del(`/api/${state.year}/groups/${draggedGroup.id}`);
          } else {
            await api.put(`/api/${state.year}/groups/${draggedGroup.id}`, {
              name: draggedGroup.name, entry_ids: remaining,
            });
          }
        }
        await api.put(`/api/${state.year}/groups/${targetGroup.id}`, {
          name: targetGroup.name,
          entry_ids: [...targetGroup.entry_ids, draggedId],
        });
      }
    } else if (draggedGroup) {
      await api.put(`/api/${state.year}/groups/${draggedGroup.id}`, {
        name: draggedGroup.name,
        entry_ids: [...draggedGroup.entry_ids, targetId],
      });
    } else {
      await api.post(`/api/${state.year}/groups`, {
        name: "グループ",
        entry_ids: [draggedId, targetId],
      });
    }
  });
  await refresh();
}

async function reorderGroups(draggedId, targetId) {
  const ids = state.groups.map((g) => g.id);
  const fromIdx = ids.indexOf(draggedId);
  const toIdx = ids.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, draggedId);
  await withHistory(() => api.put(`/api/${state.year}/groups/reorder`, { ids }));
  await refresh();
}

// ─── Entry CRUD ───────────────────────────────────────────────────────────────
async function deleteEntry(id) {
  if (!confirm("この明細を削除しますか？")) return;
  await withHistory(async () => {
    for (const g of state.groups) {
      if (g.entry_ids.includes(id)) {
        const remaining = g.entry_ids.filter((eid) => eid !== id);
        if (remaining.length === 0) {
          await api.del(`/api/${state.year}/groups/${g.id}`);
        } else {
          await api.put(`/api/${state.year}/groups/${g.id}`, { name: g.name, entry_ids: remaining });
        }
      }
    }
    await api.del(`/api/${state.year}/entries/${id}`);
  });
  await refresh();
}

// ─── Recurring ────────────────────────────────────────────────────────────────
function renderRecurring() {
  const list = document.getElementById("recurring-list");
  list.innerHTML = "";

  if (state.editingRecurringId === "new") {
    list.appendChild(createRecurringEditCard(null));
  }

  if (state.recurring.length === 0 && state.editingRecurringId !== "new") {
    list.innerHTML = '<div class="empty-state">🔁<p>固定費がありません</p></div>';
    return;
  }

  // Hide items not yet started or superseded by a newer version
  const visible = state.recurring.filter(
    (r) => r.start_month <= state.month && (r.end_month == null || r.end_month >= state.month)
  );
  const groupedIds = new Set(state.recurringGroups.flatMap((g) => g.recurring_ids));
  const ungrouped = visible.filter((r) => !groupedIds.has(r.id));

  const visibleIds = new Set(visible.map((r) => r.id));
  state.recurringGroups.forEach((g) => {
    const groupItems = g.recurring_ids
      .map((id) => state.recurring.find((r) => r.id === id))
      .filter((r) => r && visibleIds.has(r.id));
    list.appendChild(createRecurringGroupCard(g, groupItems));
  });

  ungrouped.forEach((r) => {
    list.appendChild(
      state.editingRecurringId === r.id
        ? createRecurringEditCard(r)
        : createRecurringViewCard(r)
    );
  });
}

function createRecurringViewCard(item) {
  const li = document.createElement("li");
  li.className = "entry-card";
  li.style.opacity = item.active ? "1" : "0.45";
  li.tabIndex = 0;
  li.draggable = true;

  const sign = item.type === "income" ? "+" : "−";
  const startLabel = item.start_month > 1 ? `${item.start_month}月〜` : "毎月";
  li.innerHTML = `
    <div class="card-dot ${item.type}"></div>
    <span class="card-desc">${item.name}</span>
    <span class="card-date">${startLabel}</span>
    <span class="card-amount ${item.type}">${sign}${item.amount.toLocaleString()}円</span>
    <button class="recurring-toggle ${item.active ? "on" : ""}" title="${item.active ? "無効化" : "有効化"}"></button>
    <button class="card-del" title="削除 (Delete)">×</button>
  `;

  li.addEventListener("click", (e) => {
    if (e.target.classList.contains("card-del") || e.target.classList.contains("recurring-toggle")) return;
    state.editingRecurringId = item.id;
    renderRecurring();
    setTimeout(() => {
      document.querySelector(`[data-id="${item.id}"].editing .edit-amount`)?.focus();
    }, 30);
  });

  li.addEventListener("keydown", async (e) => {
    if (e.key === "Delete") { e.preventDefault(); await deleteRecurring(item.id); }
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); li.click(); }
  });

  li.querySelector(".recurring-toggle").addEventListener("click", async (e) => {
    e.stopPropagation();
    await withHistory(() => api.patch(`/api/${state.year}/recurring/${item.id}/toggle`));
    state.recurring = await api.get(`/api/${state.year}/recurring`);
    renderRecurring();
  });

  li.querySelector(".card-del").addEventListener("click", async (e) => {
    e.stopPropagation();
    await deleteRecurring(item.id);
  });

  // Drag for grouping
  li.addEventListener("dragstart", (e) => {
    e.stopPropagation();
    draggedRecurringId = item.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id);
    setTimeout(() => li.classList.add("dragging"), 0);
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    draggedRecurringId = null;
  });
  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedRecurringId) li.classList.add("drop-target");
  });
  li.addEventListener("dragleave", (e) => {
    if (!li.contains(e.relatedTarget)) li.classList.remove("drop-target");
  });
  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("drop-target");
    const dropped = e.dataTransfer.getData("text/plain");
    if (dropped && dropped !== item.id && draggedRecurringId) {
      await handleRecurringDrop(dropped, item.id);
    }
  });

  return li;
}

function createRecurringEditCard(item) {
  const li = document.createElement("li");
  li.className = "entry-card editing";
  if (item) li.dataset.id = item.id;

  const isIncome = item?.type === "income";

  const row = document.createElement("div");
  row.className = "edit-row";

  const typeToggle = createTypeToggle(isIncome);
  row.appendChild(typeToggle);

  const nameInput = document.createElement("input");
  nameInput.className = "edit-name";
  nameInput.type = "text";
  nameInput.placeholder = "名称 (例: Netflix)";
  nameInput.value = item?.name || "";
  row.appendChild(nameInput);

  const amountInput = document.createElement("input");
  amountInput.className = "edit-amount";
  amountInput.type = "number";
  amountInput.min = "1";
  amountInput.placeholder = "金額";
  amountInput.value = item?.amount || "";
  row.appendChild(amountInput);

  const saveBtn = document.createElement("button");
  saveBtn.className = "edit-save";
  saveBtn.title = "保存 (Enter)";
  saveBtn.textContent = "✓";
  row.appendChild(saveBtn);

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "edit-cancel";
  cancelBtn.title = "キャンセル (Esc)";
  cancelBtn.textContent = "✗";
  row.appendChild(cancelBtn);

  li.appendChild(row);

  const save = async () => {
    const amount = parseInt(amountInput.value, 10);
    if (!amount || amount <= 0) {
      amountInput.classList.add("input-error");
      amountInput.focus();
      setTimeout(() => amountInput.classList.remove("input-error"), 600);
      return;
    }
    const body = {
      type: typeToggle.querySelector(".type-btn.active").dataset.value,
      name: nameInput.value || "固定費",
      amount,
      category: "",
      start_month: item ? item.start_month : state.month,
    };
    await withHistory(() =>
      item
        ? api.put(`/api/${state.year}/recurring/${item.id}/from/${state.month}`, body)
        : api.post(`/api/${state.year}/recurring`, body)
    );
    state.editingRecurringId = null;
    state.recurring = await api.get(`/api/${state.year}/recurring`);
    renderRecurring();
    const [yearSummary, monthSummary] = await Promise.all([
      api.get(`/api/${state.year}/summary`),
      api.get(`/api/${state.year}/month/${state.month}/summary`),
    ]);
    state.yearSummary = yearSummary;
    state.monthSummary = monthSummary;
    renderMonthHeader();
    renderSidebar();
  };

  const cancel = () => {
    state.editingRecurringId = null;
    renderRecurring();
  };

  saveBtn.addEventListener("click", save);
  cancelBtn.addEventListener("click", cancel);
  li.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); save(); }
    if (e.key === "Escape") cancel();
  });

  if (!item) setTimeout(() => nameInput.focus(), 30);
  return li;
}

function createRecurringGroupCard(group, items) {
  const li = document.createElement("li");
  li.className = "group-card";
  li.dataset.groupId = group.id;
  li.draggable = true;

  const total = items.reduce(
    (s, r) => s + (r.type === "income" ? r.amount : -r.amount), 0
  );
  const totalClass = total >= 0 ? "income" : "expense";
  const totalStr = (total >= 0 ? "+" : "−") + Math.abs(total).toLocaleString() + "円";

  const isCollapsed = state.collapsedRecurringGroups.has(group.id);

  const header = document.createElement("div");
  header.className = "group-header";
  header.innerHTML = `
    <button class="group-drag-btn" title="ドラッグで並び替え">⠿</button>
    <button class="group-toggle-btn">${isCollapsed ? "▶" : "▼"}</button>
    <span class="group-name" contenteditable spellcheck="false">${group.name}</span>
    <span class="group-total ${totalClass}">${totalStr}</span>
    <button class="group-ungroup-btn">解除</button>
  `;

  const body = document.createElement("ul");
  body.className = "group-body";
  if (isCollapsed) body.style.display = "none";
  items.forEach((r) => {
    body.appendChild(
      state.editingRecurringId === r.id ? createRecurringEditCard(r) : createRecurringViewCard(r)
    );
  });

  header.querySelector(".group-toggle-btn").addEventListener("click", () => {
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "";
    header.querySelector(".group-toggle-btn").textContent = open ? "▶" : "▼";
    if (open) state.collapsedRecurringGroups.add(group.id);
    else state.collapsedRecurringGroups.delete(group.id);
  });

  const nameEl = header.querySelector(".group-name");
  nameEl.addEventListener("blur", async () => {
    const newName = nameEl.textContent.trim() || "グループ";
    if (newName !== group.name) {
      await withHistory(() =>
        api.put(`/api/${state.year}/recurring-groups/${group.id}`, { name: newName, recurring_ids: group.recurring_ids })
      );
      group.name = newName;
    }
  });
  nameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
  });

  header.querySelector(".group-ungroup-btn").addEventListener("click", async () => {
    await withHistory(() => api.del(`/api/${state.year}/recurring-groups/${group.id}`));
    state.collapsedRecurringGroups.delete(group.id);
    state.recurringGroups = await api.get(`/api/${state.year}/recurring-groups`);
    renderRecurring();
  });

  // Group drag (reorder)
  li.addEventListener("dragstart", (e) => {
    if (body.contains(e.target)) return;
    e.stopPropagation();
    draggedRecurringGroupId = group.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `rgroup:${group.id}`);
    setTimeout(() => li.classList.add("dragging"), 0);
  });
  li.addEventListener("dragend", () => {
    li.classList.remove("dragging");
    draggedRecurringGroupId = null;
    document.querySelectorAll(".group-card.reorder-target").forEach((el) => el.classList.remove("reorder-target"));
  });

  li.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (draggedRecurringGroupId && draggedRecurringGroupId !== group.id) {
      li.classList.add("reorder-target");
      li.classList.remove("drop-target");
    } else if (draggedRecurringId) {
      li.classList.add("drop-target");
      li.classList.remove("reorder-target");
    }
  });
  li.addEventListener("dragleave", (e) => {
    if (!li.contains(e.relatedTarget)) {
      li.classList.remove("drop-target");
      li.classList.remove("reorder-target");
    }
  });
  li.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("drop-target");
    li.classList.remove("reorder-target");

    if (draggedRecurringGroupId && draggedRecurringGroupId !== group.id) {
      await reorderRecurringGroups(draggedRecurringGroupId, group.id);
    } else if (draggedRecurringId) {
      const dropped = e.dataTransfer.getData("text/plain");
      if (dropped && !group.recurring_ids.includes(dropped)) {
        await withHistory(() =>
          api.put(`/api/${state.year}/recurring-groups/${group.id}`, {
            name: group.name,
            recurring_ids: [...group.recurring_ids, dropped],
          })
        );
        state.recurringGroups = await api.get(`/api/${state.year}/recurring-groups`);
        renderRecurring();
      }
    }
  });

  li.appendChild(header);
  li.appendChild(body);
  return li;
}

async function handleRecurringDrop(draggedId, targetId) {
  const draggedGroup = state.recurringGroups.find((g) => g.recurring_ids.includes(draggedId));
  const targetGroup = state.recurringGroups.find((g) => g.recurring_ids.includes(targetId));

  await withHistory(async () => {
    if (targetGroup) {
      if (!targetGroup.recurring_ids.includes(draggedId)) {
        if (draggedGroup && draggedGroup.id !== targetGroup.id) {
          const remaining = draggedGroup.recurring_ids.filter((id) => id !== draggedId);
          if (remaining.length === 0) {
            await api.del(`/api/${state.year}/recurring-groups/${draggedGroup.id}`);
          } else {
            await api.put(`/api/${state.year}/recurring-groups/${draggedGroup.id}`, {
              name: draggedGroup.name, recurring_ids: remaining,
            });
          }
        }
        await api.put(`/api/${state.year}/recurring-groups/${targetGroup.id}`, {
          name: targetGroup.name,
          recurring_ids: [...targetGroup.recurring_ids, draggedId],
        });
      }
    } else if (draggedGroup) {
      await api.put(`/api/${state.year}/recurring-groups/${draggedGroup.id}`, {
        name: draggedGroup.name,
        recurring_ids: [...draggedGroup.recurring_ids, targetId],
      });
    } else {
      await api.post(`/api/${state.year}/recurring-groups`, {
        name: "グループ",
        recurring_ids: [draggedId, targetId],
      });
    }
  });
  state.recurringGroups = await api.get(`/api/${state.year}/recurring-groups`);
  renderRecurring();
}

async function reorderRecurringGroups(draggedId, targetId) {
  const ids = state.recurringGroups.map((g) => g.id);
  const fromIdx = ids.indexOf(draggedId);
  const toIdx = ids.indexOf(targetId);
  if (fromIdx === -1 || toIdx === -1) return;
  ids.splice(fromIdx, 1);
  ids.splice(toIdx, 0, draggedId);
  await withHistory(() => api.put(`/api/${state.year}/recurring-groups/reorder`, { ids }));
  state.recurringGroups = await api.get(`/api/${state.year}/recurring-groups`);
  renderRecurring();
}

async function deleteRecurring(id) {
  if (!confirm("この固定費を削除しますか？")) return;
  await withHistory(async () => {
    for (const g of state.recurringGroups) {
      if (g.recurring_ids.includes(id)) {
        const remaining = g.recurring_ids.filter((rid) => rid !== id);
        if (remaining.length === 0) {
          await api.del(`/api/${state.year}/recurring-groups/${g.id}`);
        } else {
          await api.put(`/api/${state.year}/recurring-groups/${g.id}`, { name: g.name, recurring_ids: remaining });
        }
      }
    }
    await api.del(`/api/${state.year}/recurring/${id}`);
  });
  state.recurring = await api.get(`/api/${state.year}/recurring`);
  state.recurringGroups = await api.get(`/api/${state.year}/recurring-groups`);
  renderRecurring();
  const [yearSummary, monthSummary] = await Promise.all([
    api.get(`/api/${state.year}/summary`),
    api.get(`/api/${state.year}/month/${state.month}/summary`),
  ]);
  state.yearSummary = yearSummary;
  state.monthSummary = monthSummary;
  renderMonthHeader();
  renderSidebar();
}

// ─── Charts ───────────────────────────────────────────────────────────────────
let chartMonthly = null;
let chartBreakdown = null;

function renderCharts() {
  const monthly = state.yearSummary?.monthly ?? [];
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(document.getElementById("chart-monthly"), {
    type: "bar",
    data: {
      labels: monthly.map((m) => MONTHS[m.month - 1]),
      datasets: [
        { label: "収入", data: monthly.map((m) => m.income), backgroundColor: "rgba(74,222,128,0.7)", borderRadius: 3 },
        { label: "支出", data: monthly.map((m) => m.expense), backgroundColor: "rgba(248,113,113,0.7)", borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e2e8f0", font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: "#7c8db5", font: { size: 10 } }, grid: { color: "#2e3347" } },
        y: { ticks: { color: "#7c8db5", font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: "#2e3347" } },
      },
    },
  });

  const s = state.monthSummary;
  if (chartBreakdown) chartBreakdown.destroy();
  if (s) {
    chartBreakdown = new Chart(document.getElementById("chart-breakdown"), {
      type: "doughnut",
      data: {
        labels: ["収入", "固定支出", "単発支出"],
        datasets: [{
          data: [s.total_income, s.recurring_expense, s.entry_expense],
          backgroundColor: ["rgba(74,222,128,0.8)", "rgba(248,113,113,0.5)", "rgba(248,113,113,0.9)"],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom", labels: { color: "#e2e8f0", font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toLocaleString()}円` } },
        },
      },
    });
  }
}

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
