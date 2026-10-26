"""
Chronova Backend Tests — Modules 2 to 23
=========================================
Comprehensive integration tests for Scanning, Duplicates, Storage,
Temporal Analysis, Privacy, Dependency Graph, Importance Scoring,
Lifecycle Engine, Archiving, Restoring, and What-If Simulation.
"""

import os
import shutil
import tempfile
from pathlib import Path
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

os.environ["CHRONOVA_DEBUG"] = "false"


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db(tmp_path):
    """Create a fresh in-memory-like temp database for each test."""
    db_file = tmp_path / "test_chronova_full.db"
    db_url = f"sqlite+aiosqlite:///{db_file}"

    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from app.db import Base
    from app.main import app
    from app.db import get_session

    test_engine = create_async_engine(db_url, echo=False, connect_args={"check_same_thread": False})
    test_session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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

    app.dependency_overrides[get_session] = get_test_session
    yield
    app.dependency_overrides.clear()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client():
    from app.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_workspace_dir():
    """Create a realistic temporary project folder with files, imports, and duplicates."""
    d = Path(tempfile.mkdtemp(prefix="chronova_sample_ws_"))

    # Root files
    (d / "README.md").write_text("# Test Project\nPublic readme file.", encoding="utf-8")
    (d / ".env").write_text("SECRET_KEY=12345_very_secret\n", encoding="utf-8")
    (d / "main.py").write_text("import helper\nprint(helper.add(2, 3))\n", encoding="utf-8")
    (d / "helper.py").write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")
    (d / "test_helper.py").write_text("import helper\ndef test_add(): assert helper.add(1, 1) == 2\n", encoding="utf-8")

    # Duplicate files
    dup_content = "Identical binary backup content" * 10
    (d / "data1.txt").write_text(dup_content, encoding="utf-8")
    (d / "data2_copy.txt").write_text(dup_content, encoding="utf-8")

    # Subdirectory
    sub = d / "docs"
    sub.mkdir()
    (sub / "salary_report.txt").write_text("Confidential salary figures.", encoding="utf-8")

    yield str(d)
    shutil.rmtree(d, ignore_errors=True)


# ── Tests ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_full_pipeline_scan(client: AsyncClient, sample_workspace_dir: str):
    """Scan workspace and verify that files, duplicates, privacy, dependencies, and recommendations are created."""
    # 1. Create workspace
    ws_resp = await client.post("/api/workspaces", json={
        "name": "Integration Workspace",
        "root_path": sample_workspace_dir,
        "analysis_mode": "metadata",
    })
    assert ws_resp.status_code == 200
    ws_id = ws_resp.json()["id"]

    # 2. Trigger scan pipeline
    scan_resp = await client.post("/api/scans", json={"workspace_id": ws_id})
    assert scan_resp.status_code == 200
    scan_data = scan_resp.json()
    assert scan_data["status"] == "completed"
    assert scan_data["total_files"] >= 7
    scan_id = scan_data["id"]

    # 3. Check Files list
    files_resp = await client.get(f"/api/files?scan_id={scan_id}")
    assert files_resp.status_code == 200
    files_data = files_resp.json()
    assert files_data["total"] >= 7

    # 4. Check Privacy classification
    files = files_data["files"]
    env_file = next(f for f in files if f["file_name"] == ".env")
    assert env_file["privacy_level"] == "restricted"

    readme_file = next(f for f in files if f["file_name"] == "README.md")
    assert readme_file["privacy_level"] == "public"

    salary_file = next(f for f in files if "salary" in f["file_name"])
    assert salary_file["privacy_level"] == "confidential"

    # 5. Check Duplicate Detection
    dup_resp = await client.get(f"/api/scans/{scan_id}/duplicates")
    assert dup_resp.status_code == 200
    dup_data = dup_resp.json()
    assert dup_data["total_duplicate_groups"] >= 1
    assert dup_data["total_wasted_bytes"] > 0

    # 6. Check Storage Analysis
    storage_resp = await client.get(f"/api/scans/{scan_id}/storage")
    assert storage_resp.status_code == 200
    storage_data = storage_resp.json()
    assert len(storage_data["by_extension"]) > 0
    assert len(storage_data["largest_files"]) > 0

    # 7. Check Temporal Analysis
    temporal_resp = await client.get(f"/api/scans/{scan_id}/temporal")
    assert temporal_resp.status_code == 200
    temp_data = temporal_resp.json()
    assert len(temp_data["buckets"]) > 0
    assert "Chronova Core Directive" in temp_data["ai_interpretation_note"]

    # 8. Check Dependency Graph
    graph_resp = await client.get(f"/api/scans/{scan_id}/graph")
    assert graph_resp.status_code == 200
    graph_data = graph_resp.json()
    assert graph_data["total_nodes"] >= 7
    assert graph_data["total_edges"] >= 1

    # 9. Check Importance Scoring
    imp_resp = await client.get(f"/api/scans/{scan_id}/importance")
    assert imp_resp.status_code == 200
    imp_data = imp_resp.json()
    assert len(imp_data["scored_files"]) >= 7

    # 10. Check Recommendations
    rec_resp = await client.get(f"/api/scans/{scan_id}/recommendations")
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["total"] >= 7
    actions = [r["action"] for r in rec_data["recommendations"]]
    assert "retain" in actions


