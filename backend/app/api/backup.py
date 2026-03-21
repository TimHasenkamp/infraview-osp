import os
import shutil
import logging
from datetime import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

DB_PATH = settings.database_url.replace("sqlite+aiosqlite:///", "")
BACKUP_DIR = "data/backups"


@router.post("/backup")
async def create_backup():
    """Create a backup of the current database."""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_name = f"infraview_backup_{timestamp}.db"
    backup_path = os.path.join(BACKUP_DIR, backup_name)

    shutil.copy2(DB_PATH, backup_path)
    size = os.path.getsize(backup_path)

    logger.info(f"Backup created: {backup_path} ({size} bytes)")

    return {
        "status": "ok",
        "filename": backup_name,
        "size_bytes": size,
        "timestamp": timestamp,
    }


@router.get("/backup/download")
async def download_backup():
    """Download the current database as a file."""
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Database file not found")

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return FileResponse(
        path=DB_PATH,
        filename=f"infraview_backup_{timestamp}.db",
        media_type="application/octet-stream",
    )


@router.get("/backup/list")
async def list_backups():
    """List available backups."""
    if not os.path.exists(BACKUP_DIR):
        return {"backups": []}

    backups = []
    for f in sorted(os.listdir(BACKUP_DIR), reverse=True):
        if f.endswith(".db"):
            path = os.path.join(BACKUP_DIR, f)
            backups.append({
                "filename": f,
                "size_bytes": os.path.getsize(path),
            })

    return {"backups": backups}


@router.post("/backup/restore")
async def restore_backup(file: UploadFile = File(...)):
    """Restore database from an uploaded backup file."""
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="File must be a .db file")

    # Save current DB as safety backup before restore
    os.makedirs(BACKUP_DIR, exist_ok=True)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safety_path = os.path.join(BACKUP_DIR, f"pre_restore_{timestamp}.db")
    if os.path.exists(DB_PATH):
        shutil.copy2(DB_PATH, safety_path)

    # Read and validate uploaded file
    content = await file.read()

    # Max 100MB
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 100MB)")

    # Validate SQLite magic bytes
    if content[:16] != b"SQLite format 3\x00":
        raise HTTPException(status_code=400, detail="Invalid SQLite database file")

    # Write to temporary path first, then swap
    tmp_path = DB_PATH + ".tmp"
    with open(tmp_path, "wb") as f:
        f.write(content)

    # Verify the temp DB is readable
    import sqlite3
    try:
        conn = sqlite3.connect(tmp_path)
        conn.execute("SELECT count(*) FROM sqlite_master")
        conn.close()
    except Exception:
        os.remove(tmp_path)
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid database")

    # Swap into place
    os.replace(tmp_path, DB_PATH)

    size = len(content)
    logger.info(f"Database restored from upload ({size} bytes). Safety backup at {safety_path}")

    return {
        "status": "ok",
        "restored_size_bytes": size,
        "safety_backup": safety_path,
    }
