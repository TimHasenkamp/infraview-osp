import os

# Set required secrets before any app imports
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-for-pytest")
os.environ.setdefault("AGENT_API_KEY", "test-agent-key-for-pytest")
