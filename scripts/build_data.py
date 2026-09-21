#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXP_DIR = ROOT / "experiments"
OUT = ROOT / "data" / "experiments.json"
PROJECT = ROOT / "project.json"

REQUIRED_TOP = {"id", "name", "status", "resource_status", "resource", "trajectory", "map", "geometry", "revisit", "media"}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate(exp, path):
    missing = sorted(REQUIRED_TOP - set(exp))
    if missing:
        raise ValueError(f"{path.name}: missing keys: {', '.join(missing)}")
    if not isinstance(exp["id"], str) or not exp["id"].strip():
        raise ValueError(f"{path.name}: id must be a non-empty string")


def main():
    project = load_json(PROJECT)
    experiments = []
    seen = set()
    for path in sorted(EXP_DIR.glob("*.json")):
        if path.name.startswith("_"):
            continue
        exp = load_json(path)
        validate(exp, path)
        if exp["id"] in seen:
            raise ValueError(f"Duplicate experiment id: {exp['id']}")
        seen.add(exp["id"])
        experiments.append(exp)

    payload = {
        "schema_version": 1,
        "project": project,
        "experiments": experiments,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[OK] wrote {OUT}")
    print(f"[OK] experiments: {', '.join(e['id'] for e in experiments)}")


if __name__ == "__main__":
    main()
