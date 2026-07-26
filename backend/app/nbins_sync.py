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
from datetime import datetime

from sqlalchemy.orm import Session

from .models import ItpItem, Project, Ship, ShipProgress, ShipProgressEvent, SyncPendingEvent, SyncState
from .services import write_audit

EVENTS_PAGE_SIZE = 200
ALLOWED_SYNC_STATUSES = {"not_started", "in_progress", "done"}
EVENTS_CURSOR_KEY = "nbins_events_cursor"


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


def fetch_events(after: int, limit: int = EVENTS_PAGE_SIZE, timeout: float = 30.0) -> dict:
    base, token = _config()
    request = urllib.request.Request(
        f"{base}/api/sync/events?after={int(after)}&limit={int(limit)}",
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


def _apply_snapshots(progress: ShipProgress, item: ItpItem) -> None:
    # 与 main.apply_progress_snapshots 保持一致；内联以避免循环导入
    progress.item_uid = item.item_uid
    progress.version_id = item.version_id
    progress.code_snapshot = item.code
    progress.parent_code_snapshot = item.parent_code
    progress.title_zh_snapshot = item.title_zh
    progress.title_en_snapshot = item.title_en


def _resolve_event_target(db: Session, event: dict) -> tuple[Ship, ItpItem]:
    project_code = (event.get("projectCode") or "").strip()
    hull_no = (event.get("hullNumber") or "").strip()
    itp_code = (event.get("itpCode") or "").strip()
    if not project_code or not hull_no or not itp_code:
        raise LookupError("event missing projectCode/hullNumber/itpCode")
    project = db.query(Project).filter(Project.code == project_code).one_or_none()
    if project is None:
        raise LookupError(f"no local project with code '{project_code}'")
    ship = (
        db.query(Ship)
        .filter(Ship.project_id == project.id, Ship.hull_no == hull_no)
        .one_or_none()
    )
    if ship is None:
        raise LookupError(f"no ship '{hull_no}' in project '{project_code}'")
    item = (
        db.query(ItpItem)
        .filter(ItpItem.project_id == project.id, ItpItem.code == itp_code, ItpItem.active == True)  # noqa: E712
        .one_or_none()
    )
    if item is None:
        raise LookupError(f"no active ITP item '{itp_code}' in project '{project_code}'")
    if not item.is_inspection:
        raise LookupError(f"ITP item '{itp_code}' is not an inspection leaf")
    return ship, item


def apply_inspection_event(db: Session, event: dict, actor: str) -> str:
    """应用单条 NBINS 检验状态事件；返回 'applied' 或 'skipped'（幂等）。"""
    status = event.get("itpStatus")
    if status not in ALLOWED_SYNC_STATUSES:
        raise LookupError(f"unsupported status '{status}'")
    ship, item = _resolve_event_target(db, event)
    progress = (
        db.query(ShipProgress)
        .filter(ShipProgress.ship_id == ship.id, ShipProgress.item_uid == item.item_uid)
        .one_or_none()
    )
    progress = progress or (
        db.query(ShipProgress)
        .filter(ShipProgress.ship_id == ship.id, ShipProgress.itp_item_id == item.id)
        .one_or_none()
    )
    if progress is not None and progress.status == status:
        return "skipped"
    status_before = progress.status if progress is not None and progress.id else None
    current_revision = progress.revision if progress is not None and progress.id else 0
    if progress is None:
        progress = ShipProgress(ship_id=ship.id, itp_item_id=item.id)
        db.add(progress)
    _apply_snapshots(progress, item)
    progress.status = status
    # 有意不改 progress.notes：保留人工填写的备注
    progress.updated_by = actor
    progress.completed_at = datetime.utcnow() if status == "done" else None
    progress.revision = current_revision + 1
    db.flush()
    detail = event.get("detail") or ""
    progress_event = ShipProgressEvent(
        ship_id=ship.id,
        project_id=ship.project_id,
        itp_item_id=item.id,
        item_uid=item.item_uid,
        version_id=item.version_id,
        status_before=status_before,
        status_after=status,
        notes=f"NBINS sync {detail}".strip(),
        code_snapshot=item.code,
        parent_code_snapshot=item.parent_code,
        title_zh_snapshot=item.title_zh,
        title_en_snapshot=item.title_en,
        updated_by=actor,
    )
    db.add(progress_event)
    db.flush()
    progress.last_event_id = progress_event.id
    return "applied"


def _get_cursor(db: Session) -> int:
    row = db.get(SyncState, EVENTS_CURSOR_KEY)
    try:
        return int(row.value) if row else 0
    except ValueError:
        return 0


def _set_cursor(db: Session, value: int) -> None:
    row = db.get(SyncState, EVENTS_CURSOR_KEY)
    if row is None:
        db.add(SyncState(key=EVENTS_CURSOR_KEY, value=str(value)))
    else:
        row.value = str(value)


def pull_inspection_events(db: Session, actor: str = "nbins-sync") -> dict:
    """按游标增量拉取 NBINS 检验事件并应用；每页提交一次。"""
    result = {"events_applied": 0, "events_skipped": 0, "events_pending": 0}
    cursor = _get_cursor(db)
    while True:
        data = fetch_events(cursor)
        events = data.get("events") or []
        if not events:
            break
        for event in events:
            outbox_id = int(event.get("id") or 0)
            try:
                outcome = apply_inspection_event(db, event, actor)
                key = "events_applied" if outcome == "applied" else "events_skipped"
                result[key] += 1
            except LookupError as exc:
                db.add(
                    SyncPendingEvent(
                        outbox_id=outbox_id,
                        payload_json=json.dumps(event, ensure_ascii=False),
                        reason=str(exc),
                    )
                )
                result["events_pending"] += 1
            cursor = max(cursor, outbox_id)
        _set_cursor(db, cursor)
        db.commit()
        if len(events) < EVENTS_PAGE_SIZE:
            break
    result["cursor"] = cursor
    if result["events_applied"] or result["events_pending"]:
        write_audit(
            db,
            entity_type="sync",
            entity_id=None,
            action="nbins_events",
            summary=(
                f"Applied {result['events_applied']} NBINS inspection events "
                f"({result['events_pending']} pending, {result['events_skipped']} unchanged)."
            ),
            actor=actor,
            after=result,
        )
        db.commit()
    return result


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
