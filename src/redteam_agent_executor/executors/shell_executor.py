"""
Shell command executor for running security tools.

Executes shell commands (sqlmap, nmap, nikto, etc.) via asyncio subprocess
with support for streaming output and timeout handling.
"""

import asyncio
import os
import time
from pathlib import Path
from typing import AsyncIterator

from .base import BaseExecutor, ExecutionResult


# Maximum output size in bytes (10 MB default)
MAX_OUTPUT_SIZE = 10 * 1024 * 1024


class ShellExecutor(BaseExecutor):
    """
    Executes shell commands for security testing.

    Supports:
    - Async subprocess execution
    - Streaming stdout/stderr
    - Timeout handling with process cleanup
    - Output size limiting
    """

    def __init__(
        self,
        timeout: int = 30,
        max_output_size: int = MAX_OUTPUT_SIZE,
    ):
        """
        Initialize shell executor.

        Args:
            timeout: Default timeout in seconds
            max_output_size: Maximum output size in bytes before truncation
        """
        self.timeout = timeout
        self.max_output_size = max_output_size

    async def execute(
        self,
        command: str,
        timeout: int | None = None,
        working_dir: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        """
        Execute a shell command and return the result.

        Args:
            command: The shell command to execute
            timeout: Optional timeout override in seconds
            working_dir: Optional working directory
            env: Optional environment variables (merged with safe defaults)

        Returns:
            ExecutionResult with output and exit code
        """
        timeout = timeout or self.timeout
        start_time = time.time()

        # Prepare environment - inherit safe vars, add custom ones
        process_env = self._prepare_env(env)

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env=process_env,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout,
                )

                elapsed_ms = int((time.time() - start_time) * 1000)

                # Decode and truncate output if needed
                stdout_str, stdout_truncated = self._decode_and_truncate(stdout)
                stderr_str, stderr_truncated = self._decode_and_truncate(stderr)

                return ExecutionResult(
                    exit_code=process.returncode or 0,
                    stdout=stdout_str,
                    stderr=stderr_str,
                    duration_ms=elapsed_ms,
                    truncated=stdout_truncated or stderr_truncated,
                )

            except asyncio.TimeoutError:
                # Kill the process on timeout
                process.kill()
                await process.wait()

                elapsed_ms = int((time.time() - start_time) * 1000)

                return ExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Command timed out after {timeout} seconds",
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
        working_dir: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> AsyncIterator[dict]:
        """
        Execute a command with streaming output.

        Yields output chunks as they arrive from stdout/stderr.

        Args:
            command: The shell command to execute
            timeout: Optional timeout in seconds
            working_dir: Optional working directory
            env: Optional environment variables

        Yields:
            Dicts with either:
            - {"stream": "stdout"|"stderr", "chunk": str}
            - {"complete": True, "exit_code": int, "duration_ms": int}
        """
        timeout = timeout or self.timeout
        start_time = time.time()
        process_env = self._prepare_env(env)

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=working_dir,
                env=process_env,
            )

            async def read_stream(
                stream: asyncio.StreamReader,
                name: str,
            ) -> AsyncIterator[dict]:
                """Read lines from a stream and yield chunks."""
                total_bytes = 0
                while True:
                    try:
                        line = await asyncio.wait_for(
                            stream.readline(),
                            timeout=1.0,  # Check periodically
                        )
                    except asyncio.TimeoutError:
                        # Check if process is done
                        if process.returncode is not None:
                            break
                        continue

                    if not line:
                        break

                    total_bytes += len(line)
                    if total_bytes > self.max_output_size:
                        yield {
                            "stream": name,
                            "chunk": f"\n... output truncated (>{self.max_output_size} bytes)\n",
                        }
                        break

                    try:
                        decoded = line.decode("utf-8", errors="replace")
                    except Exception:
                        decoded = line.decode("latin-1", errors="replace")

                    yield {"stream": name, "chunk": decoded}

            # Create tasks for reading both streams
            stdout_task = asyncio.create_task(
                self._collect_stream(read_stream(process.stdout, "stdout"))
            )
            stderr_task = asyncio.create_task(
                self._collect_stream(read_stream(process.stderr, "stderr"))
            )

            # Wait for process with timeout
            try:
                await asyncio.wait_for(process.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                yield {
                    "stream": "stderr",
                    "chunk": f"\nCommand timed out after {timeout} seconds\n",
                }

            # Yield all collected output
            for chunk in await stdout_task:
                yield chunk
            for chunk in await stderr_task:
                yield chunk

            elapsed_ms = int((time.time() - start_time) * 1000)
            yield {
                "complete": True,
                "exit_code": process.returncode or 0,
                "duration_ms": elapsed_ms,
            }

        except Exception as e:
            elapsed_ms = int((time.time() - start_time) * 1000)
            yield {"stream": "stderr", "chunk": str(e)}
            yield {
                "complete": True,
                "exit_code": 1,
                "duration_ms": elapsed_ms,
            }

    async def _collect_stream(
        self,
        stream_iter: AsyncIterator[dict],
    ) -> list[dict]:
        """Collect all chunks from a stream iterator."""
        chunks = []
        async for chunk in stream_iter:
            chunks.append(chunk)
        return chunks

    def _prepare_env(
        self,
        custom_env: dict[str, str] | None = None,
    ) -> dict[str, str]:
        """
        Prepare environment variables for subprocess.

        Inherits safe environment variables and adds custom ones.
        Never exposes secrets.
        """
        # Start with safe subset of current environment
        safe_vars = [
            "PATH",
            "HOME",
            "USER",
            "LANG",
            "LC_ALL",
            "TERM",
            "SHELL",
            "TMPDIR",
            "TMP",
            "TEMP",
        ]

        env = {}
        for var in safe_vars:
            if var in os.environ:
                env[var] = os.environ[var]

        # Add custom environment variables
        if custom_env:
            env.update(custom_env)

        return env

    def _decode_and_truncate(
        self,
        data: bytes,
    ) -> tuple[str, bool]:
        """
        Decode bytes and truncate if too large.

        Returns:
            Tuple of (decoded string, was_truncated)
        """
        truncated = False

        if len(data) > self.max_output_size:
            data = data[: self.max_output_size]
            truncated = True

        try:
            result = data.decode("utf-8", errors="replace")
        except Exception:
            result = data.decode("latin-1", errors="replace")

        if truncated:
            result += f"\n... output truncated (>{self.max_output_size} bytes)"

        return result, truncated
