import urllib.request
import json
import sys

def call(path, method='GET', data=None):
    url = f'http://127.0.0.1:8000/api{path}'
    req = urllib.request.Request(url, method=method)
    if data:
        req.add_header('Content-Type', 'application/json')
        body = json.dumps(data).encode('utf-8')
    else:
        body = None
    with urllib.request.urlopen(req, data=body) as res:
        return json.loads(res.read().decode())

print('[1] Health:', call('/health')['status'])
workspaces = call('/workspaces')['workspaces']
print('[2] Workspaces count:', len(workspaces))
assert len(workspaces) > 0, 'No workspaces found'
ws_id = workspaces[0]['id']

print('[3] Running Pipeline Scan...')
scan = call('/scans', method='POST', data={'workspace_id': ws_id})
scan_id = scan['id']
print(f'    Scan Completed! Scanned {scan["total_files"]} files in {scan["total_directories"]} directories.')

files = call(f'/files?scan_id={scan_id}&limit=10')
print('[4] Scanned Files total:', files['total'])

dups = call(f'/scans/{scan_id}/duplicates')
print(f'[5] Duplicates: {dups["total_duplicate_groups"]} groups, {dups["total_duplicate_files"]} redundant files, {dups["total_wasted_bytes"]} wasted bytes.')

storage = call(f'/scans/{scan_id}/storage')
print(f'[6] Storage: {len(storage["by_extension"])} file types analyzed.')

temporal = call(f'/scans/{scan_id}/temporal')
print(f'[7] Temporal: Avg age {temporal["average_age_days"]} days across {len(temporal["buckets"])} buckets.')

graph = call(f'/scans/{scan_id}/graph')
print(f'[8] Dependency Graph: {graph["total_nodes"]} nodes, {graph["total_edges"]} directed edges.')

importance = call(f'/scans/{scan_id}/importance')
print(f'[9] Importance Ranking: {len(importance["scored_files"])} scored files.')

recs = call(f'/scans/{scan_id}/recommendations')
print(f'[10] Lifecycle Recommendations: {len(recs["recommendations"])} explainable actions generated.')

what_if = call('/ask', method='POST', data={'question': 'What happens if I archive main.py?', 'scan_id': scan_id})
print(f'[11] What-If Simulation for main.py:\n     {what_if["answer"][:120]}...')

audit = call('/audit-logs?limit=5')
print(f'[12] Audit Trail: {audit["total"]} events logged.')

settings = call('/settings')
print(f'[13] Settings: mode={settings["analysis_mode"]}, max_files={settings["max_scan_files"]}.')

print('\n>>> ALL 13 CORE PIPELINE ENDPOINTS VERIFIED SUCCESSFULLY! <<<')
