from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings as app_settings
from app.database import get_db
from app.services.settings_service import get_all_settings, update_settings

router = APIRouter()


class SettingsUpdateRequest(BaseModel):
    settings: dict[str, str]


@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    return await get_all_settings(db)


@router.get("/agent/setup")
async def get_agent_setup():
    return {"api_key": app_settings.agent_api_key}


@router.put("/settings")
async def put_settings(
    body: SettingsUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    changed = await update_settings(db, body.settings)
    return {"status": "ok", "updated": list(changed.keys())}
