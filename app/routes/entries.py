from fastapi import APIRouter, HTTPException

from app.models import CreateEntry, Entry
from app.storage import load_year, save_year

router = APIRouter(prefix="/api/{year}/entries", tags=["entries"])


def _sync_tags(data, tags):
    for tag in tags:
        if tag and tag not in data.all_tags:
            data.all_tags.append(tag)


@router.get("")
def get_entries(year: int, month: int | None = None) -> list[Entry]:
    data = load_year(year)
    entries = data.entries
    if month is not None:
        entries = [e for e in entries if e.date.month == month]
    return sorted(entries, key=lambda e: e.date)


@router.post("", status_code=201)
def create_entry(year: int, body: CreateEntry) -> Entry:
    data = load_year(year)
    entry = Entry(**body.model_dump())
    data.entries.append(entry)
    _sync_tags(data, entry.tags)
    save_year(data)
    return entry


@router.put("/{entry_id}")
def update_entry(year: int, entry_id: str, body: CreateEntry) -> Entry:
    data = load_year(year)
    for i, e in enumerate(data.entries):
        if e.id == entry_id:
            updated = Entry(id=entry_id, **body.model_dump())
            data.entries[i] = updated
            _sync_tags(data, updated.tags)
            save_year(data)
            return updated
    raise HTTPException(status_code=404, detail="Entry not found")


@router.delete("/{entry_id}", status_code=204)
def delete_entry(year: int, entry_id: str) -> None:
    data = load_year(year)
    before = len(data.entries)
    data.entries = [e for e in data.entries if e.id != entry_id]
    if len(data.entries) == before:
        raise HTTPException(status_code=404, detail="Entry not found")
    save_year(data)
