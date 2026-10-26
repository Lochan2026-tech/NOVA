import httpx
import os

client = httpx.Client(base_url="http://127.0.0.1:8000/api", timeout=30.0)

test_path = r"c:\Users\gorij\OneDrive\Documents\Chronova\test_lifecycle_target.txt"
with open(test_path, "w", encoding="utf-8") as f:
    f.write("Chronova safe lifecycle verification file content.\n")

try:
    ws_list = client.get("/workspaces").json()["workspaces"]
    ws = next((w for w in ws_list if "Chronova" in w["name"]), ws_list[0])
    scan = client.post("/scans", json={"workspace_id": ws["id"]}).json()
    scan_id = scan["id"]
    print("Scan ID:", scan_id)

    recs = client.get(f"/scans/{scan_id}/recommendations").json()["recommendations"]
    target_rec = next((r for r in recs if "test_lifecycle_target.txt" in r["file_name"]), None)
    assert target_rec is not None, "Target test file recommendation not found"

    print("Found target rec:", target_rec["id"], target_rec["file_name"])

    # 1. Approve recommendation
    app_res = client.post("/recommendations/approve", json={
        "recommendation_id": target_rec["id"],
        "action": "approve",
        "approved_by": "qa_tester"
    }).json()
    print("[OK] Approved:", app_res.get("status"))

    # 2. Archive file
    arc_res = client.post("/archives", json={
        "file_id": target_rec["file_id"],
        "recommendation_id": target_rec["id"],
        "user": "qa_tester"
    })
    print("[OK] Archive HTTP status:", arc_res.status_code)
    arc_data = arc_res.json()
    print("[OK] Archive ID:", arc_data.get("id"))
    print("[OK] Archive Path:", arc_data.get("archive_path"))
    print("[OK] Original exists after archive (should be False):", os.path.exists(test_path))
    assert not os.path.exists(test_path), "Original file still exists after archive!"

    # 3. Check list of archives
    archives_list = client.get("/archives").json()["archives"]
    assert any(a["id"] == arc_data["id"] for a in archives_list), "Archived record not in /archives list"
    print("[OK] /archives list contains newly archived record")

    # 4. Restore file
    rest_res = client.post("/archives/restore", json={
        "archive_id": arc_data["id"]
    })
    print("[OK] Restore HTTP status:", rest_res.status_code)
    print("[OK] Original exists after restore (should be True):", os.path.exists(test_path))
    assert os.path.exists(test_path), "File was not restored to original path!"

    # 5. Check recommendation status updated back
    refreshed_recs = client.get(f"/scans/{scan_id}/recommendations").json()["recommendations"]
    refreshed_target = next((r for r in refreshed_recs if r["id"] == target_rec["id"]), None)
    print("[OK] Refreshed recommendation status:", refreshed_target.get("status") if refreshed_target else "None")

    print("\n[SUCCESS] Safe archival and restoration workflow fully verified!")
finally:
    if os.path.exists(test_path):
        os.remove(test_path)
        print("Cleaned up temporary test file.")
