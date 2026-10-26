"""
Chronova — Main Application
============================
FastAPI application entry point.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import settings
from app.db import init_db, close_db
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle events."""
    # ── Startup ──
    # Ensure directories exist
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.archive_dir.mkdir(parents=True, exist_ok=True)
    settings.results_dir.mkdir(parents=True, exist_ok=True)

    # Initialize database tables
    await init_db()
    print(f"[OK] {settings.app_name} v{settings.app_version} started")
    print(f"  Database: {settings.db_path}")
    print(f"  Archive:  {settings.archive_dir}")

    # Seed default workspace if empty
    from sqlalchemy import select, func
    from app.models import Workspace
    import app.db as db_mod
    async with db_mod.async_session_factory() as session:
        try:
            ws_count = await session.execute(select(func.count()).select_from(Workspace.__table__))
            if (ws_count.scalar() or 0) == 0:
                default_ws = Workspace(
                    name="Chronova Project Workspace",
                    root_path=str(settings.project_root.resolve()),
                    description="Main Chronova workspace containing backend, frontend, and tests",
                    analysis_mode="metadata",
                )
                session.add(default_ws)
                await session.commit()
                print(f"  Default Workspace Seeded: {default_ws.name} ({default_ws.root_path})")
            else:
                await session.rollback()
        except Exception:
            await session.rollback()

    yield

    # ── Shutdown ──
    await close_db()
    print(f"[OK] {settings.app_name} shut down")


app = FastAPI(
    title=settings.app_name,
    description=(
        "Explainable AI-Driven Dependency Graph Framework "
        "for Privacy-Preserving File Lifecycle Management"
    ),
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS Middleware ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routes ───────────────────────────────────────────────────
app.include_router(api_router, prefix="/api")
