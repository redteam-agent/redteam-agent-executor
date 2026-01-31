"""FastAPI application for command execution service."""

from fastapi import FastAPI

from .api.routes import router
from .config import settings

app = FastAPI(
    title="RedTeam Agent Executor",
    description="Command execution service for security testing",
    version="0.1.0",
)


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "0.1.0"}


# Include API routes
app.include_router(router)
