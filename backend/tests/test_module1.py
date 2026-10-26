"""
Chronova Backend Tests — Module 1
==================================
Tests for project setup, health check, and workspace management.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from pathlib import Path
import tempfile
import shutil
import os

# Override settings BEFORE importing app modules
os.environ["CHRONOVA_DEBUG"] = "false"


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db(tmp_path):
    """Create a fresh in-memory-like temp database for each test."""
    db_file = tmp_path / "test_chronova.db"
    db_url = f"sqlite+aiosqlite:///{db_file}"

    # Patch the engine and session factory for tests
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from app.db import Base
    import app.db as db_module
    import app.api.routes as routes_module

    test_engine = create_async_engine(
        db_url,
        echo=False,
        connect_args={"check_same_thread": False},
    )
    test_session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Override the get_session dependency
    async def get_test_session():
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    from app.main import app
    from app.db import get_session
    app.dependency_overrides[get_session] = get_test_session

    yield

    # Cleanup
    app.dependency_overrides.clear()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client():
    """Async HTTP test client."""
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def temp_dir():
    """Create a temporary directory for testing."""
    d = tempfile.mkdtemp(prefix="chronova_test_")
    yield d
    shutil.rmtree(d, ignore_errors=True)


# ── Health Check ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Health endpoint returns ok status."""
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["app_name"] == "Chronova"
    assert data["version"] == "1.0.0"
    assert data["database"] == "connected"
    assert isinstance(data["modules_loaded"], list)
    assert len(data["modules_loaded"]) > 0


@pytest.mark.asyncio
async def test_health_has_timestamp(client: AsyncClient):
    """Health response includes a valid timestamp."""
    resp = await client.get("/api/health")
    data = resp.json()
    assert "timestamp" in data
    assert data["timestamp"] is not None


# ── Workspace CRUD ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_workspace(client: AsyncClient, temp_dir: str):
    """Can create a workspace with a valid directory."""
    resp = await client.post("/api/workspaces", json={
        "name": "Test Workspace",
        "root_path": temp_dir,
        "description": "A test workspace",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Workspace"
    assert data["is_active"] is True
    assert data["analysis_mode"] == "metadata"
    assert data["id"] is not None


@pytest.mark.asyncio
async def test_create_workspace_invalid_path(client: AsyncClient):
    """Reject workspace with non-existent path."""
    resp = await client.post("/api/workspaces", json={
        "name": "Bad Workspace",
        "root_path": "Z:\\nonexistent\\path\\that\\does\\not\\exist",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_duplicate_workspace(client: AsyncClient, temp_dir: str):
    """Reject duplicate workspace path."""
    await client.post("/api/workspaces", json={
        "name": "WS1",
        "root_path": temp_dir,
    })
    resp = await client.post("/api/workspaces", json={
        "name": "WS2",
        "root_path": temp_dir,
    })
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_workspaces(client: AsyncClient, temp_dir: str):
    """List includes created workspaces."""
    await client.post("/api/workspaces", json={
        "name": "WS",
        "root_path": temp_dir,
    })
    resp = await client.get("/api/workspaces")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["workspaces"]) >= 1


@pytest.mark.asyncio
async def test_get_workspace_by_id(client: AsyncClient, temp_dir: str):
    """Fetch a single workspace by ID."""
    create_resp = await client.post("/api/workspaces", json={
        "name": "WS",
        "root_path": temp_dir,
    })
    ws_id = create_resp.json()["id"]
    resp = await client.get(f"/api/workspaces/{ws_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == ws_id


@pytest.mark.asyncio
async def test_get_workspace_not_found(client: AsyncClient):
    """404 for non-existent workspace."""
    resp = await client.get("/api/workspaces/nonexistent-id")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_workspace(client: AsyncClient, temp_dir: str):
    """Delete a workspace successfully."""
    create_resp = await client.post("/api/workspaces", json={
        "name": "WS",
        "root_path": temp_dir,
    })
    ws_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/workspaces/{ws_id}")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    # Verify deleted
    resp = await client.get(f"/api/workspaces/{ws_id}")
    assert resp.status_code == 404


# ── Audit Logs ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_audit_log_created_on_workspace(client: AsyncClient, temp_dir: str):
    """Creating a workspace generates an audit log entry."""
    await client.post("/api/workspaces", json={
        "name": "Audited WS",
        "root_path": temp_dir,
    })
    resp = await client.get("/api/audit-logs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    actions = [log["action"] for log in data["logs"]]
    assert "workspace_created" in actions


# ── Settings ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_settings(client: AsyncClient):
    """Settings endpoint returns valid configuration."""
    resp = await client.get("/api/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis_mode"] == "metadata"
    assert isinstance(data["max_file_size_mb"], int)
    assert isinstance(data["ollama_enabled"], bool)
