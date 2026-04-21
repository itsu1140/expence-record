from fastapi import APIRouter

from app.models import UpdateState, YearData
from app.storage import list_years, load_year, save_year

router = APIRouter(prefix="/api", tags=["summary"])


@router.get("/years")
def get_years() -> list[int]:
    return list_years()


@router.get("/{year}/state")
def get_state(year: int) -> dict:
    data = load_year(year)
    return {
        "year": data.year,
        "last_opened_month": data.last_opened_month,
        "initial_balance": data.initial_balance,
    }


@router.put("/{year}/state")
def update_state(year: int, body: UpdateState) -> dict:
    data = load_year(year)
    if body.last_opened_month is not None:
        data.last_opened_month = body.last_opened_month
    if body.initial_balance is not None:
        data.initial_balance = body.initial_balance
    save_year(data)
    return {
        "year": data.year,
        "last_opened_month": data.last_opened_month,
        "initial_balance": data.initial_balance,
    }


@router.get("/{year}/full")
def get_full_data(year: int) -> YearData:
    return load_year(year)


@router.put("/{year}/restore", status_code=204)
def restore_data(year: int, body: YearData) -> None:
    body = body.model_copy(update={"year": year})
    save_year(body)


@router.get("/{year}/summary")
def get_year_summary(year: int) -> dict:
    data = load_year(year)

    monthly: dict[int, dict] = {m: {"income": 0, "expense": 0} for m in range(1, 13)}

    for entry in data.entries:
        monthly[entry.date.month][entry.type.value] += entry.amount

    active_recurring = [r for r in data.recurring if r.active]
    for r in active_recurring:
        end = r.end_month if r.end_month is not None else 12
        for m in range(r.start_month, end + 1):
            monthly[m][r.type.value] += r.amount

    result = []
    for m in range(1, 13):
        inc = monthly[m]["income"]
        exp = monthly[m]["expense"]
        result.append({"month": m, "income": inc, "expense": exp, "balance": inc - exp})

    total_income = sum(x["income"] for x in result)
    total_expense = sum(x["expense"] for x in result)
    total_balance = total_income - total_expense

    return {
        "year": year,
        "initial_balance": data.initial_balance,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_balance": total_balance,
        "ending_balance": data.initial_balance + total_balance,
        "monthly": result,
    }


@router.get("/{year}/tags")
def get_tags(year: int) -> list[str]:
    return load_year(year).all_tags


@router.get("/{year}/month/{month}/tag-summary")
def get_month_tag_summary(year: int, month: int) -> list[dict]:
    data = load_year(year)
    entries = [e for e in data.entries if e.date.month == month]
    order: list[str] = []
    totals: dict[str, dict] = {}
    for entry in entries:
        for tag in entry.tags:
            if tag not in totals:
                totals[tag] = {"income": 0, "expense": 0}
                order.append(tag)
            totals[tag][entry.type.value] += entry.amount
    return [{"tag": t, **totals[t]} for t in order]


@router.get("/{year}/tag-summary")
def get_year_tag_summary(year: int) -> list[dict]:
    data = load_year(year)
    order: list[str] = []
    totals: dict[str, dict] = {}
    for entry in data.entries:
        for tag in entry.tags:
            if tag not in totals:
                totals[tag] = {"income": 0, "expense": 0}
                order.append(tag)
            totals[tag][entry.type.value] += entry.amount
    return [{"tag": t, **totals[t]} for t in order]


@router.get("/{year}/month/{month}/summary")
def get_month_summary(year: int, month: int) -> dict:
    data = load_year(year)
    entries = [e for e in data.entries if e.date.month == month]
    active_recurring = [
        r
        for r in data.recurring
        if r.active
        and r.start_month <= month
        and (r.end_month is None or r.end_month >= month)
    ]

    categories: dict[str, dict] = {}

    for entry in entries:
        cat = entry.category or "未分類"
        if cat not in categories:
            categories[cat] = {"income": 0, "expense": 0}
        categories[cat][entry.type.value] += entry.amount

    recurring_totals = {"income": 0, "expense": 0}
    for r in active_recurring:
        cat = r.category or "未分類"
        if cat not in categories:
            categories[cat] = {"income": 0, "expense": 0}
        categories[cat][r.type.value] += r.amount
        recurring_totals[r.type.value] += r.amount

    entry_income = sum(e.amount for e in entries if e.type.value == "income")
    entry_expense = sum(e.amount for e in entries if e.type.value == "expense")
    total_income = entry_income + recurring_totals["income"]
    total_expense = entry_expense + recurring_totals["expense"]

    return {
        "year": year,
        "month": month,
        "total_income": total_income,
        "total_expense": total_expense,
        "balance": total_income - total_expense,
        "recurring_income": recurring_totals["income"],
        "recurring_expense": recurring_totals["expense"],
        "entry_income": entry_income,
        "entry_expense": entry_expense,
        "categories": [{"category": cat, **vals} for cat, vals in categories.items()],
    }
