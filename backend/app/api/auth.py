from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings
from app.database import get_db
from app.models import AdminUser
from app.auth import verify_password, hash_password, create_access_token, require_auth

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == body.username)
    )
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=body.username)

    response.set_cookie(
        key="infraview_token",
        value=token,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )

    # Remove initial credentials file after first successful login
    import os
    creds_path = "data/initial_credentials.txt"
    if os.path.exists(creds_path):
        os.remove(creds_path)

    return {
        "user": body.username,
        "must_change_password": admin.must_change_password,
    }


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("infraview_token", path="/")
    return {"status": "ok"}


@router.get("/auth/ws-token")
async def ws_token(user: dict = Depends(require_auth)):
    """Return a short-lived token for WebSocket authentication."""
    token = create_access_token(subject=user["sub"])
    return {"token": token}


@router.get("/auth/me")
async def me(
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == user["sub"])
    )
    admin = result.scalar_one_or_none()
    return {
        "user": user["sub"],
        "must_change_password": admin.must_change_password if admin else False,
    }


@router.post("/auth/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: dict = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AdminUser).where(AdminUser.username == user["sub"])
    )
    admin = result.scalar_one_or_none()
    if not admin:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(body.current_password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    admin.password_hash = hash_password(body.new_password)
    admin.must_change_password = False
    await db.commit()

    return {"status": "ok"}
