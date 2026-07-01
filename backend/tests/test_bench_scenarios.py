"""Tests for the runtime bench inspection scenario API."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import bench as bench_routes
from app.api.routes.bench import router
from app.core.config import settings

FIXTURE_EXPORT = {
    "version": 1,
    "exportedAt": "2026-07-01T00:00:00.000Z",
    "scenarios": [
        {
            "id": "uno-led-blink",
            "title": "Arduino Uno LED Blink",
            "project": {
                "format": "velxio-project",
                "version": 1,
                "exportedAt": "2026-06-29T00:00:00.000Z",
                "boards": [
                    {
                        "id": "arduino-uno",
                        "boardKind": "arduino-uno",
                        "x": 50,
                        "y": 50,
                        "activeFileGroupId": "group-arduino-uno",
                    }
                ],
                "fileGroups": {
                    "group-arduino-uno": [{"name": "sketch.ino", "content": "void setup() {}"}]
                },
                "components": [],
                "wires": [],
                "activeBoardId": "arduino-uno",
            },
        }
    ],
}


@pytest.fixture()
def scenarios_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    bench_routes._cache = None
    path = tmp_path / "scenarios.json"
    path.write_text(json.dumps(FIXTURE_EXPORT), encoding="utf-8")
    monkeypatch.setattr(settings, "BENCH_SCENARIOS_PATH", str(path))
    return path


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/bench")
    return TestClient(app)


def test_list_scenarios(client: TestClient, scenarios_file: Path) -> None:
    bench_routes._cache = None
    response = client.get("/api/bench/scenarios")
    assert response.status_code == 200
    assert response.json() == {
        "scenarios": [{"id": "uno-led-blink", "title": "Arduino Uno LED Blink"}]
    }


def test_get_scenario(client: TestClient, scenarios_file: Path) -> None:
    bench_routes._cache = None
    response = client.get("/api/bench/scenarios/uno-led-blink")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "uno-led-blink"
    assert body["title"] == "Arduino Uno LED Blink"
    assert body["project"]["format"] == "velxio-project"


def test_get_missing_scenario(client: TestClient, scenarios_file: Path) -> None:
    bench_routes._cache = None
    response = client.get("/api/bench/scenarios/missing-id")
    assert response.status_code == 404
    assert "export:inspection" in response.json()["detail"]


def test_missing_export_file(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bench_routes._cache = None
    missing = tmp_path / "missing.json"
    monkeypatch.setattr(settings, "BENCH_SCENARIOS_PATH", str(missing))
    response = client.get("/api/bench/scenarios")
    assert response.status_code == 404
    assert "export:inspection" in response.json()["detail"]


def test_reload_on_mtime_change(client: TestClient, scenarios_file: Path) -> None:
    bench_routes._cache = None
    first = client.get("/api/bench/scenarios")
    assert first.status_code == 200
    assert len(first.json()["scenarios"]) == 1

    updated = {
        **FIXTURE_EXPORT,
        "scenarios": [
            *FIXTURE_EXPORT["scenarios"],
            {
                "id": "second",
                "title": "Second",
                "project": FIXTURE_EXPORT["scenarios"][0]["project"],
            },
        ],
    }
    scenarios_file.write_text(json.dumps(updated), encoding="utf-8")

    second = client.get("/api/bench/scenarios")
    assert second.status_code == 200
    assert len(second.json()["scenarios"]) == 2
