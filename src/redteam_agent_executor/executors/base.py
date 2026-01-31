"""Base executor interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator


@dataclass
class ExecutionResult:
    """Result of a command execution."""

    exit_code: int
    stdout: str
    stderr: str
    duration_ms: int
    truncated: bool = False


class BaseExecutor(ABC):
    """
    Abstract base class for command executors.

    All executor implementations must implement:
    - execute(): Run command and return result
    - stream_execute(): Run command with streaming output
    """

    @abstractmethod
    async def execute(
        self,
        command: str,
        timeout: int | None = None,
    ) -> ExecutionResult:
        """
        Execute a command and return the result.

        Args:
            command: The command to execute
            timeout: Optional timeout in seconds

        Returns:
            ExecutionResult with output and exit code
        """
        pass

    @abstractmethod
    async def stream_execute(
        self,
        command: str,
        timeout: int | None = None,
    ) -> AsyncIterator[dict]:
        """
        Execute a command with streaming output.

        Args:
            command: The command to execute
            timeout: Optional timeout in seconds

        Yields:
            Dict with either:
            - {"stream": "stdout"|"stderr", "chunk": str}
            - {"complete": True, "exit_code": int}
        """
        pass
