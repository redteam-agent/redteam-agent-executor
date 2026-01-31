"""Tests for API routes."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from redteam_agent_executor.api.routes import (
    ExecuteRequest,
    ExecuteResponse,
    TargetInfo,
    get_executor,
    get_command_filter,
    validate_api_key,
)
from redteam_agent_executor.executors.http_executor import HTTPExecutor
from redteam_agent_executor.executors.shell_executor import ShellExecutor


class TestModels:
    """Test request/response models."""

    def test_execute_request_defaults(self):
        """Test ExecuteRequest default values."""
        request = ExecuteRequest(
            session_id="test-session",
            run_id="test-run",
            command="echo hello",
            target=TargetInfo(url="https://example.com"),
        )

        assert request.executor_type == "shell"
        assert request.timeout == 30

    def test_target_info_minimal(self):
        """Test TargetInfo with minimal fields."""
        target = TargetInfo(url="https://example.com")

        assert target.url == "https://example.com"
        assert target.gcp_project_id is None

    def test_execute_response(self):
        """Test ExecuteResponse model."""
        response = ExecuteResponse(
            execution_id="exec-123",
            exit_code=0,
            stdout="output",
            stderr="",
            duration_ms=100,
            truncated=False,
        )

        assert response.execution_id == "exec-123"
        assert response.exit_code == 0


class TestExecutorFactory:
    """Test executor factory."""

    def test_get_http_executor(self):
        """Test getting HTTP executor."""
        executor = get_executor("http", timeout=60)

        assert isinstance(executor, HTTPExecutor)

    def test_get_shell_executor(self):
        """Test getting shell executor."""
        executor = get_executor("shell", timeout=60)

        assert isinstance(executor, ShellExecutor)

    def test_get_unknown_executor_raises(self):
        """Test that unknown executor type raises."""
        with pytest.raises(ValueError, match="Unknown executor"):
            get_executor("unknown")

    def test_get_cloudrun_executor_not_implemented(self):
        """Test that cloudrun executor raises HTTPException."""
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            get_executor("cloudrun")

        assert exc_info.value.status_code == 501


class TestCommandFilter:
    """Test command filter configuration."""

    def test_get_command_filter_wildcard(self):
        """Test command filter with wildcard domains."""
        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.ALLOWED_TARGET_DOMAINS = "*"

            filter = get_command_filter()

            assert filter.allowed_domains is None

    def test_get_command_filter_specific_domains(self):
        """Test command filter with specific domains."""
        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.ALLOWED_TARGET_DOMAINS = "example.com, test.com"

            filter = get_command_filter()

            assert filter.allowed_domains == ["example.com", "test.com"]


class TestAPIKeyValidation:
    """Test API key validation."""

    def test_valid_api_key(self):
        """Test valid API key passes."""
        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.INTERNAL_API_KEY = "valid-key"

            # Should not raise
            validate_api_key("valid-key")

    def test_invalid_api_key_raises(self):
        """Test invalid API key raises HTTPException."""
        from fastapi import HTTPException

        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.INTERNAL_API_KEY = "valid-key"

            with pytest.raises(HTTPException) as exc_info:
                validate_api_key("invalid-key")

            assert exc_info.value.status_code == 401


class TestExecuteEndpoint:
    """Test /execute endpoint logic."""

    @pytest.mark.asyncio
    async def test_blocked_command_returns_400(self):
        """Test that blocked commands return 400."""
        from fastapi import HTTPException
        from redteam_agent_executor.api.routes import execute

        request = ExecuteRequest(
            session_id="test-session",
            run_id="test-run",
            command="rm -rf /",  # Blocked command
            target=TargetInfo(url="https://example.com"),
        )

        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.ALLOWED_TARGET_DOMAINS = "*"

            with pytest.raises(HTTPException) as exc_info:
                await execute(request, x_internal_api_key="test-key")

            assert exc_info.value.status_code == 400
            assert "COMMAND_BLOCKED" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_invalid_api_key_returns_401(self):
        """Test that invalid API key returns 401."""
        from fastapi import HTTPException
        from redteam_agent_executor.api.routes import execute

        request = ExecuteRequest(
            session_id="test-session",
            run_id="test-run",
            command="echo hello",
            target=TargetInfo(url="https://example.com"),
        )

        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.INTERNAL_API_KEY = "valid-key"

            with pytest.raises(HTTPException) as exc_info:
                await execute(request, x_internal_api_key="invalid-key")

            assert exc_info.value.status_code == 401


class TestIntegration:
    """Integration tests using TestClient."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from fastapi.testclient import TestClient
        from redteam_agent_executor.main import app

        return TestClient(app)

    def test_health_endpoint(self, client):
        """Test health endpoint."""
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_execute_requires_api_key(self, client):
        """Test that execute requires API key."""
        with patch(
            "redteam_agent_executor.api.routes.settings"
        ) as mock_settings:
            mock_settings.INTERNAL_API_KEY = "test-key"
            mock_settings.ALLOWED_TARGET_DOMAINS = "*"

            response = client.post(
                "/execute",
                json={
                    "session_id": "test",
                    "run_id": "test",
                    "command": "echo hello",
                    "target": {"url": "https://example.com"},
                },
                # No API key header
            )

            # Should fail with 422 (missing header) or 401 (invalid)
            assert response.status_code in [401, 422]