@pytest.mark.asyncio
async def test_user_approval_and_safe_archival_restore(client: AsyncClient, sample_workspace_dir: str):
    """Test approval workflow, checksummed archiving, and full undo/restore."""
    # Create and scan
    ws_resp = await client.post("/api/workspaces", json={
        "name": "Archive Test WS",
        "root_path": sample_workspace_dir,
    })
    ws_id = ws_resp.json()["id"]
    scan_resp = await client.post("/api/scans", json={"workspace_id": ws_id})
    scan_id = scan_resp.json()["id"]

    # Get recommendations
    recs = (await client.get(f"/api/scans/{scan_id}/recommendations")).json()["recommendations"]
    target_rec = recs[0]

    # 1. Approve recommendation
    app_resp = await client.post("/api/recommendations/approve", json={
        "recommendation_id": target_rec["id"],
        "action": "approve",
        "approved_by": "qa_tester",
    })
    assert app_resp.status_code == 200
    assert app_resp.json()["status"] == "approved"

    # 2. Archive file
    arc_resp = await client.post("/api/archives", json={
        "file_id": target_rec["file_id"],
        "recommendation_id": target_rec["id"],
        "user": "qa_tester",
    })
    assert arc_resp.status_code == 200
    arc_data = arc_resp.json()
    assert arc_data["status"] == "archived"
    assert arc_data["sha256_hash"] is not None
    archive_id = arc_data["id"]

    # Verify original file was removed from original path
    assert not Path(arc_data["original_path"]).exists()

    # 3. Restore file (Undo)
    restore_resp = await client.post(f"/api/archives/{archive_id}/undo")
    assert restore_resp.status_code == 200
    assert restore_resp.json()["status"] == "restored"

    # Verify original file is back
    assert Path(arc_data["original_path"]).exists()


@pytest.mark.asyncio
async def test_ask_chronova_what_if_simulation(client: AsyncClient, sample_workspace_dir: str):
    """Verify what-if simulation accurately detects broken dependencies when querying a file."""
    ws = (await client.post("/api/workspaces", json={
        "name": "AI WS", "root_path": sample_workspace_dir,
    })).json()
    scan = (await client.post("/api/scans", json={"workspace_id": ws["id"]})).json()

    # Ask what-if about helper.py (which is imported by main.py and test_helper.py)
    ask_resp = await client.post("/api/ask", json={
        "question": "What happens if I archive helper.py?",
        "scan_id": scan["id"],
    })
    assert ask_resp.status_code == 200
    data = ask_resp.json()
    assert "HIGH RISK" in data["answer"]
    assert "helper.py" in data["answer"]
    assert data["confidence"] > 0.8


@pytest.mark.asyncio
async def test_rejection_workflow(client: AsyncClient, sample_workspace_dir: str):
    """Verify recommendation rejection records reason in database."""
    ws = (await client.post("/api/workspaces", json={
        "name": "Reject WS", "root_path": sample_workspace_dir,
    })).json()
    scan = (await client.post("/api/scans", json={"workspace_id": ws["id"]})).json()
    recs = (await client.get(f"/api/scans/{scan['id']}/recommendations")).json()["recommendations"]

    rec_id = recs[0]["id"]
    rej_resp = await client.post("/api/recommendations/approve", json={
        "recommendation_id": rec_id,
        "action": "reject",
        "reason": "Retaining for future debugging",
        "approved_by": "lead_developer",
    })
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "rejected"


@pytest.mark.asyncio
async def test_path_traversal_prevention():
    """Verify PathValidator rejects paths attempting directory traversal."""
    from app.core.security import PathValidator, SecurityError
    safe_root = Path(tempfile.mkdtemp())
    validator = PathValidator([safe_root])

    # Subpath is valid
    sub = safe_root / "subdir" / "file.txt"
    assert validator.is_safe_path(sub) is True

    # Traversal outside is blocked
    traversal = safe_root / ".." / "system32"
    assert validator.is_safe_path(traversal) is False

    with pytest.raises(SecurityError):
        validator.validate_path(traversal)

    shutil.rmtree(safe_root, ignore_errors=True)


