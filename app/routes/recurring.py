from fastapi import APIRouter, HTTPException

from app.models import CreateRecurring, RecurringItem
from app.storage import load_year, save_year

# Helper to check if month is in the valid range of a recurring item
def _in_range(r: RecurringItem, month: int) -> bool:
    return r.start_month <= month and (r.end_month is None or r.end_month >= month)

router = APIRouter(prefix="/api/{year}/recurring", tags=["recurring"])


@router.get("")
def get_recurring(year: int) -> list[RecurringItem]:
    return load_year(year).recurring


@router.post("", status_code=201)
def create_recurring(year: int, body: CreateRecurring) -> RecurringItem:
    data = load_year(year)
    item = RecurringItem(**body.model_dump())
    data.recurring.append(item)
    save_year(data)
    return item


@router.put("/{item_id}/from/{month}")
def update_recurring_from_month(year: int, item_id: str, month: int, body: CreateRecurring) -> RecurringItem:
    """Update a recurring item starting from the given month.

    - If month <= item.start_month: update in place (no past months to protect).
    - Otherwise: cap the old item at end_month=month-1 and create a new item
      starting at month. Group membership is transferred to the new item.
    """
    data = load_year(year)
    item = next((r for r in data.recurring if r.id == item_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Recurring item not found")

    if month <= item.start_month:
        # No history to protect — update in place
        for i, r in enumerate(data.recurring):
            if r.id == item_id:
                data.recurring[i] = r.model_copy(update={
                    "name": body.name,
                    "amount": body.amount,
                    "category": body.category,
                    "type": body.type,
                })
                save_year(data)
                return data.recurring[i]

    # Split: cap old item, create new one from `month`
    for i, r in enumerate(data.recurring):
        if r.id == item_id:
            data.recurring[i] = r.model_copy(update={"end_month": month - 1})
            break

    new_item = RecurringItem(
        name=body.name,
        amount=body.amount,
        category=body.category,
        type=body.type,
        active=item.active,
        start_month=month,
    )
    data.recurring.append(new_item)

    # Transfer group membership from old item to new item
    for g in data.recurring_groups:
        if item_id in g.recurring_ids:
            g.recurring_ids = [new_item.id if rid == item_id else rid for rid in g.recurring_ids]

    save_year(data)
    return new_item


@router.put("/{item_id}")
def update_recurring(year: int, item_id: str, body: CreateRecurring) -> RecurringItem:
    data = load_year(year)
    for i, r in enumerate(data.recurring):
        if r.id == item_id:
            updated = r.model_copy(update={
                "name": body.name,
                "amount": body.amount,
                "category": body.category,
                "type": body.type,
                # start_month preserved; not overwritten on edit
            })
            data.recurring[i] = updated
            save_year(data)
            return updated
    raise HTTPException(status_code=404, detail="Recurring item not found")


@router.patch("/{item_id}/toggle")
def toggle_recurring(year: int, item_id: str) -> RecurringItem:
    data = load_year(year)
    for i, r in enumerate(data.recurring):
        if r.id == item_id:
            data.recurring[i] = r.model_copy(update={"active": not r.active})
            save_year(data)
            return data.recurring[i]
    raise HTTPException(status_code=404, detail="Recurring item not found")


@router.delete("/{item_id}", status_code=204)
def delete_recurring(year: int, item_id: str) -> None:
    data = load_year(year)
    before = len(data.recurring)
    data.recurring = [r for r in data.recurring if r.id != item_id]
    if len(data.recurring) == before:
        raise HTTPException(status_code=404, detail="Recurring item not found")
    save_year(data)
