from fastapi import APIRouter, HTTPException, Depends, Response, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import settings
from app.auth import verify_password, hash_password, create_access_token, require_auth

limiter = Limiter(key_func=get_remote_address)

router = APIRouter()

# Hash password at startup
_admin_password_hash = hash_password(settings.admin_password)


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response):
    if body.username != settings.admin_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(body.password, _admin_password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=body.username)

    response.set_cookie(
        key="infraview_token",
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )

    return {"token": token, "user": body.username}


@router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("infraview_token", path="/")
    return {"status": "ok"}


@router.get("/auth/me")
async def me(user: dict = Depends(require_auth)):
    return {"user": user["sub"]}
