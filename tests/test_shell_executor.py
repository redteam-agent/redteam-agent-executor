"""Tests for shell command executor."""

import asyncio
import pytest

from redteam_agent_executor.executors.shell_executor import ShellExecutor


class TestShellExecutor:
    """Test shell executor functionality."""

    @pytest.fixture
    def executor(self):
        return ShellExecutor(timeout=30)

    @pytest.mark.asyncio
    async def test_execute_simple_command(self, executor):
        """Test executing a simple echo command."""
        result = await executor.execute("echo 'hello world'")

        assert result.exit_code == 0
        assert "hello world" in result.stdout
        assert result.stderr == ""
        assert result.duration_ms > 0

    @pytest.mark.asyncio
    async def test_execute_with_exit_code(self, executor):
        """Test that exit codes are captured."""
        result = await executor.execute("exit 42")

        assert result.exit_code == 42

    @pytest.mark.asyncio
    async def test_execute_stderr(self, executor):
        """Test capturing stderr output."""
        result = await executor.execute("echo 'error' >&2")

        assert "error" in result.stderr

    @pytest.mark.asyncio
    async def test_execute_timeout(self):
        """Test timeout handling."""
        executor = ShellExecutor(timeout=1)

        result = await executor.execute("sleep 10")

        assert result.exit_code == -1
        assert "timed out" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_execute_with_env(self, executor):
        """Test custom environment variables."""
        result = await executor.execute(
            "echo $TEST_VAR",
            env={"TEST_VAR": "custom_value"},
        )

        assert result.exit_code == 0
        assert "custom_value" in result.stdout

    @pytest.mark.asyncio
    async def test_execute_inherits_path(self, executor):
        """Test that PATH is inherited."""
        result = await executor.execute("which echo")

        assert result.exit_code == 0
        assert "/echo" in result.stdout

    @pytest.mark.asyncio
    async def test_stream_execute(self, executor):
        """Test streaming execution."""
        chunks = []
        async for chunk in executor.stream_execute("echo 'line1'; echo 'line2'"):
            chunks.append(chunk)

        # Should have output chunks and complete event
        stdout_chunks = [c for c in chunks if c.get("stream") == "stdout"]
        complete = [c for c in chunks if c.get("complete")]

        assert len(stdout_chunks) >= 1
        assert len(complete) == 1
        assert complete[0]["exit_code"] == 0

    @pytest.mark.asyncio
    async def test_stream_execute_timeout(self):
        """Test streaming with timeout."""
        executor = ShellExecutor(timeout=1)

        chunks = []
        async for chunk in executor.stream_execute("sleep 10"):
            chunks.append(chunk)

        # Should have timeout message and complete event
        stderr_chunks = [c for c in chunks if c.get("stream") == "stderr"]
        complete = [c for c in chunks if c.get("complete")]

        assert any("timed out" in c.get("chunk", "").lower() for c in stderr_chunks)
        assert len(complete) == 1


class TestOutputTruncation:
    """Test output size limiting."""

    @pytest.mark.asyncio
    async def test_large_output_truncated(self):
        """Test that large output is truncated."""
        executor = ShellExecutor(max_output_size=100)

        # Generate output larger than limit
        result = await executor.execute("python3 -c \"print('x' * 1000)\"")

        assert result.truncated is True
        assert "truncated" in result.stdout.lower()

    @pytest.mark.asyncio
    async def test_normal_output_not_truncated(self):
        """Test that normal output is not truncated."""
        executor = ShellExecutor()

        result = await executor.execute("echo 'short output'")

        assert result.truncated is False


class TestEnvironmentSafety:
    """Test environment variable safety."""

    def test_prepare_env_includes_path(self):
        """Test that PATH is included in environment."""
        executor = ShellExecutor()
        env = executor._prepare_env()

        assert "PATH" in env

    def test_prepare_env_merges_custom(self):
        """Test that custom env vars are merged."""
        executor = ShellExecutor()
        env = executor._prepare_env({"CUSTOM_VAR": "value"})

        assert "CUSTOM_VAR" in env
        assert env["CUSTOM_VAR"] == "value"

    def test_prepare_env_excludes_secrets(self):
        """Test that secrets are not inherited."""
        import os

        # Set a fake secret in environment
        os.environ["AWS_SECRET_ACCESS_KEY"] = "fake_secret"

        executor = ShellExecutor()
        env = executor._prepare_env()

        assert "AWS_SECRET_ACCESS_KEY" not in env


class TestDecoding:
    """Test output decoding."""

    def test_decode_utf8(self):
        """Test UTF-8 decoding."""
        executor = ShellExecutor()
        result, truncated = executor._decode_and_truncate(b"hello world")

        assert result == "hello world"
        assert truncated is False

    def test_decode_with_unicode(self):
        """Test decoding with unicode characters."""
        executor = ShellExecutor()
        result, truncated = executor._decode_and_truncate("héllo wörld".encode("utf-8"))

        assert "héllo wörld" in result
        assert truncated is False

    def test_decode_binary_fallback(self):
        """Test fallback for binary data."""
        executor = ShellExecutor()
        # Invalid UTF-8 sequence
        result, truncated = executor._decode_and_truncate(b"\xff\xfe")

        # Should not raise, should return something
        assert isinstance(result, str)
