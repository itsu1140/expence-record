from fastapi import APIRouter, HTTPException

from app.models import CreateRecurringGroup, RecurringGroup, ReorderIds, UpdateRecurringGroup
from app.storage import load_year, save_year

router = APIRouter(prefix="/api/{year}/recurring-groups", tags=["recurring-groups"])


@router.get("")
def get_recurring_groups(year: int) -> list[RecurringGroup]:
    return load_year(year).recurring_groups


@router.post("", status_code=201)
def create_recurring_group(year: int, body: CreateRecurringGroup) -> RecurringGroup:
    data = load_year(year)
    group = RecurringGroup(**body.model_dump())
    data.recurring_groups.append(group)
    save_year(data)
    return group


@router.put("/reorder", status_code=204)
def reorder_recurring_groups(year: int, body: ReorderIds) -> None:
    data = load_year(year)
    id_map = {g.id: g for g in data.recurring_groups}
    data.recurring_groups = [id_map[id] for id in body.ids if id in id_map]
    save_year(data)


@router.put("/{group_id}")
def update_recurring_group(year: int, group_id: str, body: UpdateRecurringGroup) -> RecurringGroup:
    data = load_year(year)
    for i, g in enumerate(data.recurring_groups):
        if g.id == group_id:
            data.recurring_groups[i] = g.model_copy(update=body.model_dump())
            save_year(data)
            return data.recurring_groups[i]
    raise HTTPException(status_code=404, detail="RecurringGroup not found")


@router.delete("/{group_id}", status_code=204)
def delete_recurring_group(year: int, group_id: str) -> None:
    data = load_year(year)
    data.recurring_groups = [g for g in data.recurring_groups if g.id != group_id]
    save_year(data)
