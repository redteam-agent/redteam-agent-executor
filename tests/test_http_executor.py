"""Tests for HTTP executor."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from redteam_agent_executor.executors.http_executor import HTTPExecutor
from redteam_agent_executor.executors.base import ExecutionResult


class TestCurlParsing:
    """Test curl command parsing."""

    @pytest.fixture
    def executor(self):
        return HTTPExecutor()

    def test_parse_simple_get(self, executor):
        """Test parsing simple GET request."""
        result = executor._parse_curl_command("curl https://example.com/api")
        assert result["method"] == "GET"
        assert result["url"] == "https://example.com/api"
        assert result["body"] is None

    def test_parse_post_with_data(self, executor):
        """Test parsing POST with data automatically sets method."""
        result = executor._parse_curl_command(
            "curl -d 'username=test' https://example.com/login"
        )
        assert result["method"] == "POST"
        assert result["url"] == "https://example.com/login"
        assert result["body"] == "username=test"

    def test_parse_explicit_method(self, executor):
        """Test parsing explicit HTTP method."""
        result = executor._parse_curl_command(
            "curl -X PUT https://example.com/resource"
        )
        assert result["method"] == "PUT"

    def test_parse_headers(self, executor):
        """Test parsing headers."""
        result = executor._parse_curl_command(
            "curl -H 'Authorization: Bearer token123' -H 'Content-Type: application/json' https://example.com"
        )
        assert result["headers"]["Authorization"] == "Bearer token123"
        assert result["headers"]["Content-Type"] == "application/json"

    def test_parse_json_data(self, executor):
        """Test parsing --json flag."""
        result = executor._parse_curl_command(
            'curl --json \'{"key": "value"}\' https://example.com/api'
        )
        assert result["method"] == "POST"
        assert result["headers"]["Content-Type"] == "application/json"
        assert result["body"] == '{"key": "value"}'

    def test_parse_cookie(self, executor):
        """Test parsing cookie."""
        result = executor._parse_curl_command(
            "curl -b 'session=abc123' https://example.com"
        )
        assert result["headers"]["Cookie"] == "session=abc123"

    def test_parse_user_agent(self, executor):
        """Test parsing user agent."""
        result = executor._parse_curl_command(
            "curl -A 'CustomAgent/1.0' https://example.com"
        )
        assert result["headers"]["User-Agent"] == "CustomAgent/1.0"

    def test_parse_url_without_curl_prefix(self, executor):
        """Test parsing raw URL."""
        result = executor._parse_curl_command("https://example.com/api")
        assert result["method"] == "GET"
        assert result["url"] == "https://example.com/api"

    def test_parse_invalid_command_raises(self, executor):
        """Test that invalid command raises ValueError."""
        with pytest.raises(ValueError, match="Cannot parse command"):
            executor._parse_curl_command("invalid command")

    def test_parse_no_url_raises(self, executor):
        """Test that command without URL raises ValueError."""
        with pytest.raises(ValueError, match="No URL found"):
            executor._parse_curl_command("curl -H 'Header: value'")


class TestHTTPExecutor:
    """Test HTTP executor functionality."""

    @pytest.fixture
    def executor(self):
        return HTTPExecutor(timeout=30)

    @pytest.mark.asyncio
    async def test_execute_success(self, executor):
        """Test successful HTTP execution."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.reason_phrase = "OK"
        mock_response.http_version = "1.1"
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.text = '{"status": "success"}'
        mock_response.content = b'{"status": "success"}'

        with patch.object(
            executor.client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response

            result = await executor.execute("curl https://example.com/api")

            assert result.exit_code == 0
            assert "200 OK" in result.stdout
            assert '{"status": "success"}' in result.stdout
            assert result.stderr == ""

    @pytest.mark.asyncio
    async def test_execute_timeout(self, executor):
        """Test timeout handling."""
        import httpx

        with patch.object(
            executor.client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.TimeoutException("Timeout")

            result = await executor.execute("curl https://example.com/slow", timeout=5)

            assert result.exit_code == 28  # curl timeout exit code
            assert "timed out" in result.stderr.lower()

    @pytest.mark.asyncio
    async def test_execute_connection_error(self, executor):
        """Test connection error handling."""
        with patch.object(
            executor.client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = Exception("Connection refused")

            result = await executor.execute("curl https://unreachable.example.com")

            assert result.exit_code == 1
            assert "Connection refused" in result.stderr

    @pytest.mark.asyncio
    async def test_stream_execute(self, executor):
        """Test streaming execution."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.reason_phrase = "OK"
        mock_response.http_version = "1.1"
        mock_response.headers = {}
        mock_response.text = "response body"
        mock_response.content = b"response body"

        with patch.object(
            executor.client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response

            chunks = []
            async for chunk in executor.stream_execute("curl https://example.com"):
                chunks.append(chunk)

            # Should have stdout chunk and complete event
            assert any("stdout" in c.get("stream", "") for c in chunks)
            assert any(c.get("complete") for c in chunks)


class TestResponseFormatting:
    """Test response formatting."""

    @pytest.fixture
    def executor(self):
        return HTTPExecutor()

    def test_format_response_with_headers(self, executor):
        """Test response formatting includes headers."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.reason_phrase = "OK"
        mock_response.http_version = "1.1"
        mock_response.headers = {
            "Content-Type": "application/json",
            "Content-Length": "42",
        }
        mock_response.text = '{"data": "value"}'

        result = executor._format_response(mock_response, {"method": "GET"})

        assert "HTTP/1.1 200 OK" in result
        assert "Content-Type: application/json" in result
        assert '{"data": "value"}' in result

    def test_format_response_truncates_large_body(self, executor):
        """Test that large response bodies are truncated."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.reason_phrase = "OK"
        mock_response.http_version = "1.1"
        mock_response.headers = {}
        mock_response.text = "x" * 60000  # Larger than 50000 limit

        result = executor._format_response(mock_response, {"method": "GET"})

        assert "... (truncated)" in result
        assert len(result) < 60000

    def test_format_binary_response(self, executor):
        """Test binary response handling."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.reason_phrase = "OK"
        mock_response.http_version = "1.1"
        mock_response.headers = {}
        mock_response.text = property(lambda s: (_ for _ in ()).throw(Exception("binary")))
        mock_response.content = b"\x00\x01\x02\x03" * 100

        # Make text property raise an exception
        type(mock_response).text = property(
            lambda self: (_ for _ in ()).throw(Exception("Cannot decode"))
        )

        result = executor._format_response(mock_response, {"method": "GET"})

        assert "binary body" in result
        assert "400 bytes" in result
