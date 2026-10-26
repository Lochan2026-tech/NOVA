"""Quick API test script for all Chronova endpoints."""
import urllib.request
import json

base = "http://127.0.0.1:8000/api"

def get(path):
    try:
        r = urllib.request.urlopen(base + path)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def post(path, data):
    req = urllib.request.Request(
        base + path,
        json.dumps(data).encode(),
        {"Content-Type": "application/json"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# 1. List workspaces
code, ws_list = get("/workspaces")
print(f"GET /workspaces: {code}")
total = ws_list.get("total", 0)
print(f"  Workspaces count: {total}")
for ws in ws_list.get("workspaces", []):
    print(f"  - {ws['name']} ({ws['id']})")

# 2. Try creating workspace with EMPTY name
code, body = post("/workspaces", {"name": "", "root_path": "C:\\Users\\gorij"})
print(f"\nPOST /workspaces (empty name): {code} => {body}")

# 3. Try creating workspace with non-existent path
code, body = post("/workspaces", {"name": "Test", "root_path": "C:\\NonExistentPath12345"})
print(f"POST /workspaces (bad path): {code} => {body}")

# 4. Test scans list
code, scans = get("/scans")
print(f"\nGET /scans: {code}, total: {scans.get('total', 0)}")

# 5. Test settings
code, settings_data = get("/settings")
print(f"GET /settings: {code} => {settings_data}")

# 6. Test audit logs
code, logs = get("/audit-logs")
print(f"GET /audit-logs: {code}, total: {logs.get('total', 0)}")

# 7. Test archives
code, archives = get("/archives")
print(f"GET /archives: {code}, total: {archives.get('total', 0)}")

# 8. Test ask chronova
code, body = post("/ask", {"question": "What is the workspace summary?"})
print(f"\nPOST /ask: {code} => confidence={body.get('confidence', '?')}")
answer = body.get("answer", "?")[:100]
print(f"  Answer: {answer}...")

# 9. Try creating workspace with valid data to test the flow
code, body = post("/workspaces", {
    "name": "API Test Workspace",
    "root_path": "C:\\Users\\gorij\\OneDrive",
    "description": "Test from script",
    "analysis_mode": "metadata",
})
print(f"\nPOST /workspaces (valid): {code}")
if code == 200:
    print(f"  Created workspace: {body.get('id', '?')}")
else:
    print(f"  Error: {body}")

# 10. List workspaces again to confirm
code, ws_list = get("/workspaces")
total = ws_list.get("total", 0)
print(f"\nGET /workspaces (after create): {code}, total: {total}")
for ws in ws_list.get("workspaces", []):
    print(f"  - {ws['name']} : {ws['root_path']}")
