"""
Chronova File Importance Scoring Service — Module 9
===================================================
Calculates multidimensional importance scores using graph topological metrics
(in-degree, PageRank, betweenness), privacy status, and structural role.
Crucially ensures that file age does not depress importance for depended-upon files.
"""

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord
from app.schemas import ImportanceReport, ImportanceResponse
from app.services.graph_service import GraphService


class ImportanceScorerService:
    """Service for computing explainable file importance scores."""

    ROOT_CONFIG_NAMES = {
        "package.json", "tsconfig.json", "requirements.txt", "pyproject.toml",
        "dockerfile", "docker-compose.yml", "vite.config.ts", "pytest.ini",
        "main.py", "index.html", "index.ts", "app.py",
    }

    @classmethod
    async def compute_importance_scores(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> ImportanceReport:
        """Calculate and store importance scores for all files in a scan."""
        G, file_map, deps = await GraphService.build_networkx_graph(session, scan_id)

        num_nodes = len(G)
        if num_nodes == 0:
            return ImportanceReport(scan_id=scan_id, total_files=0, scored_files=[])

        # Graph metrics
        import networkx as nx
        try:
            pagerank = nx.pagerank(G, alpha=0.85, max_iter=200)
        except Exception:
            pagerank = {n: 1.0 / num_nodes for n in G.nodes()}

        try:
            betweenness = nx.betweenness_centrality(G)
        except Exception:
            betweenness = {n: 0.0 for n in G.nodes()}

        max_in_deg = max([G.in_degree(n) for n in G.nodes()], default=1)
        max_in_deg = max(max_in_deg, 1)

        scored_items: list[tuple[FileRecord, float, dict]] = []

        for node_id in G.nodes():
            f = file_map[node_id]
            in_deg = G.in_degree(node_id)
            pr = pagerank.get(node_id, 0.0)
            bw = betweenness.get(node_id, 0.0)

            # Normalized component scores (0.0 to 1.0)
            norm_in_deg = min(1.0, in_deg / max_in_deg)
            # Scale PageRank relative to uniform distribution
            norm_pr = min(1.0, pr * num_nodes / 2.0)
            norm_bw = min(1.0, bw * 5.0)

            # Privacy factor
            privacy_boost = 0.0
            if f.privacy_level == "restricted":
                privacy_boost = 0.25
            elif f.privacy_level == "confidential":
                privacy_boost = 0.15
            elif f.privacy_level == "internal":
                privacy_boost = 0.05

            # Config / root file factor
            config_boost = 0.10 if f.file_name.lower() in cls.ROOT_CONFIG_NAMES else 0.0

            # Duplicate penalty: applied only to redundant secondary copies, preserving primary original
            dup_penalty = 0.0
            if f.is_duplicate and f.duplicate_group_id:
                out_edges = G.out_edges(node_id, data=True)
                is_redundant_copy = any(edata.get("relationship") == "duplicate-of" for _, _, edata in out_edges)
                if is_redundant_copy:
                    dup_penalty = -0.20

            # Base composite calculation:
            # 35% In-degree (who depends on me) + 25% PageRank + 15% Betweenness
            # + Privacy Boost + Config Boost + Duplicate Penalty
            raw_score = (
                (norm_in_deg * 0.35) +
                (norm_pr * 0.25) +
                (norm_bw * 0.15) +
                privacy_boost +
                config_boost +
                dup_penalty
            )

            # Bound score strictly in [0.05, 1.00]
            final_score = round(max(0.05, min(1.00, raw_score)), 4)
            f.importance_score = final_score

            factors = {
                "inbound_dependencies": in_deg,
                "in_degree_weight": round(norm_in_deg * 0.35, 4),
                "pagerank_weight": round(norm_pr * 0.25, 4),
                "betweenness_weight": round(norm_bw * 0.15, 4),
                "privacy_boost": privacy_boost,
                "config_boost": config_boost,
                "duplicate_penalty": dup_penalty,
                "raw_score": round(raw_score, 4),
            }
            scored_items.append((f, final_score, factors))

        await session.flush()

        # Sort descending by score
        scored_items.sort(key=lambda x: x[1], reverse=True)

        responses = [
            ImportanceResponse(
                file_id=item[0].id,
                file_path=item[0].file_path,
                file_name=item[0].file_name,
                importance_score=item[1],
                factors=item[2],
                rank=idx + 1,
            )
            for idx, item in enumerate(scored_items)
        ]

        return ImportanceReport(
            scan_id=scan_id,
            total_files=len(responses),
            scored_files=responses,
        )
