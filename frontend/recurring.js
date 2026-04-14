// ─── Recurring ────────────────────────────────────────────────────────────────
let draggedRecurringId = null;
let draggedRecurringGroupId = null;

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
    const startLabel = `${state.year}年${item.start_month}月〜`;
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

    let saving = false;
    const save = async () => {
        if (saving) return;
        saving = true;
        const amount = parseInt(amountInput.value, 10);
        if (!amount || amount <= 0) {
            saving = false;
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
    li.addEventListener("focusout", (e) => {
        if (li.contains(e.relatedTarget)) return;
        if (e.relatedTarget === cancelBtn) return;
        save();
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
