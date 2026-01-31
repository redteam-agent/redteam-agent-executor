"""API routes for command execution."""

import json
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

try:
    from sse_starlette.sse import EventSourceResponse
except ImportError:
    # Fallback for environments without sse-starlette
    EventSourceResponse = None

from ..config import settings
from ..executors.base import BaseExecutor
from ..executors.http_executor import HTTPExecutor
from ..executors.shell_executor import ShellExecutor
from ..sandbox.command_filter import CommandFilter, ValidationResult

try:
    import structlog
    logger = structlog.get_logger(__name__)
    _use_structlog = True
except ImportError:
    import logging
    logger = logging.getLogger(__name__)
    _use_structlog = False


def _log(level: str, event: str, **kwargs) -> None:
    """Log with structured data, compatible with both structlog and stdlib."""
    if _use_structlog:
        getattr(logger, level)(event, **kwargs)
    else:
        extra_info = " ".join(f"{k}={v}" for k, v in kwargs.items())
        msg = f"{event} {extra_info}".strip()
        getattr(logger, level)(msg)


router = APIRouter()


# Request/Response Models


class TargetInfo(BaseModel):
    """Information about the target application."""

    url: str
    gcp_project_id: str | None = None
    gcp_region: str | None = None
    gcp_service_name: str | None = None


class ExecuteRequest(BaseModel):
    """Request to execute a command."""

    session_id: str
    run_id: str
    command: str
    executor_type: Literal["http", "shell", "cloudrun"] = "shell"
    target: TargetInfo
    timeout: int = 30


class ExecuteResponse(BaseModel):
    """Response from command execution."""

    execution_id: str
    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    truncated: bool


class ErrorDetail(BaseModel):
    """Error details."""

    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    """Error response."""

    error: ErrorDetail


# Executor Factory


def get_executor(executor_type: str, timeout: int = 30) -> BaseExecutor:
    """
    Get an executor instance by type.

    Args:
        executor_type: Type of executor ("http", "shell", "cloudrun")
        timeout: Timeout in seconds

    Returns:
        Executor instance

    Raises:
        ValueError: If executor type is unknown
    """
    if executor_type == "http":
        return HTTPExecutor(timeout=timeout)
    elif executor_type == "shell":
        return ShellExecutor(timeout=timeout)
    elif executor_type == "cloudrun":
        # CloudRun executor not yet implemented
        raise HTTPException(
            status_code=501,
            detail={
                "error": {
                    "code": "NOT_IMPLEMENTED",
                    "message": "CloudRun executor is not yet implemented",
                }
            },
        )
    else:
        raise ValueError(f"Unknown executor type: {executor_type}")


def get_command_filter() -> CommandFilter:
    """Get a command filter with configured allowed domains."""
    allowed_domains = None
    if settings.ALLOWED_TARGET_DOMAINS != "*":
        allowed_domains = [
            d.strip() for d in settings.ALLOWED_TARGET_DOMAINS.split(",")
        ]
    return CommandFilter(allowed_domains=allowed_domains)


def validate_api_key(api_key: str) -> None:
    """
    Validate the internal API key.

    Raises:
        HTTPException: If API key is invalid
    """
    if api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=401,
            detail={
                "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Invalid API key",
                }
            },
        )


# Endpoints


