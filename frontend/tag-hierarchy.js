// ─── Tag Hierarchy Settings ───────────────────────────────────────────────────
function hasCycle(hierarchy) {
    for (const startTag of Object.keys(hierarchy)) {
        const visited = new Set([startTag]);
        let cur = hierarchy[startTag];
        while (cur) {
            if (visited.has(cur)) return true;
            visited.add(cur);
            cur = hierarchy[cur];
        }
    }
    return false;
}

function renderTagHierarchySettings() {
    const container = document.getElementById("hierarchy-settings");
    if (!container) return;
    container.innerHTML = "";

    if (state.allTags.length === 0) {
        const empty = document.createElement("p");
        empty.className = "settings-empty";
        empty.textContent = "タグが設定された明細がありません";
        container.appendChild(empty);
        return;
    }

    const table = document.createElement("div");
    table.className = "hierarchy-table";

    state.allTags.forEach((tag) => {
        const row = document.createElement("div");
        row.className = "hierarchy-row";

        const chip = document.createElement("span");
        chip.className = "tag-chip hierarchy-tag-label";
        chip.textContent = tag;
        row.appendChild(chip);

        const arrow = document.createElement("span");
        arrow.className = "hierarchy-arrow";
        arrow.textContent = "→ 親:";
        row.appendChild(arrow);

        const sel = document.createElement("select");
        sel.className = "hierarchy-parent-select";
        sel.dataset.tag = tag;

        const noneOpt = document.createElement("option");
        noneOpt.value = "";
        noneOpt.textContent = "（なし）";
        sel.appendChild(noneOpt);

        state.allTags.filter((t) => t !== tag).forEach((t) => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            if (state.tagHierarchy[tag] === t) opt.selected = true;
            sel.appendChild(opt);
        });

        row.appendChild(sel);
        table.appendChild(row);
    });

    container.appendChild(table);

    const actions = document.createElement("div");
    actions.className = "settings-actions";

    const inheritBtn = document.createElement("button");
    inheritBtn.className = "btn btn-ghost";
    inheritBtn.textContent = "前年から引き継ぐ";
    inheritBtn.addEventListener("click", async () => {
        const prevHierarchy = await api.get(`/api/${state.year - 1}/tag-hierarchy`).catch(() => ({}));
        if (!prevHierarchy || Object.keys(prevHierarchy).length === 0) {
            inheritBtn.textContent = "前年の設定なし";
            setTimeout(() => { inheritBtn.textContent = "前年から引き継ぐ"; }, 1500);
            return;
        }
        container.querySelectorAll(".hierarchy-parent-select").forEach((s) => {
            const parent = prevHierarchy[s.dataset.tag];
            s.value = parent || "";
        });
        inheritBtn.textContent = "反映済み（保存してください）";
        setTimeout(() => { inheritBtn.textContent = "前年から引き継ぐ"; }, 2000);
    });
    actions.appendChild(inheritBtn);

    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary";
    saveBtn.textContent = "保存";
    saveBtn.addEventListener("click", async () => {
        const hierarchy = {};
        container.querySelectorAll(".hierarchy-parent-select").forEach((s) => {
            if (s.value) hierarchy[s.dataset.tag] = s.value;
        });
        if (hasCycle(hierarchy)) {
            alert("循環参照が検出されました。親子関係を確認してください。");
            return;
        }
        state.tagHierarchy = await api.put(`/api/${state.year}/tag-hierarchy`, hierarchy);
        saveBtn.textContent = "保存済み ✓";
        setTimeout(() => { saveBtn.textContent = "保存"; }, 1500);
    });
    actions.appendChild(saveBtn);

    container.appendChild(actions);
}
