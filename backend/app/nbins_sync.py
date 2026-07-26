"""Pull project/ship master data from NBINS and upsert it locally.

NBINS is the source of truth for projects and ships. Matching rules:
- project: by ``code`` first; a local project with no code but an exactly
  matching name is adopted (its code gets set). Otherwise a new project is
  created, except archived NBINS projects which are only kept up to date if
  already linked.
- ship: by ``(project, hull_no)``; only the name is updated, ships are never
  deleted here (ship_progress history hangs off them).

Kept free of FastAPI imports so it can be tested standalone.
"""

import json
import os
import urllib.error
import urllib.request

from sqlalchemy.orm import Session

from .models import Project, Ship
from .services import write_audit


class NbinsSyncError(RuntimeError):
    pass


def _config() -> tuple[str, str]:
    base = os.environ.get("NBINS_API_BASE", "").rstrip("/")
    token = os.environ.get("NBINS_SYNC_TOKEN", "")
    if not base:
        raise NbinsSyncError("NBINS_API_BASE is not configured.")
    if not token:
        raise NbinsSyncError("NBINS_SYNC_TOKEN is not configured.")
    return base, token


def fetch_master_data(timeout: float = 30.0) -> dict:
    base, token = _config()
    request = urllib.request.Request(
        f"{base}/api/sync/master-data",
        headers={"X-Sync-Token": token},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:300]
        raise NbinsSyncError(f"NBINS responded {exc.code}: {detail}") from exc
    except Exception as exc:
        raise NbinsSyncError(f"Failed to reach NBINS: {exc}") from exc
    if not payload.get("ok"):
        raise NbinsSyncError(f"NBINS returned an error: {payload.get('error')}")
    return payload["data"]


def apply_master_data(db: Session, data: dict, actor: str) -> dict:
    result = {
        "projects_created": 0,
        "projects_linked": 0,
        "projects_updated": 0,
        "projects_skipped_archived": 0,
        "ships_created": 0,
        "ships_updated": 0,
        "warnings": [],
    }

    local_by_nbins_id: dict[str, Project] = {}
    for remote in data.get("projects") or []:
        code = remote.get("code")
        name = remote.get("name")
        if not code or not name:
            result["warnings"].append(f"Skipped NBINS project without code/name: {remote.get('id')}")
            continue
        local = db.query(Project).filter(Project.code == code).one_or_none()
        if local is None:
            local = (
                db.query(Project)
                .filter(Project.name == name, Project.code.is_(None))
                .one_or_none()
            )
            if local is not None:
                local.code = code
                result["projects_linked"] += 1
            elif remote.get("status") == "archived":
                result["projects_skipped_archived"] += 1
                continue
            else:
                local = Project(name=name, code=code)
                db.add(local)
                db.flush()
                result["projects_created"] += 1
        elif local.name != name:
            clash = (
                db.query(Project)
                .filter(Project.name == name, Project.id != local.id)
                .one_or_none()
            )
            if clash is None:
                local.name = name
                result["projects_updated"] += 1
            else:
                result["warnings"].append(
                    f"Cannot rename project #{local.id} to '{name}': name already in use."
                )
        local_by_nbins_id[str(remote.get("id"))] = local

    for remote in data.get("ships") or []:
        local_project = local_by_nbins_id.get(str(remote.get("projectId")))
        if local_project is None:
            continue
        hull_no = (remote.get("hullNumber") or "").strip()
        if not hull_no:
            result["warnings"].append(f"Skipped NBINS ship without hull number: {remote.get('id')}")
            continue
        ship_name = remote.get("shipName") or None
        local_ship = (
            db.query(Ship)
            .filter(Ship.project_id == local_project.id, Ship.hull_no == hull_no)
            .one_or_none()
        )
        if local_ship is None:
            db.add(Ship(project_id=local_project.id, hull_no=hull_no, name=ship_name))
            result["ships_created"] += 1
        elif ship_name is not None and local_ship.name != ship_name:
            local_ship.name = ship_name
            result["ships_updated"] += 1

    changed = sum(
        result[key]
        for key in (
            "projects_created",
            "projects_linked",
            "projects_updated",
            "ships_created",
            "ships_updated",
        )
    )
    write_audit(
        db,
        entity_type="sync",
        entity_id=None,
        action="nbins_master_data",
        summary=f"Synced master data from NBINS ({changed} changes).",
        actor=actor,
        after=result,
    )
    db.commit()
    return result
