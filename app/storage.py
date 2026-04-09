import json
from pathlib import Path

from app.models import YearData

DATA_DIR = Path("data")


def get_data_path(year: int) -> Path:
    return DATA_DIR / f"{year}.json"


def load_year(year: int) -> YearData:
    path = get_data_path(year)
    if not path.exists():
        data = YearData(year=year)
        save_year(data)
        return data
    with path.open(encoding="utf-8") as f:
        return YearData.model_validate(json.load(f))


def save_year(data: YearData) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = get_data_path(data.year)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data.model_dump(mode="json"), f, ensure_ascii=False, indent=2)


def list_years() -> list[int]:
    if not DATA_DIR.exists():
        return []
    return sorted(int(p.stem) for p in DATA_DIR.glob("*.json") if p.stem.isdigit())