@pytest.mark.asyncio
async def test_privacy_classification_precision():
    """Verify that common words containing 'tax' or 'nda' are not falsely marked confidential."""
    from app.services.privacy_engine import PrivacyEngineService

    # Normal code files with substrings: syntax, standard, redundant
    level1, _ = PrivacyEngineService.classify_file("syntax.py")
    assert level1 == "internal", f"syntax.py classified as {level1}"

    level2, _ = PrivacyEngineService.classify_file("standard.py")
    assert level2 == "internal", f"standard.py classified as {level2}"

    level3, _ = PrivacyEngineService.classify_file("redundant.py")
    assert level3 == "internal", f"redundant.py classified as {level3}"

    # Genuine confidential files
    level4, _ = PrivacyEngineService.classify_file("tax_2024.pdf")
    assert level4 == "confidential"

    level5, _ = PrivacyEngineService.classify_file("employee_nda.pdf")
    assert level5 == "confidential"

    level6, _ = PrivacyEngineService.classify_file("nda.txt")
    assert level6 == "confidential"


@pytest.mark.asyncio
async def test_what_if_entry_point_and_stem_matching(client: AsyncClient, sample_workspace_dir: str):
    """Verify what-if simulation detects entry points and matches stems."""
    ws = (await client.post("/api/workspaces", json={
        "name": "WhatIf WS", "root_path": sample_workspace_dir,
    })).json()
    scan = (await client.post("/api/scans", json={"workspace_id": ws["id"]})).json()

    # Query entry point: main.py
    resp1 = await client.post("/api/ask", json={
        "question": "What happens if I remove main.py?",
        "scan_id": scan["id"],
    })
    assert resp1.status_code == 200
    assert "ENTRY POINT" in resp1.json()["answer"] or "main.py" in resp1.json()["answer"]

    # Query by stem: helper without .py
    resp2 = await client.post("/api/ask", json={
        "question": "What happens if I archive helper?",
        "scan_id": scan["id"],
    })
    assert resp2.status_code == 200
    assert "HIGH RISK" in resp2.json()["answer"]


@pytest.mark.asyncio
async def test_approve_nonexistent_recommendation(client: AsyncClient):
    """Ensure approving an invalid recommendation ID returns 404 instead of 500."""
    resp = await client.post("/api/recommendations/approve", json={
        "recommendation_id": "non-existent-rec-uuid",
        "action": "approve",
    })
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_scan_invalid_path(client: AsyncClient, sample_workspace_dir: str):
    """Ensure scanning outside the workspace returns 400 instead of 500."""
    ws = (await client.post("/api/workspaces", json={
        "name": "Path Test WS", "root_path": sample_workspace_dir,
    })).json()

    resp = await client.post("/api/scans", json={
        "workspace_id": ws["id"],
        "scan_path": str(Path(sample_workspace_dir).parent / "unauthorized_dir"),
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_readonly_archival_and_recommendation_status_transition(client: AsyncClient, sample_workspace_dir: str):
    """Verify read-only file can be safely archived and recommendation status transitions to archived and back."""
    import stat

    ws = (await client.post("/api/workspaces", json={
        "name": "RO Archival WS", "root_path": sample_workspace_dir,
    })).json()
    scan = (await client.post("/api/scans", json={"workspace_id": ws["id"]})).json()

    recs = (await client.get(f"/api/scans/{scan['id']}/recommendations")).json()["recommendations"]
    target_rec = recs[0]

    # Make target file read-only on disk
    target_path = Path(target_rec["file_path"])
    if target_path.exists():
        os.chmod(target_path, stat.S_IREAD)

    # Archive the file
    arc_resp = await client.post("/api/archives", json={
        "file_id": target_rec["file_id"],
        "recommendation_id": target_rec["id"],
    })
    assert arc_resp.status_code == 200
    archive_id = arc_resp.json()["id"]

    # Verify recommendation status is now 'archived'
    recs_after = (await client.get(f"/api/scans/{scan['id']}/recommendations")).json()["recommendations"]
    updated_rec = next(r for r in recs_after if r["id"] == target_rec["id"])
    assert updated_rec["status"] == "archived"

    # Restore the file
    res_resp = await client.post(f"/api/archives/{archive_id}/undo")
    assert res_resp.status_code == 200

    # Verify recommendation status returned to 'approved'
    recs_restored = (await client.get(f"/api/scans/{scan['id']}/recommendations")).json()["recommendations"]
    restored_rec = next(r for r in recs_restored if r["id"] == target_rec["id"])
    assert restored_rec["status"] == "approved"


@pytest.mark.asyncio
async def test_settings_update_timeout(client: AsyncClient):
    """Verify settings PATCH supports scan_timeout_seconds."""
    resp = await client.patch("/api/settings", json={
        "scan_timeout_seconds": 120,
        "max_file_size_mb": 250,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["scan_timeout_seconds"] == 120
    assert data["max_file_size_mb"] == 250


