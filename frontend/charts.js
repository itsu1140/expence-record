// ─── Charts ───────────────────────────────────────────────────────────────────
const TAG_BAR_OPTIONS = {
    indexAxis: "y",
    responsive: true,
    plugins: { legend: { labels: { color: "#e2e8f0", font: { size: 11 } } } },
    scales: {
        x: { ticks: { color: "#7c8db5", font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: "#2e3347" } },
        y: { ticks: { color: "#7c8db5", font: { size: 11 } }, grid: { color: "#2e3347" } },
    },
};

let chartMonthly = null;
let chartBreakdown = null;
let chartTags = null;
let chartTagMonthly = null;

// ─── Tag Filter State ─────────────────────────────────────────────────────────
let selectedChartTags = new Set();
let chartTagFilterInitialized = false;

function resetChartTagFilter() {
    selectedChartTags = new Set();
    chartTagFilterInitialized = false;
}

function syncChartTagFilter() {
    // Remove tags that no longer exist
    [...selectedChartTags].forEach((t) => {
        if (!state.allTags.includes(t)) selectedChartTags.delete(t);
    });
    // On first load after reset, select all by default
    if (!chartTagFilterInitialized) {
        state.allTags.forEach((t) => selectedChartTags.add(t));
        chartTagFilterInitialized = true;
    }
}

function renderTagFilter() {
    const section = document.getElementById("tag-filter-section");
    if (!section) return;
    section.innerHTML = "";

    if (state.allTags.length === 0) {
        section.style.display = "none";
        return;
    }
    section.style.display = "";
    syncChartTagFilter();

    const header = document.createElement("div");
    header.className = "tag-filter-header";

    const label = document.createElement("span");
    label.className = "tag-filter-label";
    label.textContent = "タグフィルター";
    header.appendChild(label);

    const bulk = document.createElement("div");
    bulk.className = "tag-filter-bulk";

    const makeBtn = (text, action) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tag-filter-bulk-btn";
        b.textContent = text;
        b.addEventListener("click", () => {
            action();
            renderTagFilter();
            renderFilteredChart();
        });
        return b;
    };

    bulk.appendChild(makeBtn("全選択", () => {
        if (state.allTags.every((t) => selectedChartTags.has(t))) {
            selectedChartTags.clear();
        } else {
            state.allTags.forEach((t) => selectedChartTags.add(t));
        }
    }));
    bulk.appendChild(makeBtn("収入", () => {
        selectedChartTags.clear();
        state.yearTagSummary.filter((t) => t.income > 0).forEach((t) => selectedChartTags.add(t.tag));
    }));
    bulk.appendChild(makeBtn("支出", () => {
        selectedChartTags.clear();
        state.yearTagSummary.filter((t) => t.expense > 0).forEach((t) => selectedChartTags.add(t.tag));
    }));

    header.appendChild(bulk);
    section.appendChild(header);

    const chips = document.createElement("div");
    chips.className = "tag-filter-chips";
    state.allTags.forEach((tag) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag-chip tag-filter-chip" + (selectedChartTags.has(tag) ? " active" : "");
        chip.textContent = tag;
        chip.addEventListener("click", () => {
            if (selectedChartTags.has(tag)) selectedChartTags.delete(tag);
            else selectedChartTags.add(tag);
            chip.classList.toggle("active", selectedChartTags.has(tag));
            renderFilteredChart();
        });
        chips.appendChild(chip);
    });
    section.appendChild(chips);
}

function renderFilteredChart() {
    if (chartTagMonthly) chartTagMonthly.destroy();
    chartTagMonthly = null;

    const canvas = document.getElementById("chart-tag-monthly");
    const noFilterMsg = document.getElementById("no-filter-msg");
    if (!canvas) return;

    if (selectedChartTags.size === 0) {
        if (noFilterMsg) noFilterMsg.style.display = "";
        return;
    }
    if (noFilterMsg) noFilterMsg.style.display = "none";

    const filtered = (state.yearTagSummary || []).filter((t) => selectedChartTags.has(t.tag));

    chartTagMonthly = new Chart(canvas, {
        type: "bar",
        data: {
            labels: filtered.map((t) => t.tag),
            datasets: [
                { label: "収入", data: filtered.map((t) => t.income), backgroundColor: "rgba(74,222,128,0.7)", borderRadius: 3 },
                { label: "支出", data: filtered.map((t) => t.expense), backgroundColor: "rgba(248,113,113,0.7)", borderRadius: 3 },
            ],
        },
        options: TAG_BAR_OPTIONS,
    });
}

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

    if (chartTags) chartTags.destroy();
    chartTags = null;
    const tagData = state.tagSummary ?? [];
    const noTagsMsg = document.getElementById("no-tags-msg");
    if (tagData.length > 0) {
        if (noTagsMsg) noTagsMsg.style.display = "none";
        chartTags = new Chart(document.getElementById("chart-tags"), {
            type: "bar",
            data: {
                labels: tagData.map((t) => t.tag),
                datasets: [
                    { label: "収入", data: tagData.map((t) => t.income), backgroundColor: "rgba(74,222,128,0.7)", borderRadius: 3 },
                    { label: "支出", data: tagData.map((t) => t.expense), backgroundColor: "rgba(248,113,113,0.7)", borderRadius: 3 },
                ],
            },
            options: TAG_BAR_OPTIONS,
        });
    } else {
        if (noTagsMsg) noTagsMsg.style.display = "";
    }

    renderTagFilter();
    renderFilteredChart();
}
