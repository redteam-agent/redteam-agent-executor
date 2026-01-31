"""
HTTP executor for web application testing.

Executes HTTP requests against target applications and captures
full request/response details for security analysis.
"""

import asyncio
import re
import shlex
import time
from dataclasses import dataclass
from typing import Any

import httpx

from .base import BaseExecutor, ExecutionResult


@dataclass
class HTTPResponse:
    """Captured HTTP response."""

    status_code: int
    headers: dict[str, str]
    body: str
    elapsed_ms: int


class HTTPExecutor(BaseExecutor):
    """
    Executes HTTP requests for web application testing.

    Supports:
    - Direct HTTP requests (method, url, headers, body)
    - Parsing and executing curl commands from LLM output
    - Full response capture including headers and timing
    """

    def __init__(self, timeout: int = 30):
        """Initialize HTTP executor."""
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            verify=False,  # Allow self-signed certs for testing
        )

    async def execute(
        self,
        command: str,
        timeout: int | None = None,
    ) -> ExecutionResult:
        """
        Execute an HTTP command.

        The command can be:
        - A curl command string
        - A raw HTTP request specification

        Args:
            command: The command to execute
            timeout: Optional timeout override

        Returns:
            ExecutionResult with captured response
        """
        timeout = timeout or self.timeout
        start_time = time.time()

        try:
            # Parse curl command
            request = self._parse_curl_command(command)

            # Execute request
            response = await self.client.request(
                method=request["method"],
                url=request["url"],
                headers=request.get("headers", {}),
                content=request.get("body"),
                timeout=timeout,
            )

            elapsed_ms = int((time.time() - start_time) * 1000)

            # Format output like curl would
            stdout = self._format_response(response, request)

            return ExecutionResult(
                exit_code=0,
                stdout=stdout,
                stderr="",
                duration_ms=elapsed_ms,
                truncated=False,
            )

        except httpx.TimeoutException:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return ExecutionResult(
                exit_code=28,  # curl timeout exit code
                stdout="",
                stderr=f"Request timed out after {timeout} seconds",
                duration_ms=elapsed_ms,
                truncated=False,
            )

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            return ExecutionResult(
                exit_code=1,
                stdout="",
                stderr=str(e),
                duration_ms=elapsed_ms,
                truncated=False,
            )

    async def stream_execute(
        self,
        command: str,
        timeout: int | None = None,
    ):
        """Stream execution output (for HTTP, just yields the final result)."""
        result = await self.execute(command, timeout)

        yield {"stream": "stdout", "chunk": result.stdout}

        if result.stderr:
            yield {"stream": "stderr", "chunk": result.stderr}

        yield {"complete": True, "exit_code": result.exit_code}

    def _parse_curl_command(self, command: str) -> dict[str, Any]:
        """
        Parse a curl command into request components.

        Supports common curl flags:
        -X, --request: HTTP method
        -H, --header: Headers
        -d, --data: Request body
        -b, --cookie: Cookies
        -A, --user-agent: User agent
        --json: JSON data
        """
        # Default request
        request: dict[str, Any] = {
            "method": "GET",
            "url": "",
            "headers": {},
            "body": None,
        }

        # Handle simple URL without curl prefix
        if not command.strip().startswith("curl"):
            if command.strip().startswith("http"):
                request["url"] = command.strip()
                return request
            raise ValueError(f"Cannot parse command: {command}")

        # Parse with shlex
        try:
            parts = shlex.split(command)
        except ValueError:
            # Handle unbalanced quotes by doing simple split
            parts = command.split()

        i = 0
        while i < len(parts):
            part = parts[i]

            if part == "curl":
                i += 1
                continue

            # Method
            if part in ("-X", "--request"):
                request["method"] = parts[i + 1].upper()
                i += 2
                continue

            # Headers
            if part in ("-H", "--header"):
                header = parts[i + 1]
                if ":" in header:
                    key, value = header.split(":", 1)
                    request["headers"][key.strip()] = value.strip()
                i += 2
                continue

            # Data
            if part in ("-d", "--data", "--data-raw", "--data-binary"):
                request["body"] = parts[i + 1]
                if request["method"] == "GET":
                    request["method"] = "POST"
                i += 2
                continue

            # JSON data
            if part == "--json":
                request["body"] = parts[i + 1]
                request["headers"]["Content-Type"] = "application/json"
                if request["method"] == "GET":
                    request["method"] = "POST"
                i += 2
                continue

            # Cookie
            if part in ("-b", "--cookie"):
                request["headers"]["Cookie"] = parts[i + 1]
                i += 2
                continue

            # User agent
            if part in ("-A", "--user-agent"):
                request["headers"]["User-Agent"] = parts[i + 1]
                i += 2
                continue

            # Skip other flags
            if part.startswith("-"):
                # Check if next part is a value for this flag
                if i + 1 < len(parts) and not parts[i + 1].startswith("-"):
                    i += 2
                else:
                    i += 1
                continue

            # URL (positional argument)
            if part.startswith("http"):
                request["url"] = part
                i += 1
                continue

            i += 1

        if not request["url"]:
            raise ValueError(f"No URL found in command: {command}")

        return request

    def _format_response(
        self,
        response: httpx.Response,
        request: dict[str, Any],
    ) -> str:
        """Format the HTTP response like curl -i output."""
        lines = []

        # Status line
        lines.append(f"HTTP/{response.http_version} {response.status_code} {response.reason_phrase}")

        # Headers
        for name, value in response.headers.items():
            lines.append(f"{name}: {value}")

        lines.append("")  # Empty line between headers and body

        # Body
        try:
            body = response.text
            # Truncate very long bodies
            if len(body) > 50000:
                body = body[:50000] + "\n... (truncated)"
            lines.append(body)
        except Exception:
            lines.append(f"(binary body, {len(response.content)} bytes)")

        return "\n".join(lines)

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
