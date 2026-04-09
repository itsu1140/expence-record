from enum import Enum
from datetime import date
import uuid

from pydantic import BaseModel, Field


class EntryType(str, Enum):
    income = "income"
    expense = "expense"


class Entry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: date
    amount: int
    category: str = ""
    description: str = ""
    type: EntryType
    is_recurring: bool = False
    recurring_id: str | None = None


class RecurringItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: int
    category: str = ""
    type: EntryType
    active: bool = True
    start_month: int = 1
    end_month: int | None = None  # None = no expiry; set when item is superseded by a newer version


class Group(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "グループ"
    entry_ids: list[str] = Field(default_factory=list)


class RecurringGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "グループ"
    recurring_ids: list[str] = Field(default_factory=list)


class YearData(BaseModel):
    year: int
    last_opened_month: int = 1
    initial_balance: int = 0
    recurring: list[RecurringItem] = Field(default_factory=list)
    entries: list[Entry] = Field(default_factory=list)
    groups: list[Group] = Field(default_factory=list)
    recurring_groups: list[RecurringGroup] = Field(default_factory=list)


class CreateEntry(BaseModel):
    date: date
    amount: int
    category: str = ""
    description: str = ""
    type: EntryType


class CreateRecurring(BaseModel):
    name: str
    amount: int
    category: str = ""
    type: EntryType
    start_month: int = 1


class CreateGroup(BaseModel):
    name: str = "グループ"
    entry_ids: list[str] = Field(default_factory=list)


class UpdateGroup(BaseModel):
    name: str
    entry_ids: list[str]


class CreateRecurringGroup(BaseModel):
    name: str = "グループ"
    recurring_ids: list[str] = Field(default_factory=list)


class UpdateRecurringGroup(BaseModel):
    name: str
    recurring_ids: list[str]


class ReorderIds(BaseModel):
    ids: list[str]


class UpdateState(BaseModel):
    last_opened_month: int | None = None
    initial_balance: int | None = None
