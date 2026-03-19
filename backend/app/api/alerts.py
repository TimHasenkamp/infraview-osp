from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import AlertRule, AlertEvent
from app.schemas.alert import (
    AlertRuleCreate,
    AlertRuleUpdate,
    AlertRuleResponse,
    AlertEventResponse,
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


@router.get("/alerts/events", response_model=list[AlertEventResponse])
async def list_alert_events(
    limit: int = 50, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AlertEvent).order_by(AlertEvent.fired_at.desc()).limit(limit)
    )
    events = result.scalars().all()
    return [
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
        )
        for e in events
    ]
