# Chronova: Explainable AI-Driven Dependency Graph Framework for Privacy-Preserving File Lifecycle Management

> **An Operating Systems Mini-Project for Intelligent File Lifecycle Management**

Chronova is a locally processed, privacy-preserving file lifecycle management system that scans filesystem directories, identifies structural dependencies, computes graph centrality metrics, enforces multi-tiered privacy controls, and recommends explainable lifecycle actions (retain, archive, review, monitor).

The core tenet of Chronova is that **a file must not be deemed unimportant simply because it is old**. foundational libraries, headers, configuration files, and critical modules are protected by analyzing inbound dependency links, privacy sensitivity, and potential operational consequences before recommending lifecycle transitions. Destructive or archival operations require explicit user approval with full cryptographic verification and reversible restoration.

---

## Key Highlights

- **Local Processing**: Operates completely offline with zero mandatory cloud telemetry.
- **Topological Protection**: Uses NetworkX directed graph analysis (PageRank, betweenness, in-degree centrality) to protect inactive files that other files depend on.
- **Explainable AI (XAI)**: Generates clear, human-readable natural language reasoning and weighted factor breakdowns for every recommendation.
- **What-If Simulation**: Answers questions like *"What happens if I archive main.py?"* by simulating node removal and reporting broken downstream dependencies.
- **Cryptographic Verification**: SHA-256 duplicate detection and archive/restore integrity checks.
- **Accidental Overwrite Protection**: Built-in security guards preventing file overwrites and path traversal attacks.
- **Modern Dashboard**: 15 views styled in a sleek cyber dark theme with Cytoscape.js visual graph canvas and Recharts statistics.

---

## Architecture Pipeline

```text
File System
  └── File Scanner (safe directory traversal, metadata extraction)
        ├── Duplicate Detector (chunked SHA-256 cryptographic grouping)
        ├── Storage & Disk Analyzer (extension & tree breakdown)
        ├── Temporal Activity Analyzer (recency vs dormancy facts)
        ├── Privacy Classification Engine (metadata, structural, opt-in content)
        ├── Dependency Detection Engine (multi-language imports, companions, configs)
        ├── Dependency Graph Construction (NetworkX DiGraph)
        ├── Importance Scoring (topological centrality & privacy boost)
        ├── Risk Assessor & Lifecycle Decision Engine
        ├── Explainable AI & Natural-Language Explainer
        ├── Ask Chronova (consequence simulation & local Ollama integration)
        ├── User Approval Workflow (explicit human-in-the-loop decisions)
        ├── Safe Archiving & Reversible Restoration
        ├── Audit Logger (tamper-evident accountability trail)
        └── Chronova Dashboard (React, Cytoscape.js, Recharts, Tailwind CSS)
```

---

## Quickstart Guide

### 1. Prerequisites
- **Python**: 3.10+ (Python 3.12 verified)
- **Node.js**: v18+ with `npm`

### ⚡ 1-Click Quick Launch (Recommended)
Simply double-click the **`start_chronova.bat`** file in the root directory.
It automatically launches both the FastAPI backend and Vite frontend, then opens `http://localhost:5173` in your default browser.
To stop all servers, double-click **`stop_chronova.bat`**.

### 2. Manual Startup
```powershell
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run automated tests
pytest

# Launch FastAPI backend server (runs on http://127.0.0.1:8000)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend Setup & Startup
```powershell
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Launch Vite development server (runs on http://localhost:5173)
npm run dev
```

Open **`http://localhost:5173`** in your browser to access the Chronova Dashboard.

---

## 35 Implemented Modules

| Phase | Module # | Name | Description |
|---|---|---|---|
| **Phase 1: File Management** | M1 | Project Setup & Configuration | Modular repository structure, environment settings, health checks |
| | M2 | File Scanner | Recursive filesystem traversal, metadata extraction, error resilience |
| | M3 | Duplicate Detection | Chunked SHA-256 calculation, duplicate grouping, space recovery |
| | M4 | Disk Space Analyzer | Volumetric storage breakdown by extension, directory tree, largest files |
| | M5 | File Activity & Temporal Analysis | Age categorization distinguishing observed OS facts from heuristics |
| **Phase 2: Privacy & Dependencies** | M6 | Privacy Classification Engine | 4-tier classification (public, internal, confidential, restricted) |
| | M7 | Relationship & Dependency Detection | Multi-language imports (Py, TS, C), companions, duplicates, configs |
| | M8 | Dependency Graph Construction | Directed graph representation using NetworkX and Cytoscape.js |
| | M9 | Importance Scoring | Weighted composite score using in-degree, PageRank, and betweenness |
| **Phase 3: AI & Explainability** | M10 | Lifecycle Decision Engine | Actions (retain, archive, review, monitor) with confidence thresholds |
| | M11 | Risk Assessment | Evaluates dependency break risk, data loss risk, recoverability |
| | M12 | Explainable AI Recommendation Engine | Multi-factor weighted breakdown of contributing factors |
| | M13 | Natural-Language Explanations | Transparent human-readable paragraphs justifying decisions |
| | M14 | Ask Chronova & What-If Simulation | Simulates node removals, identifies orphaned files, Ollama integration |
| **Phase 4: File Protection** | M15 | User Approval Workflow | Explicit user approval required for lifecycle operations |
| | M16 | Safe File Archiving | Non-destructive moving with source and destination SHA-256 checks |
| | M17 | Restore & Undo Operations | Reversible recovery with accidental overwrite defense |
| | M18 | Audit Logging | Comprehensive operation trail for all scans, approvals, archives |
| | M19 | Permissions & Access Controls | Path traversal validation and authorized directory containment |
| **Phase 5: Backend & Database** | M20 | SQLite Database Integration | SQLAlchemy async ORM with relational schema and indexes |
| | M21 | FastAPI REST API | High-performance endpoints for all pipeline modules |
| | M22 | Workspace Management | Dynamic directory binding and multi-workspace lifecycle |
| | M23 | Privacy-Aware Evidence Management | Structured evidence objects and opt-in content inspection |
| **Phase 6: Frontend Experience** | M24 | Dashboard | Executive overview KPI cards, storage charts, action distribution |
| | M25 | File Explorer | Filterable, searchable table with size, privacy, and importance |
| | M26 | Interactive Dependency Graph | Cytoscape.js canvas with layouts, search, and node inspector drawer |
| | M27 | Recommendation Center | Action cards with NL reasoning and Approve/Reject modal workflows |
| | M28 | File Activity Timeline | Temporal distribution bar charts and Chronova age doctrine |
| | M29 | Privacy Center | Sensitive files inventory (.env, keys, financial) and mode toggle |
| | M30 | Audit Log Interface | Searchable audit trail with raw JSON inspector modal |
| | M31-M35 | Integration & Academic Pages | Duplicate Detector, Storage Analyzer, Ask Chronova, Archive Manager, Settings |

---

## Testing & Verification

Chronova includes automated test suites covering scanning, duplicates, graph metrics, recommendations, archiving, restoring, path traversal defense, and what-if simulation:

```powershell
cd backend
python -m pytest -v
```

All 16 test suites pass cleanly in under 4 seconds with 100% compliance.
