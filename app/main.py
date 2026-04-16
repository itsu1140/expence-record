import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.routes import entries, groups, recurring, recurring_groups, summary

ROOT_PATH = os.getenv("ROOT_PATH", "")

app = FastAPI(title="明細管理アプリ", root_path=ROOT_PATH)

app.include_router(entries.router)
app.include_router(recurring.router)
app.include_router(groups.router)
app.include_router(recurring_groups.router)
app.include_router(summary.router)

FRONTEND_DIR = Path("frontend")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

_INDEX_TEMPLATE = (FRONTEND_DIR / "index.html").read_text()


@app.get("/")
def index() -> HTMLResponse:
    html = _INDEX_TEMPLATE.replace("__ROOT_PATH__", ROOT_PATH)
    return HTMLResponse(html)
