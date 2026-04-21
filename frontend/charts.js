// ─── Charts ───────────────────────────────────────────────────────────────────
let chartMonthly = null;
let chartBreakdown = null;
let chartTags = null;
let chartYearTags = null;

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

    // Tag chart
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
            options: {
                indexAxis: "y",
                responsive: true,
                plugins: { legend: { labels: { color: "#e2e8f0", font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: "#7c8db5", font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: "#2e3347" } },
                    y: { ticks: { color: "#7c8db5", font: { size: 11 } }, grid: { color: "#2e3347" } },
                },
            },
        });
    } else {
        if (noTagsMsg) noTagsMsg.style.display = "";
    }

    // Year tag chart
    if (chartYearTags) chartYearTags.destroy();
    chartYearTags = null;
    const yearTagData = state.yearTagSummary ?? [];
    const noYearTagsMsg = document.getElementById("no-year-tags-msg");
    if (yearTagData.length > 0) {
        if (noYearTagsMsg) noYearTagsMsg.style.display = "none";
        chartYearTags = new Chart(document.getElementById("chart-year-tags"), {
            type: "bar",
            data: {
                labels: yearTagData.map((t) => t.tag),
                datasets: [
                    { label: "収入", data: yearTagData.map((t) => t.income), backgroundColor: "rgba(74,222,128,0.7)", borderRadius: 3 },
                    { label: "支出", data: yearTagData.map((t) => t.expense), backgroundColor: "rgba(248,113,113,0.7)", borderRadius: 3 },
                ],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                plugins: { legend: { labels: { color: "#e2e8f0", font: { size: 11 } } } },
                scales: {
                    x: { ticks: { color: "#7c8db5", font: { size: 10 }, callback: (v) => v.toLocaleString() }, grid: { color: "#2e3347" } },
                    y: { ticks: { color: "#7c8db5", font: { size: 11 } }, grid: { color: "#2e3347" } },
                },
            },
        });
    } else {
        if (noYearTagsMsg) noYearTagsMsg.style.display = "";
    }
}
