from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import AlertRule, AlertEvent
from app.schemas.alert import (
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertEventResponse,
    PaginatedAlertEventResponse,
)

router = APIRouter()


@router.get("/alerts", response_model=list[AlertRuleResponse])
async def list_alerts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule))
    return result.scalars().all()


@router.post("/alerts", response_model=AlertRuleResponse)
async def create_alert(body: AlertRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = AlertRule(**body.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.put("/alerts/{alert_id}", response_model=AlertRuleResponse)
async def update_alert(
    alert_id: int, body: AlertRuleUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AlertRule).where(AlertRule.id == alert_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == alert_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    await db.delete(rule)
    await db.commit()
    return {"status": "deleted"}


@router.get("/alerts/events", response_model=PaginatedAlertEventResponse)
async def list_alert_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    server_id: str | None = Query(None),
    severity: str | None = Query(None, pattern="^(warning|critical)$"),
    db: AsyncSession = Depends(get_db),
):
    base_query = select(AlertEvent)
    count_query = select(func.count()).select_from(AlertEvent)

    if server_id:
        base_query = base_query.where(AlertEvent.server_id == server_id)
        count_query = count_query.where(AlertEvent.server_id == server_id)
    if severity:
        base_query = base_query.where(AlertEvent.severity == severity)
        count_query = count_query.where(AlertEvent.severity == severity)

    total = (await db.execute(count_query)).scalar()

    result = await db.execute(
        base_query
        .order_by(AlertEvent.fired_at.desc())
        .limit(limit)
        .offset(offset)
    )
    events = result.scalars().all()
    return PaginatedAlertEventResponse(
        items=[
            AlertEventResponse(
                id=e.id,
                rule_id=e.rule_id,
                server_id=e.server_id,
                metric=e.metric,
                value=e.value,
                threshold=e.threshold,
                severity=e.severity,
                message=e.message,
                fired_at=e.fired_at.timestamp(),
                acknowledged=e.acknowledged,
                acknowledged_at=e.acknowledged_at.timestamp() if e.acknowledged_at else None,
                resolved=e.resolved,
                resolved_at=e.resolved_at.timestamp() if e.resolved_at else None,
            )
            for e in events
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/alerts/events/{event_id}/acknowledge")
async def acknowledge_event(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Alert event not found")
    event.acknowledged = True
    event.acknowledged_at = datetime.utcnow()
    await db.commit()
    return {"status": "acknowledged"}


@router.post("/alerts/events/{event_id}/resolve")
async def resolve_event(event_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertEvent).where(AlertEvent.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Alert event not found")
    event.resolved = True
    event.resolved_at = datetime.utcnow()
    await db.commit()
    return {"status": "resolved"}
