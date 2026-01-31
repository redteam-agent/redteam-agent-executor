"""
Command filtering and validation for security.

This module validates all commands before execution to prevent
dangerous operations while allowing legitimate security testing.
"""

import re
import shlex
from dataclasses import dataclass
from enum import Enum

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
        # For stdlib logging, format kwargs into the message
        extra_info = " ".join(f"{k}={v}" for k, v in kwargs.items())
        msg = f"{event} {extra_info}".strip()
        getattr(logger, level)(msg)


class ValidationResult(Enum):
    """Result of command validation."""

    ALLOWED = "allowed"
    BLOCKED = "blocked"
    MODIFIED = "modified"


@dataclass
class CommandValidation:
    """Result of validating a command."""

    result: ValidationResult
    command: str  # Original or modified command
    reason: str | None = None


class CommandFilter:
    """
    Filters commands to prevent dangerous operations.

    All commands from the LLM pass through this filter before execution.
    """

    # Allowed command patterns for security testing
    ALLOWED_PATTERNS = [
        # HTTP tools
        r"^curl\s+",
        r"^wget\s+",
        r"^httpie\s+",
        r"^http\s+",

        # Security scanners
        r"^sqlmap\s+",
        r"^nmap\s+",
        r"^nikto\s+",
        r"^nuclei\s+",
        r"^ffuf\s+",
        r"^gobuster\s+",
        r"^dirb\s+",
        r"^wfuzz\s+",
        r"^hydra\s+",

        # Scripting
        r"^python\s+(-c\s+)?",
        r"^python3\s+(-c\s+)?",
        r"^ruby\s+(-e\s+)?",
        r"^node\s+(-e\s+)?",
        r"^perl\s+(-e\s+)?",

        # Utility
        r"^echo\s+",
        r"^cat\s+",
        r"^grep\s+",
        r"^awk\s+",
        r"^sed\s+",
        r"^jq\s+",
        r"^base64\s+",
        r"^openssl\s+",

        # Network
        r"^nc\s+",
        r"^netcat\s+",
        r"^telnet\s+",
    ]

    # Dangerous patterns to block
    BLOCKED_PATTERNS = [
        # File system destruction
        r"rm\s+(-rf?|--recursive)\s+/",
        r"rm\s+-rf?\s+\*",
        r"rmdir\s+/",
        r"mkfs\.",
        r"dd\s+if=.+of=/dev/",

        # Fork bomb
        r":\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;",
        r"\.{2,}\s*&",

        # Privilege escalation
        r"\bsudo\b",
        r"\bsu\b\s+-",
        r"\bchmod\s+[0-7]*777",
        r"\bchown\s+root",

        # System modification
        r"/etc/passwd",
        r"/etc/shadow",
        r"/etc/sudoers",
        r"crontab\s+-e",
        r"systemctl\s+(stop|disable|mask)",

        # Network attacks on non-targets
        r"nmap\s+(-sS|-sU|-sT).*\s+\d+\.\d+\.\d+\.\d+/\d+",  # Subnet scans
        r"masscan\s+",  # Mass scanning

        # Crypto mining
        r"xmrig",
        r"minerd",
        r"cpuminer",

        # Reverse shells (generic)
        r"/dev/tcp/",
        r"mkfifo.*/tmp/",
        r"bash\s+-i\s+>&\s+/dev/",

        # Downloading and executing unknown scripts
        r"curl.+\|\s*sh",
        r"wget.+-O\s*-\s*\|\s*sh",
        r"curl.+\|\s*bash",
        r"wget.+-O\s*-\s*\|\s*bash",
    ]

    # Patterns that require the target URL to be in the command
    REQUIRES_TARGET_URL = [
        r"^curl\s+",
        r"^wget\s+",
        r"^sqlmap\s+",
        r"^nikto\s+",
        r"^nuclei\s+",
    ]

    def __init__(self, allowed_domains: list[str] | None = None):
        """
        Initialize the command filter.

        Args:
            allowed_domains: List of allowed target domains, or None for any.
        """
        self.allowed_domains = allowed_domains
        self.allowed_patterns = [re.compile(p, re.IGNORECASE) for p in self.ALLOWED_PATTERNS]
        self.blocked_patterns = [re.compile(p, re.IGNORECASE) for p in self.BLOCKED_PATTERNS]
        self.target_required = [re.compile(p, re.IGNORECASE) for p in self.REQUIRES_TARGET_URL]

    def validate(
        self,
        command: str,
        target_url: str | None = None,
    ) -> CommandValidation:
        """
        Validate a command for safe execution.

        Args:
            command: The command to validate
            target_url: The expected target URL (for domain validation)

        Returns:
            CommandValidation with result and reason
        """
        command = command.strip()

        # Log all validation attempts for audit trail
        _log(
            "info",
            "command_validation_attempt",
            command=command[:100],  # Truncate for logging
            target_url=target_url,
        )

        # Check for blocked patterns first
        for pattern in self.blocked_patterns:
            if pattern.search(command):
                validation = CommandValidation(
                    result=ValidationResult.BLOCKED,
                    command=command,
                    reason=f"Blocked pattern detected: {pattern.pattern}",
                )
                _log(
                    "warning",
                    "command_blocked",
                    command=command[:100],
                    reason=validation.reason,
                    pattern=pattern.pattern,
                )
                return validation

        # Check if command matches allowed patterns
        allowed = False
        for pattern in self.allowed_patterns:
            if pattern.match(command):
                allowed = True
                break

        if not allowed:
            validation = CommandValidation(
                result=ValidationResult.BLOCKED,
                command=command,
                reason="Command does not match any allowed pattern",
            )
            _log(
                "warning",
                "command_blocked",
                command=command[:100],
                reason=validation.reason,
            )
            return validation

        # Validate target URL if required
        if target_url and self.allowed_domains:
            for pattern in self.target_required:
                if pattern.match(command):
                    if not self._validate_target_domain(command, target_url):
                        validation = CommandValidation(
                            result=ValidationResult.BLOCKED,
                            command=command,
                            reason="Command targets a domain not in the allowed list",
                        )
                        _log(
                            "warning",
                            "command_blocked",
                            command=command[:100],
                            reason=validation.reason,
                            target_url=target_url,
                            allowed_domains=str(self.allowed_domains),
                        )
                        return validation
                    break

        _log(
            "info",
            "command_allowed",
            command=command[:100],
        )
        return CommandValidation(
            result=ValidationResult.ALLOWED,
            command=command,
        )

    def _validate_target_domain(
        self,
        command: str,
        expected_target: str,
    ) -> bool:
        """Check that the command targets the expected domain."""
        if self.allowed_domains is None or "*" in self.allowed_domains:
            return True

        # Extract URLs from command
        url_pattern = re.compile(r'https?://([^/\s"\']+)')
        matches = url_pattern.findall(command)

        for domain in matches:
            # Remove port if present
            domain = domain.split(":")[0]

            # Check against allowed domains
            allowed = False
            for allowed_domain in self.allowed_domains:
                if domain == allowed_domain or domain.endswith(f".{allowed_domain}"):
                    allowed = True
                    break

            if not allowed:
                return False

        return True

    def sanitize(self, command: str) -> str:
        """
        Sanitize a command by removing potentially dangerous elements.

        This is a best-effort sanitization and should not be relied upon
        for security - use validate() to block dangerous commands.
        """
        # Remove command chaining that could be abused
        # But allow pipes which are legitimate
        command = re.sub(r";\s*rm\s+", "; echo blocked ", command)
        command = re.sub(r"&&\s*rm\s+", "&& echo blocked ", command)

        return command.strip()

    def get_allowed_commands(self) -> list[str]:
        """Return a list of allowed command prefixes for documentation."""
        return [
            "curl - HTTP requests",
            "wget - HTTP downloads",
            "sqlmap - SQL injection testing",
            "nmap - Port scanning",
            "nikto - Web server scanning",
            "nuclei - Vulnerability scanning",
            "python - Python scripts",
            "ffuf - Web fuzzing",
            "gobuster - Directory brute forcing",
        ]