@router.post("/execute", response_model=ExecuteResponse)
async def execute(
    request: ExecuteRequest,
    x_internal_api_key: str = Header(..., alias="X-Internal-API-Key"),
) -> ExecuteResponse:
    """
    Execute a command and return the result.

    This endpoint validates the command, executes it using the appropriate
    executor, and returns the result.

    Args:
        request: The execution request
        x_internal_api_key: Internal API key for authentication

    Returns:
        ExecuteResponse with execution result

    Raises:
        HTTPException: On authentication failure or blocked command
    """
    # Validate API key
    validate_api_key(x_internal_api_key)

    # Generate execution ID
    execution_id = str(uuid4())

    # Log the request
    _log("info",
        "execute_request",
        execution_id=execution_id,
        session_id=request.session_id,
        run_id=request.run_id,
        executor_type=request.executor_type,
        command=request.command[:100],  # Truncate for logging
    )

    # Validate command
    command_filter = get_command_filter()
    validation = command_filter.validate(request.command, request.target.url)

    if validation.result == ValidationResult.BLOCKED:
        _log("warning",
            "command_blocked",
            execution_id=execution_id,
            reason=validation.reason,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "COMMAND_BLOCKED",
                    "message": validation.reason,
                    "details": {"command": request.command[:100]},
                }
            },
        )

    # Get executor and execute
    try:
        executor = get_executor(request.executor_type, request.timeout)
        result = await executor.execute(request.command, request.timeout)

        _log("info",
            "execute_complete",
            execution_id=execution_id,
            exit_code=result.exit_code,
            duration_ms=result.duration_ms,
        )

        return ExecuteResponse(
            execution_id=execution_id,
            exit_code=result.exit_code,
            stdout=result.stdout,
            stderr=result.stderr,
            duration_ms=result.duration_ms,
            truncated=result.truncated,
        )

    except Exception as e:
        _log("error",
            "execute_error",
            execution_id=execution_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "EXECUTION_ERROR",
                    "message": str(e),
                }
            },
        )


@router.post("/execute/stream")
async def execute_stream(
    request: ExecuteRequest,
    x_internal_api_key: str = Header(..., alias="X-Internal-API-Key"),
):
    """
    Execute a command with SSE streaming output.

    Streams output chunks as Server-Sent Events as they arrive.

    Args:
        request: The execution request
        x_internal_api_key: Internal API key for authentication

    Returns:
        EventSourceResponse with streaming output

    Raises:
        HTTPException: On authentication failure or blocked command
    """
    # Check if SSE is available
    if EventSourceResponse is None:
        raise HTTPException(
            status_code=501,
            detail={
                "error": {
                    "code": "NOT_IMPLEMENTED",
                    "message": "Streaming not available (sse-starlette not installed)",
                }
            },
        )

    # Validate API key
    validate_api_key(x_internal_api_key)

    # Generate execution ID
    execution_id = str(uuid4())

    # Log the request
    _log("info",
        "stream_execute_request",
        execution_id=execution_id,
        session_id=request.session_id,
        run_id=request.run_id,
        executor_type=request.executor_type,
        command=request.command[:100],
    )

    # Validate command
    command_filter = get_command_filter()
    validation = command_filter.validate(request.command, request.target.url)

    if validation.result == ValidationResult.BLOCKED:
        _log("warning",
            "command_blocked",
            execution_id=execution_id,
            reason=validation.reason,
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": {
                    "code": "COMMAND_BLOCKED",
                    "message": validation.reason,
                    "details": {"command": request.command[:100]},
                }
            },
        )

    async def event_generator():
        """Generate SSE events from execution output."""
        try:
            executor = get_executor(request.executor_type, request.timeout)

            async for chunk in executor.stream_execute(
                request.command,
                request.timeout,
            ):
                if "chunk" in chunk:
                    yield {
                        "event": "output",
                        "data": json.dumps({
                            "execution_id": execution_id,
                            "stream": chunk.get("stream"),
                            "chunk": chunk.get("chunk"),
                        }),
                    }
                elif "complete" in chunk:
                    _log("info",
                        "stream_execute_complete",
                        execution_id=execution_id,
                        exit_code=chunk.get("exit_code"),
                        duration_ms=chunk.get("duration_ms"),
                    )
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "execution_id": execution_id,
                            "exit_code": chunk.get("exit_code"),
                            "duration_ms": chunk.get("duration_ms"),
                        }),
                    }

        except Exception as e:
            _log("error",
                "stream_execute_error",
                execution_id=execution_id,
                error=str(e),
            )
            yield {
                "event": "error",
                "data": json.dumps({
                    "execution_id": execution_id,
                    "error": {
                        "code": "EXECUTION_ERROR",
                        "message": str(e),
                    },
                }),
            }

    return EventSourceResponse(event_generator())
