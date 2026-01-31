# RedTeam Agent Executor

Isolated command execution service for running security testing commands against GCP Cloud Run containers. This service is separated from the main API for security and scalability.

## Overview

The executor service:
- Receives command execution requests from the core library
- Executes HTTP requests against target applications
- Executes shell commands for security tools (sqlmap, nmap, etc.)
- Streams output back to the caller
- Implements command filtering for safety

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    redteam-agent-executor                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   FastAPI Application                    │    │
│  │  POST /execute          - Execute and return result      │    │
│  │  POST /execute/stream   - Execute with SSE streaming     │    │
│  │  GET  /health           - Health check                   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                    Command Sandbox                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │   Command    │  │   Allow      │  │    Rate        │   │  │
│  │  │   Validator  │  │   List       │  │    Limiter     │   │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                      Executors                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │    HTTP      │  │    Shell     │  │   Cloud Run    │   │  │
│  │  │  Executor    │  │   Executor   │  │   Executor     │   │  │
│  │  └──────────────┘  └──────────────┘  └────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐  │
│  │                   Output Streaming                         │  │
│  │  - Real-time stdout/stderr capture                         │  │
│  │  - ANSI color support                                      │  │
│  │  - Size limits and truncation                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Install dependencies
poetry install

# Run the server
poetry run uvicorn redteam_agent_executor.main:app --port 8001
```

## API Endpoints

### POST /execute
Execute a command and return the result.

**Request:**
```json
{
    "session_id": "uuid",
    "run_id": "uuid",
    "command": "curl -X POST https://app.example.com/login -d 'test'",
    "executor_type": "http",
    "target": {
        "url": "https://app.example.com",
        "gcp_project_id": "my-project",
        "gcp_region": "us-central1",
        "gcp_service_name": "my-app"
    },
    "timeout": 30
}
```

**Response:**
```json
{
    "execution_id": "uuid",
    "exit_code": 0,
    "stdout": "HTTP/1.1 200 OK\n...",
    "stderr": "",
    "duration_ms": 1250,
    "truncated": false
}
```

### POST /execute/stream
Execute with streaming output (Server-Sent Events).

**Request:** Same as `/execute`

**Response:** SSE stream
```
event: output
data: {"stream": "stdout", "chunk": "HTTP/1.1 200 OK\n"}

event: output
data: {"stream": "stdout", "chunk": "{\"status\": \"success\"}"}

event: complete
data: {"exit_code": 0, "duration_ms": 1250}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
    "status": "healthy",
    "version": "0.1.0"
}
```

## Executor Types

### HTTP Executor
For web application testing. Executes HTTP requests and captures responses.

Supports:
- All HTTP methods (GET, POST, PUT, DELETE, etc.)
- Custom headers
- Request bodies (JSON, form, multipart)
- Cookie handling
- Redirect following
- Response capture (headers, body, timing)

### Shell Executor
For running security tools locally.

Allowed tools:
- `curl` - HTTP requests
- `wget` - HTTP downloads
- `sqlmap` - SQL injection testing
- `nmap` - Port scanning
- `nikto` - Web server scanning
- `python` - Python scripts
- `nuclei` - Vulnerability scanning

### Cloud Run Executor
For executing commands inside GCP Cloud Run containers.

Uses GCP Cloud Run Jobs API or `gcloud run services proxy`.

## Security

### Command Filtering
All commands pass through a security filter that:

1. **Validates against allow list** - Only permitted command patterns
2. **Blocks dangerous operations**:
   - `rm -rf /` and variants
   - Fork bombs
   - Crypto mining
   - Network attacks against non-target hosts
   - Privilege escalation
3. **Rate limits** - Per session limits
4. **Audit logging** - All commands logged

### Network Isolation
The executor runs in an isolated network that can only reach:
- Target application URLs (from the request)
- Required security tool endpoints

## Configuration

Environment variables:

```bash
# Server
PORT=8001
HOST=0.0.0.0

# Security
INTERNAL_API_KEY=...          # For service-to-service auth
ALLOWED_TARGET_DOMAINS=*      # Comma-separated, or * for all
MAX_COMMAND_TIMEOUT=300       # Maximum timeout in seconds
MAX_OUTPUT_SIZE_MB=10         # Maximum output size

# GCP (for Cloud Run executor)
GCP_PROJECT_ID=...
GCP_CREDENTIALS_JSON=...
```

## Directory Structure

```
src/redteam_agent_executor/
├── __init__.py
├── main.py                    # FastAPI app
├── config.py                  # Settings
├── api/
│   ├── __init__.py
│   └── routes.py              # API endpoints
├── executors/
│   ├── __init__.py
│   ├── base.py                # Base executor interface
│   ├── http_executor.py       # HTTP request executor
│   ├── shell_executor.py      # Shell command executor
│   └── cloudrun_executor.py   # GCP Cloud Run executor
├── sandbox/
│   ├── __init__.py
│   └── command_filter.py      # Command validation/filtering
└── streaming/
    ├── __init__.py
    └── output_handler.py      # Output streaming
```

## Development

```bash
# Install dependencies
poetry install

# Run development server
poetry run uvicorn redteam_agent_executor.main:app --reload --port 8001

# Run tests
poetry run pytest

# Type checking
poetry run mypy src/
```

## Docker

```dockerfile
FROM python:3.11-slim

# Install security tools
RUN apt-get update && apt-get install -y \
    curl wget nmap nikto sqlmap \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .
RUN pip install poetry && poetry install --no-dev

EXPOSE 8001
CMD ["poetry", "run", "uvicorn", "redteam_agent_executor.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

## License

MIT
