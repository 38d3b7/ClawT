#!/usr/bin/env python3
"""
Validates the skill graph:
1. All [[wikilinks]] resolve to either a graph node or skill folder
2. All executable skills are reachable from index.md (via wikilinks or YAML skills: arrays)
3. No orphan graph nodes (every node is linked from at least one other node)
"""

import os
import re
import sys
from pathlib import Path

import yaml

SCRIPTS_DIR = Path(__file__).parent
REGISTRY_DIR = SCRIPTS_DIR.parent
GRAPH_DIR = REGISTRY_DIR / "graph"
SKILLS_DIR = REGISTRY_DIR / "skills"

WIKILINK_PATTERN = re.compile(r"\[\[([^\]]+)\]\]")


def get_graph_nodes() -> set[str]:
    """Get all graph node IDs from registry/graph/."""
    nodes = set()
    if GRAPH_DIR.exists():
        for f in GRAPH_DIR.glob("*.md"):
            nodes.add(f.stem)
    return nodes


def get_skill_ids() -> set[str]:
    """Get all skill IDs from registry/skills/."""
    skills = set()
    if SKILLS_DIR.exists():
        for d in SKILLS_DIR.iterdir():
            if d.is_dir() and (d / "SKILL.md").exists():
                skills.add(d.name)
    return skills


def extract_wikilinks(content: str) -> set[str]:
    """Extract all [[wikilinks]] from content."""
    return set(WIKILINK_PATTERN.findall(content))


def validate_wikilinks(
    file_path: Path,
    content: str,
    valid_targets: set[str],
    errors: list[str]
) -> set[str]:
    """Validate all wikilinks in a file resolve to valid targets."""
    links = extract_wikilinks(content)
    for link in links:
        if link not in valid_targets:
            errors.append(f"{file_path}: broken wikilink [[{link}]]")
    return links


def parse_yaml_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from markdown content."""
    if not content.startswith("---"):
        return {}
    parts = content.split("---", 2)
    if len(parts) < 3:
        return {}
    try:
        return yaml.safe_load(parts[1]) or {}
    except yaml.YAMLError:
        return {}


def build_link_graph(graph_nodes: set[str], skill_ids: set[str]) -> dict[str, set[str]]:
    """Build a graph of which nodes link to which targets.
    
    Considers both [[wikilinks]] and skills listed in YAML frontmatter.
    """
    link_graph: dict[str, set[str]] = {}
    valid_targets = graph_nodes | skill_ids
    
    for node_id in graph_nodes:
        file_path = GRAPH_DIR / f"{node_id}.md"
        if file_path.exists():
            content = file_path.read_text()
            links = extract_wikilinks(content)
            
            frontmatter = parse_yaml_frontmatter(content)
            yaml_skills = set(frontmatter.get("skills", []) or [])
            yaml_links = set(frontmatter.get("links", []) or [])
            
            link_graph[node_id] = (links | yaml_skills | yaml_links) & valid_targets
    
    for skill_id in skill_ids:
        skill_md = SKILLS_DIR / skill_id / "SKILL.md"
        if skill_md.exists():
            content = skill_md.read_text()
            links = extract_wikilinks(content)
            link_graph[skill_id] = links & valid_targets
    
    return link_graph


def find_reachable_from_index(link_graph: dict[str, set[str]]) -> set[str]:
    """Find all nodes/skills reachable from index via wikilinks."""
    if "index" not in link_graph:
        return set()
    
    reachable = set()
    queue = ["index"]
    
    while queue:
        current = queue.pop(0)
        if current in reachable:
            continue
        reachable.add(current)
        
        for target in link_graph.get(current, set()):
            if target not in reachable:
                queue.append(target)
    
    return reachable


def find_nodes_linking_to(target: str, link_graph: dict[str, set[str]]) -> set[str]:
    """Find all nodes that link to a given target."""
    linkers = set()
    for source, targets in link_graph.items():
        if target in targets:
            linkers.add(source)
    return linkers


def main():
    errors: list[str] = []
    warnings: list[str] = []
    
    graph_nodes = get_graph_nodes()
    skill_ids = get_skill_ids()
    valid_targets = graph_nodes | skill_ids
    
    print(f"Found {len(graph_nodes)} graph nodes and {len(skill_ids)} skills")
    
    if not graph_nodes:
        errors.append("No graph nodes found in graph/")
        print(f"\n{len(errors)} error(s)")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)
    
    if "index" not in graph_nodes:
        errors.append("Missing index.md in graph/")
    
    print("\n1. Validating wikilinks in graph nodes...")
    for node_id in sorted(graph_nodes):
        file_path = GRAPH_DIR / f"{node_id}.md"
        content = file_path.read_text()
        validate_wikilinks(file_path, content, valid_targets, errors)
    
    print("2. Validating wikilinks in SKILL.md files...")
    for skill_id in sorted(skill_ids):
        skill_md = SKILLS_DIR / skill_id / "SKILL.md"
        if skill_md.exists():
            content = skill_md.read_text()
            validate_wikilinks(skill_md, content, valid_targets, errors)
    
    print("3. Checking skill reachability from index...")
    link_graph = build_link_graph(graph_nodes, skill_ids)
    reachable = find_reachable_from_index(link_graph)
    
    unreachable_skills = skill_ids - reachable
    if unreachable_skills:
        for skill_id in sorted(unreachable_skills):
            warnings.append(f"Skill '{skill_id}' is not reachable from index.md")
    
    print("4. Checking for orphan graph nodes...")
    for node_id in graph_nodes:
        if node_id == "index":
            continue
        linkers = find_nodes_linking_to(node_id, link_graph)
        if not linkers:
            errors.append(f"Orphan graph node '{node_id}' is not linked from any other node")
    
    print()
    
    if warnings:
        print(f"{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  WARNING: {w}")
        print()
    
    if errors:
        print(f"{len(errors)} error(s):")
        for e in errors:
            print(f"  ERROR: {e}")
        sys.exit(1)
    
    print(f"Graph validation passed!")
    print(f"  - {len(graph_nodes)} graph nodes")
    print(f"  - {len(skill_ids)} skills")
    print(f"  - {len(reachable)} nodes/skills reachable from index")


if __name__ == "__main__":
    main()
