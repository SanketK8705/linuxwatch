#!/usr/bin/env python3
"""
LinuxWatch Agent
================
Tails log files in real time, parses them into structured events,
and ships them to the LinuxWatch backend via POST /api/events.

Supported log sources:
  - /var/log/auth.log     → SSH_FAILED_LOGIN, SUDO_FAILURE
  - /var/log/syslog       → MALWARE_DETECTED (basic heuristics)
  - /var/log/nginx/access.log → HTTP_FLOOD, SQL_INJECTION

Usage:
  JWT_TOKEN=<token> python3 agent.py
  JWT_TOKEN=<token> BACKEND=http://192.168.1.10:3001 python3 agent.py

  Or copy config.env.example → config.env, fill it in, then:
  python3 agent.py --config config.env
"""

import os
import re
import sys
import time
import json
import signal
import logging
import argparse
import threading
import urllib.request
import urllib.error
from pathlib import Path
from collections import defaultdict

# ── Config ─────────────────────────────────────────────────────────────────

DEFAULT_BACKEND  = "http://localhost:3001"
DEFAULT_LOG_PATHS = [
    "/var/log/auth.log",
    "/var/log/syslog",
    "/var/log/nginx/access.log",
]
RETRY_DELAY      = 5    # seconds between retries on failed POST
TAIL_POLL_INTERVAL = 0.2  # seconds between file polls
RECONNECT_DELAY  = 3    # seconds before re-opening a rotated file

# ── Logging setup ───────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("linuxwatch-agent")

# ── Regex patterns ──────────────────────────────────────────────────────────

# auth.log — SSH failed login
# e.g. "Failed password for root from 192.168.1.99 port 22 ssh2"
# e.g. "Failed password for invalid user admin from 10.0.0.5 port 54321 ssh2"
RE_SSH_FAIL = re.compile(
    r"Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>[\d.a-fA-F:]+) port"
)

# auth.log — SSH accepted (for future use / monitoring)
RE_SSH_OK = re.compile(
    r"Accepted (?:password|publickey) for (?P<user>\S+) from (?P<ip>[\d.a-fA-F:]+)"
)

# auth.log — sudo failure
# e.g. "sudo: alice : command not allowed ; TTY=pts/1"
# e.g. "sudo: bob : user NOT in sudoers"
RE_SUDO_FAIL = re.compile(
    r"sudo:\s+(?P<user>\S+)\s*:.*?(command not allowed|NOT in sudoers|authentication failure)",
    re.IGNORECASE,
)

# syslog — generic malware heuristics (keyword match)
MALWARE_KEYWORDS = [
    "ransomware", "malware", "trojan", "rootkit", "spyware",
    "cryptominer", "miner", "backdoor", "keylogger",
]

# nginx access.log — SQL injection patterns in URI
# e.g. GET /login?id=1'+OR+'1'='1 HTTP/1.1
RE_SQL = re.compile(
    r"(?:union\s+select|or\s+1\s*=\s*1|drop\s+table|insert\s+into|"
    r"sleep\s*\(|benchmark\s*\(|'--|\bxp_\w+)",
    re.IGNORECASE,
)

# nginx access.log parse
# 127.0.0.1 - - [01/Jan/2025:12:00:00 +0000] "GET / HTTP/1.1" 200 512 "-" "curl"
RE_NGINX = re.compile(
    r'^(?P<ip>[\d.a-fA-F:]+)\s+-\s+-\s+\[.*?\]\s+'
    r'"(?P<method>\S+)\s+(?P<uri>\S+)\s+\S+"\s+(?P<status>\d+)'
)

# ── Event shipping ──────────────────────────────────────────────────────────

