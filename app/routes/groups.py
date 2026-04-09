from fastapi import APIRouter, HTTPException

from app.models import CreateGroup, Group, ReorderIds, UpdateGroup
from app.storage import load_year, save_year

router = APIRouter(prefix="/api/{year}/groups", tags=["groups"])


@router.get("")
def get_groups(year: int) -> list[Group]:
    return load_year(year).groups


@router.post("", status_code=201)
def create_group(year: int, body: CreateGroup) -> Group:
    data = load_year(year)
    group = Group(**body.model_dump())
    data.groups.append(group)
    save_year(data)
    return group


@router.put("/reorder", status_code=204)
def reorder_groups(year: int, body: ReorderIds) -> None:
    data = load_year(year)
    id_map = {g.id: g for g in data.groups}
    data.groups = [id_map[id] for id in body.ids if id in id_map]
    save_year(data)


@router.put("/{group_id}")
def update_group(year: int, group_id: str, body: UpdateGroup) -> Group:
    data = load_year(year)
    for i, g in enumerate(data.groups):
        if g.id == group_id:
            data.groups[i] = g.model_copy(update=body.model_dump())
            save_year(data)
            return data.groups[i]
    raise HTTPException(status_code=404, detail="Group not found")


@router.delete("/{group_id}", status_code=204)
def delete_group(year: int, group_id: str) -> None:
    data = load_year(year)
    data.groups = [g for g in data.groups if g.id != group_id]
    save_year(data)
