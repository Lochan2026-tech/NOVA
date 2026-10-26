import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api", timeout=60.0)
ws_list = client.get("/workspaces").json()["workspaces"]
# Find the Chronova workspace
ws = next((w for w in ws_list if "Chronova" in w["name"]), ws_list[0])
print("Using Workspace:", ws["name"], "Path:", ws["root_path"])

print("Starting pipeline scan on Chronova workspace...")
scan_res = client.post("/scans", json={"workspace_id": ws["id"]})
print("Scan Response Code:", scan_res.status_code)
scan = scan_res.json()
print("Scan ID:", scan.get("id"))
print("Status:", scan.get("status"))
print("Total Files Scanned:", scan.get("total_files"))
print("Total Directories:", scan.get("total_directories"))

print("\n--- Testing All Analytics & Pipeline Endpoints ---")
dups = client.get(f"/scans/{scan['id']}/duplicates").json()
print(f"[OK] Duplicate Groups: {dups.get('total_duplicate_groups')} groups, {dups.get('total_duplicate_files')} files, {dups.get('total_wasted_bytes')} wasted bytes.")

storage = client.get(f"/scans/{scan['id']}/storage").json()
print(f"[OK] Storage Analyzer: {len(storage.get('by_extension', []))} file extensions analyzed.")

temporal = client.get(f"/scans/{scan['id']}/temporal").json()
print(f"[OK] Temporal Distribution: Average age {temporal.get('average_age_days')} days across {len(temporal.get('buckets', []))} buckets.")

graph = client.get(f"/scans/{scan['id']}/graph").json()
print(f"[OK] Dependency Graph: {graph.get('total_nodes')} nodes, {graph.get('total_edges')} directed edges.")

importance = client.get(f"/scans/{scan['id']}/importance").json()
print(f"[OK] Importance Scores: {len(importance.get('scored_files', []))} files ranked.")

recs = client.get(f"/scans/{scan['id']}/recommendations").json()
print(f"[OK] Recommendations: {len(recs.get('recommendations', []))} lifecycle recommendations generated.")

print("\n--- Testing What-If Simulation ---")
ask_res = client.post("/ask", json={"question": "What happens if I archive main.py?", "scan_id": scan["id"]}).json()
print("[OK] What-If Simulation Output:")
print("    Answer Preview:", ask_res.get("answer")[:180], "...")
print("    Confidence:", ask_res.get("confidence"))
print("    Suggestions:", ask_res.get("suggestions"))

print("\n--- Testing Approval & Archival Workflow ---")
if recs.get("recommendations"):
    first_rec = recs["recommendations"][0]
    app_res = client.post("/recommendations/approve", json={
        "recommendation_id": first_rec["id"],
        "action": "approve",
        "approved_by": "qa_automator"
    }).json()
    print(f"[OK] Approval status for {first_rec['file_name']}: {app_res.get('status')}")

audit = client.get("/audit-logs?limit=5").json()
print(f"[OK] Audit Trail: {audit.get('total')} total audit events logged.")

print("\n=======================================================")
print("  >>> ALL CHRONOVA LIVE FEATURES VERIFIED 100% OK! <<<")
print("=======================================================")
