"""
Chronova Dependency Graph Service — Module 8
============================================
Constructs directed graphs using NetworkX, computes topological centrality metrics
(PageRank, betweenness, in-degree), and outputs Cytoscape.js compatible JSON.
"""

import networkx as nx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord, Dependency
from app.schemas import DependencyGraphResponse


class GraphService:
    """Service for NetworkX graph construction and topological analysis."""

    @classmethod
    async def build_networkx_graph(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> tuple[nx.DiGraph, dict[str, FileRecord], list[Dependency]]:
        """Construct a NetworkX DiGraph for a scan."""
        # Query files
        f_res = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(f_res.scalars().all())
        file_map = {f.id: f for f in files}

        # Query dependencies
        d_res = await session.execute(
            select(Dependency).where(Dependency.scan_id == scan_id)
        )
        deps = list(d_res.scalars().all())

        G = nx.DiGraph()

        # Add all files as nodes
        for f in files:
            G.add_node(
                f.id,
                file_name=f.file_name,
                file_path=f.file_path,
                size_bytes=f.size_bytes,
                privacy_level=f.privacy_level,
                importance_score=f.importance_score or 0.0,
                extension=f.extension,
            )

        # Add edges
        for d in deps:
            if d.source_file_id in file_map and d.target_file_id in file_map:
                G.add_edge(
                    d.source_file_id,
                    d.target_file_id,
                    dep_id=d.id,
                    relationship=d.relationship_type,
                    confidence=d.confidence,
                )

        return G, file_map, deps

    @classmethod
    async def get_cytoscape_graph(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> DependencyGraphResponse:
        """Return Cytoscape.js formatted elements with topological metrics."""
        G, file_map, deps = await cls.build_networkx_graph(session, scan_id)

        # Compute PageRank if graph has nodes
        pagerank = {}
        betweenness = {}
        if len(G) > 0:
            try:
                pagerank = nx.pagerank(G, alpha=0.85, max_iter=200)
            except Exception:
                pagerank = {n: 1.0 / len(G) for n in G.nodes()}

            try:
                betweenness = nx.betweenness_centrality(G)
            except Exception:
                betweenness = {n: 0.0 for n in G.nodes()}

        nodes_data = []
        for node_id in G.nodes():
            f = file_map[node_id]
            in_deg = G.in_degree(node_id)
            out_deg = G.out_degree(node_id)
            pr = round(pagerank.get(node_id, 0.0), 4)
            bw = round(betweenness.get(node_id, 0.0), 4)

            nodes_data.append({
                "data": {
                    "id": f.id,
                    "label": f.file_name,
                    "file_path": f.file_path,
                    "extension": f.extension,
                    "size_bytes": f.size_bytes,
                    "privacy_level": f.privacy_level,
                    "importance_score": f.importance_score or 0.0,
                    "in_degree": in_deg,
                    "out_degree": out_deg,
                    "pagerank": pr,
                    "betweenness": bw,
                }
            })

        edges_data = []
        for d in deps:
            edges_data.append({
                "data": {
                    "id": d.id,
                    "source": d.source_file_id,
                    "target": d.target_file_id,
                    "type": d.relationship_type,
                    "confidence": d.confidence,
                    "label": d.relationship_type,
                }
            })

        return DependencyGraphResponse(
            scan_id=scan_id,
            total_nodes=len(nodes_data),
            total_edges=len(edges_data),
            nodes=nodes_data,
            edges=edges_data,
        )
