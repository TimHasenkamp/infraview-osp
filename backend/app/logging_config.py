import json
import logging
import sys
import uuid
from contextvars import ContextVar
from datetime import datetime

# Context variable for request trace ID
trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname.lower(),
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add trace ID if present
        trace_id = trace_id_var.get("")
        if trace_id:
            log_entry["trace_id"] = trace_id

        # Add caller info
        if record.pathname:
            log_entry["caller"] = f"{record.filename}:{record.lineno}"

        # Add exception info
        if record.exc_info and record.exc_info[2]:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra fields
        for key in ("method", "path", "status_code", "duration_ms", "client_ip"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)

        return json.dumps(log_entry)


def generate_trace_id() -> str:
    return uuid.uuid4().hex[:16]


def setup_logging():
    """Configure structured JSON logging for the entire application."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    # Quiet noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").propagate = False
