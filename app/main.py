from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.routes import entries, groups, recurring, recurring_groups, summary

app = FastAPI(title="明細管理アプリ")

app.include_router(entries.router)
app.include_router(recurring.router)
app.include_router(groups.router)
app.include_router(recurring_groups.router)
app.include_router(summary.router)

FRONTEND_DIR = Path("frontend")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
