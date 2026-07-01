"""Runtime inspection scenario API for the bench Docker surface."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class ScenarioSummary(BaseModel):
    id: str
    title: str


class ScenarioListResponse(BaseModel):
    scenarios: list[ScenarioSummary]


@dataclass
class _ScenarioCache:
    path: Path
    mtime_ns: int
    payload: dict


_cache: _ScenarioCache | None = None


def _scenarios_path() -> Path:
    return Path(settings.BENCH_SCENARIOS_PATH)


def _load_export() -> dict:
    global _cache
    path = _scenarios_path()
    if not path.is_file():
        raise HTTPException(
            status_code=404,
            detail=(
                f"Bench inspection export not found at {path}. "
                "Run `cd bench && npm run export:inspection`, then refresh."
            ),
        )

    mtime_ns = path.stat().st_mtime_ns
    if _cache is not None and _cache.path == path and _cache.mtime_ns == mtime_ns:
        return _cache.payload

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid bench inspection export JSON at {path}: {exc}",
        ) from exc

    if not isinstance(raw, dict) or not isinstance(raw.get("scenarios"), list):
        raise HTTPException(
            status_code=500,
            detail=f"Bench inspection export at {path} is missing a scenarios array.",
        )

    _cache = _ScenarioCache(path=path, mtime_ns=mtime_ns, payload=raw)
    return raw


def _scenario_by_id(scenario_id: str) -> dict:
    export = _load_export()
    for entry in export["scenarios"]:
        if isinstance(entry, dict) and entry.get("id") == scenario_id:
            return entry
    raise HTTPException(
        status_code=404,
        detail=(
            f"Inspection scenario '{scenario_id}' was not found. "
            "If you added it recently, run `cd bench && npm run export:inspection`, then refresh."
        ),
    )


@router.get("/scenarios", response_model=ScenarioListResponse)
def list_scenarios() -> ScenarioListResponse:
    export = _load_export()
    summaries: list[ScenarioSummary] = []
    for entry in export["scenarios"]:
        if not isinstance(entry, dict):
            continue
        scenario_id = entry.get("id")
        title = entry.get("title")
        if isinstance(scenario_id, str) and isinstance(title, str):
            summaries.append(ScenarioSummary(id=scenario_id, title=title))
    return ScenarioListResponse(scenarios=summaries)


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str) -> dict:
    return _scenario_by_id(scenario_id)
