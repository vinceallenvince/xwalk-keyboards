#!/usr/bin/env python3
"""List the Figma-frame <-> Playwright-screenshot pairs for the visual-alignment
review, read from docs/figma-sources.yaml.

Run from the repo root:
    python3 .claude/skills/figma-alignment/scripts/list_pairs.py [epic|all]

`epic` matches an epic by name or epic_dir (case-insensitive substring); omit or
pass `all` for every epic. Prints JSON to stdout: per epic, the file_key,
report_path, and the list of pairs {story, viewport, node, shot, screenshot,
screenshot_exists}. Desktop pairs come from each story's `ui` list (screenshots
under __screens__/<epic_dir>/); mobile pairs come from the parallel `ui_mobile`
list (screenshots under __screens__/<epic_dir>/mobile/). Pairs with shot: null
(design-ahead frames with no app screenshot) are included with screenshot=null so
they can be noted in the report.
"""
import argparse
import json
import os
import sys

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required (pip install pyyaml).")

SCREENS_BASE = os.path.join("e2e", "__screens__")
REPORT_BASE = "e2e"


def find_repo_root(start: str) -> str:
    """Walk up from `start` until docs/figma-sources.yaml is found."""
    cur = os.path.abspath(start)
    while True:
        if os.path.isfile(os.path.join(cur, "docs", "figma-sources.yaml")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            sys.exit(
                "Could not find docs/figma-sources.yaml above the current "
                "directory — run from inside the repo."
            )
        cur = parent


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("epic", nargs="?", default="all",
                    help="epic name or epic_dir substring, or 'all' (default)")
    args = ap.parse_args()

    root = find_repo_root(os.getcwd())
    with open(os.path.join(root, "docs", "figma-sources.yaml")) as fh:
        data = yaml.safe_load(fh)

    file_key = data["file_key"]
    want = args.epic.strip().lower()

    out_epics = []
    for epic in data.get("epics", []):
        name, edir = epic.get("epic", ""), epic.get("epic_dir", "")
        if want != "all" and want not in name.lower() and want not in edir.lower():
            continue

        pairs = []
        for story in epic.get("stories", []):
            # Desktop pairs live under __screens__/<edir>/; mobile pairs (from the
            # parallel ui_mobile list) under __screens__/<edir>/mobile/.
            for key, viewport, subdir in (
                ("ui", "desktop", edir),
                ("ui_mobile", "mobile", os.path.join(edir, "mobile")),
            ):
                for ui in story.get(key, []):
                    node, shot = ui.get("node"), ui.get("shot")
                    if shot:
                        rel = os.path.join(SCREENS_BASE, subdir, f"{shot}.png")
                        exists = os.path.isfile(os.path.join(root, rel))
                    else:
                        rel, exists = None, False
                    pairs.append({
                        "story": story.get("story"),
                        "viewport": viewport,
                        "node": node,
                        "shot": shot,
                        "screenshot": rel,
                        "screenshot_exists": exists,
                    })
        out_epics.append({
            "epic": name,
            "epic_dir": edir,
            "report_path": os.path.join(REPORT_BASE, f"{edir}-alignment.md"),
            "pairs": pairs,
        })

    if not out_epics:
        sys.exit(f"No epic matched '{args.epic}'. "
                 f"Epics: {[e.get('epic') for e in data.get('epics', [])]}")

    json.dump({"file_key": file_key, "repo_root": root, "epics": out_epics},
              sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