class EventShipper:
    def __init__(self, backend: str, token: str):
        self.url   = f"{backend.rstrip('/')}/api/events"
        self.token = token
        self._lock = threading.Lock()

    def ship(self, event: dict) -> bool:
        """POST event to backend. Returns True on success."""
        payload = json.dumps(event).encode()
        req = urllib.request.Request(
            self.url,
            data=payload,
            headers={
                "Content-Type":  "application/json",
                "Authorization": f"Bearer {self.token}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                body = json.loads(resp.read())
                rule = body.get("alert", {})
                rule_name = rule.get("rule_name", "none") if rule else "none"
                log.info(
                    "✓ %-25s  src=%-18s  alert=%s",
                    event["event_type"],
                    event.get("source_ip", "—"),
                    rule_name,
                )
                return True
        except urllib.error.HTTPError as e:
            log.warning("HTTP %s shipping %s: %s", e.code, event["event_type"], e.read().decode())
        except urllib.error.URLError as e:
            log.warning("Network error shipping event: %s", e.reason)
        except Exception as e:
            log.warning("Unexpected error: %s", e)
        return False

    def ship_with_retry(self, event: dict, retries: int = 3):
        for attempt in range(retries):
            if self.ship(event):
                return
            if attempt < retries - 1:
                time.sleep(RETRY_DELAY)
        log.error("Dropped event after %d retries: %s", retries, event["event_type"])

# ── Log parsers ─────────────────────────────────────────────────────────────

def parse_auth_log(line: str):
    """Parse /var/log/auth.log → list of event dicts (may be empty)."""
    events = []

    m = RE_SSH_FAIL.search(line)
    if m:
        events.append({
            "event_type": "SSH_FAILED_LOGIN",
            "source_ip":  m.group("ip"),
            "username":   m.group("user"),
            "raw_log":    line.strip(),
        })
        return events  # don't double-match

    m = RE_SUDO_FAIL.search(line)
    if m:
        events.append({
            "event_type": "SUDO_FAILURE",
            "source_ip":  None,
            "username":   m.group("user"),
            "raw_log":    line.strip(),
        })

    return events


def parse_syslog(line: str):
    """Parse /var/log/syslog — detect malware-related keywords."""
    lower = line.lower()
    for kw in MALWARE_KEYWORDS:
        if kw in lower:
            # Try to guess malware type from keyword
            if "ransomware" in lower:
                malware_type = "RANSOMWARE"
            elif "rootkit" in lower:
                malware_type = "ROOTKIT"
            elif "spyware" in lower:
                malware_type = "SPYWARE"
            elif "miner" in lower or "cryptominer" in lower:
                malware_type = "CRYPTOMINER"
            else:
                malware_type = "UNKNOWN"

            return [{
                "event_type":   "MALWARE_DETECTED",
                "source_ip":    None,
                "username":     None,
                "malware_type": malware_type,
                "raw_log":      line.strip(),
            }]
    return []


def parse_nginx(line: str):
    """Parse nginx access.log → HTTP_FLOOD and/or SQL_INJECTION events."""
    events = []
    m = RE_NGINX.match(line)
    if not m:
        return events

    ip     = m.group("ip")
    uri    = m.group("uri")
    raw    = line.strip()

    # Every nginx line is a potential HTTP_FLOOD event
    events.append({
        "event_type": "HTTP_FLOOD",
        "source_ip":  ip,
        "username":   None,
        "raw_log":    raw,
    })

    # Additionally check for SQL injection in the URI
    if RE_SQL.search(uri):
        events.append({
            "event_type": "SQL_INJECTION",
            "source_ip":  ip,
            "username":   None,
            "raw_log":    raw,
        })

    return events


def get_parser(path: str):
    """Return the right parser function for a log file path."""
    p = path.lower()
    if "auth" in p:
        return parse_auth_log
    if "nginx" in p or "access" in p:
        return parse_nginx
    if "syslog" in p or "messages" in p:
        return parse_syslog
    # Default: try auth parser (covers most Linux auth logs)
    return parse_auth_log

# ── File tailer ─────────────────────────────────────────────────────────────

def tail_file(path: str, shipper: EventShipper, stop_event: threading.Event):
    """
    Tail a single log file from the end, forever.
    Handles log rotation (file recreated / truncated).
    Runs in its own thread.
    """
    parser = get_parser(path)
    log.info("Watching: %s", path)

    def open_file():
        f = open(path, "r", errors="replace")
        f.seek(0, 2)  # seek to end — don't replay old logs
        return f

    f = None
    inode = None

    while not stop_event.is_set():
        # Open / reopen file
        try:
            if f is None:
                f = open_file()
                inode = os.stat(path).st_ino
        except FileNotFoundError:
            log.warning("Not found (will retry): %s", path)
            time.sleep(RECONNECT_DELAY)
            continue
        except PermissionError:
            log.error("Permission denied: %s  (try running as root)", path)
            stop_event.wait(30)
            continue

        # Read new lines
        try:
            line = f.readline()
            if line:
                events = parser(line)
                for ev in events:
                    # Ship in a daemon thread so the tail loop never blocks
                    t = threading.Thread(
                        target=shipper.ship_with_retry,
                        args=(ev,),
                        daemon=True,
                    )
                    t.start()
            else:
                # No new data — check for rotation
                try:
                    current_inode = os.stat(path).st_ino
                    current_size  = os.stat(path).st_size
                    file_pos      = f.tell()

                    if current_inode != inode or current_size < file_pos:
                        log.info("Rotation detected: %s — reopening", path)
                        f.close()
                        f = None
                        time.sleep(RECONNECT_DELAY)
                        continue
                except FileNotFoundError:
                    f.close()
                    f = None
                    time.sleep(RECONNECT_DELAY)
                    continue

                time.sleep(TAIL_POLL_INTERVAL)

        except Exception as e:
            log.error("Error reading %s: %s", path, e)
            try:
                f.close()
            except Exception:
                pass
            f = None
            time.sleep(RECONNECT_DELAY)

    if f:
        f.close()

# ── Entry point ─────────────────────────────────────────────────────────────

def load_config_env(path: str) -> dict:
    """Load key=value pairs from a simple env file."""
    cfg = {}
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, _, v = line.partition("=")
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    return cfg


def main():
    parser = argparse.ArgumentParser(description="LinuxWatch log agent")
    parser.add_argument("--config", help="Path to config.env file", default=None)
    parser.add_argument("--backend", help="Backend URL (overrides env/config)", default=None)
    parser.add_argument("--logs", nargs="+", help="Log file paths to watch", default=None)
    args = parser.parse_args()

    # 1. Start from environment
    cfg = {
        "BACKEND":   os.environ.get("BACKEND",   DEFAULT_BACKEND),
        "JWT_TOKEN": os.environ.get("JWT_TOKEN", ""),
        "LOG_PATHS": os.environ.get("LOG_PATHS", ""),
    }

    # 2. Override with config file if provided
    if args.config:
        file_cfg = load_config_env(args.config)
        cfg.update(file_cfg)

    # 3. Override with CLI flags
    if args.backend:
        cfg["BACKEND"] = args.backend
    if args.logs:
        cfg["LOG_PATHS"] = ",".join(args.logs)

    backend = cfg["BACKEND"]
    token   = cfg["JWT_TOKEN"]

    if not token:
        log.error("No JWT token found.")
        log.error("Set JWT_TOKEN env var, pass --config config.env, or copy token from DevTools.")
        sys.exit(1)

    # Resolve log paths
    raw_paths = cfg.get("LOG_PATHS", "")
    if raw_paths:
        log_paths = [p.strip() for p in raw_paths.split(",") if p.strip()]
    else:
        log_paths = DEFAULT_LOG_PATHS

    # Filter to paths that exist
    existing = [p for p in log_paths if Path(p).exists()]
    missing  = [p for p in log_paths if not Path(p).exists()]

    if missing:
        log.warning("Log files not found (skipping): %s", ", ".join(missing))
    if not existing:
        log.error("None of the configured log files exist. Exiting.")
        log.error("Paths checked: %s", ", ".join(log_paths))
        sys.exit(1)

    log.info("═" * 50)
    log.info("LinuxWatch Agent starting")
    log.info("Backend : %s", backend)
    log.info("Watching: %s", ", ".join(existing))
    log.info("═" * 50)

    shipper    = EventShipper(backend, token)
    stop_event = threading.Event()

    # Graceful shutdown
    def handle_signal(sig, frame):
        log.info("Shutting down…")
        stop_event.set()

    signal.signal(signal.SIGINT,  handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # Spin up one thread per log file
    threads = []
    for path in existing:
        t = threading.Thread(
            target=tail_file,
            args=(path, shipper, stop_event),
            daemon=True,
            name=f"tail:{path}",
        )
        t.start()
        threads.append(t)

    # Wait until signalled
    stop_event.wait()
    log.info("Agent stopped.")


if __name__ == "__main__":
    main()