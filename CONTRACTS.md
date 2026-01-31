# Integration Contracts

This document defines the API contracts that `redteam-agent-executor` exposes to the core library.

## API Endpoints

### POST /execute
Execute a command and return the result.

**Request:**
```json
{
    "session_id": "uuid",
    "run_id": "uuid",
    "command": "curl -X POST https://app.example.com/login -d 'user=test'",
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

**Response (Success):**
```json
{
    "execution_id": "uuid",
    "exit_code": 0,
    "stdout": "HTTP/1.1 200 OK\nContent-Type: application/json\n\n{\"status\": \"success\"}",
    "stderr": "",
    "duration_ms": 1250,
    "truncated": false
}
```

**Response (Timeout):**
```json
{
    "execution_id": "uuid",
    "exit_code": 28,
    "stdout": "",
    "stderr": "Request timed out after 30 seconds",
    "duration_ms": 30000,
    "truncated": false
}
```

**Response (Blocked):**
```json
{
    "error": {
        "code": "COMMAND_BLOCKED",
        "message": "Command blocked by security filter",
        "details": {
            "reason": "Blocked pattern detected: rm -rf"
        }
    }
}
```

### POST /execute/stream
Execute with streaming output (Server-Sent Events).

**Request:** Same as `/execute`

**Response:** SSE stream
```
event: output
data: {"stream": "stdout", "chunk": "HTTP/1.1 200 OK\n", "timestamp": "2024-01-15T10:00:00Z"}

event: output
data: {"stream": "stdout", "chunk": "Content-Type: application/json\n", "timestamp": "2024-01-15T10:00:00Z"}

event: output
data: {"stream": "stdout", "chunk": "\n{\"status\": \"success\"}", "timestamp": "2024-01-15T10:00:01Z"}

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

---

## Executor Types

### http
For HTTP/HTTPS requests. Parses curl commands and executes them.

**Supported curl flags:**
- `-X, --request METHOD` - HTTP method
- `-H, --header "Name: Value"` - Headers
- `-d, --data "body"` - Request body
- `-b, --cookie "cookie"` - Cookies
- `-A, --user-agent "agent"` - User agent
- `--json "body"` - JSON body

**Example commands:**
```bash
# Simple GET
curl https://app.example.com/api/users

# POST with JSON
curl -X POST https://app.example.com/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "test"}'

# SQL injection test
curl -X POST https://app.example.com/api/login \
  -d "username=admin' OR '1'='1&password=test"
```

### shell
For running security tools locally.

**Allowed commands:**
- `sqlmap` - SQL injection testing
- `nmap` - Port scanning
- `nikto` - Web server scanning
- `nuclei` - Vulnerability scanning
- `ffuf` - Web fuzzing
- `gobuster` - Directory brute forcing
- `python` - Python scripts

**Example commands:**
```bash
# SQL injection with sqlmap
sqlmap -u "https://app.example.com/api/users?id=1" --batch --level=3

# Port scan
nmap -sV -p 80,443,8080 app.example.com

# Web server scan
nikto -h https://app.example.com
```

### cloudrun
For executing commands inside GCP Cloud Run containers.

Uses Cloud Run Jobs API.

---

## Security

### Command Filtering

All commands pass through security validation:

1. **Allow List Check** - Command must match an allowed pattern
2. **Block List Check** - Command must not contain dangerous patterns
3. **Domain Validation** - HTTP commands must target allowed domains

### Blocked Patterns

| Pattern | Reason |
|---------|--------|
| `rm -rf /` | Filesystem destruction |
| `sudo`, `su -` | Privilege escalation |
| `:(){ :|:& };:` | Fork bomb |
| `/etc/passwd`, `/etc/shadow` | System file access |
| `curl ... \| sh` | Remote code execution |
| `xmrig`, `minerd` | Crypto mining |

### Rate Limiting

- 100 commands per minute per session
- Maximum 10 concurrent executions
- Maximum 300 second timeout per command

---

## Authentication

Internal service authentication via API key:

```
X-Internal-API-Key: <key>
```

This is for service-to-service communication. The executor should not be exposed publicly.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `COMMAND_BLOCKED` | 400 | Command blocked by security filter |
| `INVALID_EXECUTOR` | 400 | Unknown executor type |
| `TIMEOUT` | 408 | Command timed out |
| `RATE_LIMITED` | 429 | Too many requests |
| `EXECUTION_ERROR` | 500 | Command execution failed |
