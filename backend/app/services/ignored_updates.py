from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import IgnoredUpdate


async def get_ignored_versions(session: AsyncSession, server_id: str) -> dict[str, str]:
    """Return {container_name: ignored_version} for a server."""
    result = await session.execute(
        select(IgnoredUpdate.container_name, IgnoredUpdate.ignored_version).where(
            IgnoredUpdate.server_id == server_id
        )
    )
    return {name: version for name, version in result.all()}


def mask_ignored(container: dict, ignored: dict[str, str]) -> dict:
    """Given a container payload dict, flip update_available -> update_ignored when
    the offered version matches the user's ignored version for that container."""
    if container.get("update_available") and ignored.get(container.get("name")) == container.get("latest_version"):
        container["update_available"] = False
        container["update_ignored"] = True
    return container
