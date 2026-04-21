// ─── Entry Cards ──────────────────────────────────────────────────────────────
let draggedEntryId = null;
let draggedGroupId = null;

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

    // Virtual tag groups for ungrouped entries
    const tagOrder = [];
    const tagGroupMap = {};
    const noTag = [];
    ungrouped.forEach((e) => {
        if (e.tags && e.tags.length > 0) {
            const tag = e.tags[0];
            if (!tagGroupMap[tag]) {
                tagGroupMap[tag] = [];
                tagOrder.push(tag);
            }
            tagGroupMap[tag].push(e);
        } else {
            noTag.push(e);
        }
    });

    tagOrder.forEach((tag) => {
        const entries = tagGroupMap[tag].sort((a, b) => a.date.localeCompare(b.date));
        list.appendChild(createTagGroupCard(tag, entries));
    });

    noTag.forEach((e) => {
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
            if (e.key === "Enter") e.preventDefault();
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

    if (entry.tags && entry.tags.length > 0) {
        const tagsEl = document.createElement("div");
        tagsEl.className = "card-tags";
        entry.tags.forEach((tag) => {
            const chip = document.createElement("span");
            chip.className = "tag-chip";
            chip.textContent = tag;
            tagsEl.appendChild(chip);
        });
        li.insertBefore(tagsEl, li.querySelector(".card-date"));
    }

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
        e.stopPropagation();
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
    const pendingTags = [...(entry?.tags || [])];

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
    li.appendChild(createTagsEditRow(pendingTags));

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
            date: dateInput.value,
            amount,
            description: descInput.value,
            category: "",
            tags: pendingTags,
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
        document.querySelector(".tag-picker")?.remove();
        state.editingEntryId = null;
        renderEntries();
    };

    saveBtn.addEventListener("click", save);
    cancelBtn.addEventListener("click", cancel);
    li.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
        if (e.key === "Escape") cancel();
    });
    li.addEventListener("focusout", (e) => {
        if (li.contains(e.relatedTarget)) return;
        if (e.relatedTarget === cancelBtn) return;
        if (e.relatedTarget === saveBtn) return;
        if (document.querySelector(".tag-picker")) return;
        save();
    });

    if (!entry) setTimeout(() => descInput.focus(), 30);
    return li;
}

// ─── Tag Edit UI ──────────────────────────────────────────────────────────────
function createTagsEditRow(pendingTags) {
    const row = document.createElement("div");
    row.className = "edit-tags-row";

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "tag-add-btn";
    addBtn.textContent = "+ タグ";
    row.appendChild(addBtn);

    function renderChips() {
        row.querySelectorAll(".tag-chip").forEach((c) => c.remove());
        pendingTags.forEach((tag, i) => {
            const chip = document.createElement("span");
            chip.className = "tag-chip removable";

            const label = document.createElement("span");
            label.textContent = tag;
            chip.appendChild(label);

            const rm = document.createElement("button");
            rm.type = "button";
            rm.className = "tag-chip-rm";
            rm.textContent = "×";
            rm.addEventListener("mousedown", (e) => {
                e.preventDefault();
                pendingTags.splice(i, 1);
                renderChips();
            });
            chip.appendChild(rm);

            row.insertBefore(chip, addBtn);
        });
    }

    addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showTagPicker(addBtn, pendingTags, (tag) => {
            if (tag && !pendingTags.includes(tag)) {
                pendingTags.push(tag);
                renderChips();
            }
        });
    });

    renderChips();
    return row;
}

function showTagPicker(anchor, pendingTags, onAdd) {
    document.querySelector(".tag-picker")?.remove();

    const picker = document.createElement("div");
    picker.className = "tag-picker";

    const available = state.allTags.filter((t) => !pendingTags.includes(t));
    if (available.length > 0) {
        const list = document.createElement("div");
        list.className = "tag-picker-list";
        available.forEach((tag) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "tag-chip";
            btn.textContent = tag;
            btn.addEventListener("mousedown", (e) => {
                e.preventDefault();
                onAdd(tag);
                closePicker();
            });
            list.appendChild(btn);
        });
        picker.appendChild(list);
    }

    const input = document.createElement("input");
    input.className = "tag-picker-input";
    input.placeholder = "新しいタグ名を入力...";
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const val = input.value.trim();
            if (val) onAdd(val);
            closePicker();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            closePicker();
        }
    });
    picker.appendChild(input);

    document.body.appendChild(picker);
    const rect = anchor.getBoundingClientRect();
    const pickerH = picker.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < pickerH + 8 && rect.top > spaceBelow) {
        picker.style.top = `${rect.top - pickerH - 4}px`;
    } else {
        picker.style.top = `${rect.bottom + 4}px`;
    }
    picker.style.left = `${rect.left}px`;

    function closePicker() {
        picker.remove();
        document.removeEventListener("mousedown", outsideClick);
        anchor.focus();
    }

    function outsideClick(e) {
        if (!picker.contains(e.target) && e.target !== anchor) {
            closePicker();
        }
    }

    document.addEventListener("mousedown", outsideClick);
    requestAnimationFrame(() => input.focus());
}

// ─── Tag Group Card ───────────────────────────────────────────────────────────
function createTagGroupCard(tag, entries) {
    const li = document.createElement("li");
    li.className = "group-card";
    li.dataset.tagGroup = tag;

    const total = entries.reduce(
        (s, e) => s + (e.type === "income" ? e.amount : -e.amount), 0
    );
    const totalClass = total >= 0 ? "income" : "expense";
    const totalStr = (total >= 0 ? "+" : "−") + Math.abs(total).toLocaleString() + "円";
    const isCollapsed = state.collapsedTagGroups.has(tag);

    const header = document.createElement("div");
    header.className = "group-header";

    const tagChip = document.createElement("span");
    tagChip.className = "tag-chip";
    tagChip.textContent = tag;
    header.appendChild(tagChip);

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "group-toggle-btn";
    toggleBtn.textContent = isCollapsed ? "▶" : "▼";
    header.appendChild(toggleBtn);

    const totalEl = document.createElement("span");
    totalEl.className = `group-total ${totalClass}`;
    totalEl.textContent = totalStr;
    header.appendChild(totalEl);

    const body = document.createElement("ul");
    body.className = "group-body";
    if (isCollapsed) body.style.display = "none";
    entries.forEach((e) => {
        body.appendChild(
            state.editingEntryId === e.id ? createEntryEditCard(e) : createEntryViewCard(e)
        );
    });

    toggleBtn.addEventListener("click", () => {
        const open = body.style.display !== "none";
        body.style.display = open ? "none" : "";
        toggleBtn.textContent = open ? "▶" : "▼";
        if (open) state.collapsedTagGroups.add(tag);
        else state.collapsedTagGroups.delete(tag);
    });

    li.appendChild(header);
    li.appendChild(body);
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

    li.addEventListener("dragstart", (e) => {
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
