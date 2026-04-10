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
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const upToMonth = state.year < currentYear ? 12
        : state.year > currentYear ? 0
        : currentMonth;
    const balanceUpToNow = (s.monthly ?? [])
        .filter((m) => m.month <= upToMonth)
        .reduce((sum, m) => sum + m.balance, 0);
    const ending = s.initial_balance + balanceUpToNow;
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
