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
import getpass
import urllib.request
import urllib.error
from urllib.parse import unquote
from pathlib import Path
from collections import defaultdict

# ── Config ─────────────────────────────────────────────────────────────────

DEFAULT_BACKEND  = "http://localhost:5001"
DEFAULT_LOG_PATHS = [
    "/private/var/log/system.log",
    "/var/log/system.log",
    "/var/log/auth.log",
    "/var/log/syslog",
    "/var/log/ufw.log",
    "/var/log/kern.log",
    "/var/log/firewall.log",
    "/var/log/nginx/access.log",
]
DEFAULT_PROBE_PORTS = [3333, 3444, 3555, 3666, 3777, 3888, 3999, 4111, 4222, 4333, 4444]
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
    r"Failed password for (?:invalid user )?(?P<user>\S+) from (?P<ip>[\d.a-fA-F:]+) port",
    re.IGNORECASE,
)
RE_SSH_PAM_FAIL = re.compile(
    r"(?:PAM: authentication error for|authentication failure.*?user=)\s*"
    r"(?:illegal user\s+)?(?P<user>[\w.@+-]+).*?(?:from\s+|rhost=)(?P<ip>[\d.a-fA-F:]+)",
    re.IGNORECASE,
)
RE_SSH_PAM_FAILURE = re.compile(
    r"authentication failure.*?rhost=(?P<ip>[\d.a-fA-F:]+).*?user=(?P<user>[\w.@+-]+)",
    re.IGNORECASE,
)

RE_SSH_INVALID = re.compile(
    r"(?:Invalid user|(?:Connection closed|Connection reset|Disconnected) by authenticating user)"
    r"\s+(?P<user>\S+)\s+(?:from\s+)?(?P<ip>[\d.a-fA-F:]+)\s+port"
)

# auth.log — SSH accepted (for future use / monitoring)
RE_SSH_OK = re.compile(
    r"Accepted (?:password|publickey) for (?P<user>\S+) from (?P<ip>[\d.a-fA-F:]+)"
)

# auth.log & macOS log stream — sudo with COMMAND=
RE_SUDO_CMD = re.compile(
    r"sudo(?:\[\d+\])?:\s*(?:(?P<user>\S+)\s*:)?.*COMMAND=(?P<cmd>.+)$",
    re.IGNORECASE,
)

# auth.log & macOS log stream — sudo failures
RE_SUDO_FAIL = re.compile(
    r"sudo(?:\[\d+\])?:\s*(?:(?P<user>\S+)\s*:)?.*?(command not allowed|NOT in sudoers|authentication failure|incorrect password attempts|\bfailed\b)",
    re.IGNORECASE,
)

# auth.log — new SSH key / authorized_keys
RE_SSH_NEW_KEY = re.compile(
    r"(?:authorized_keys|ssh-keygen|Added new key)",
    re.IGNORECASE,
)

# connection attempts to ports (port scan heuristic)
RE_CONN_ATTEMPT = re.compile(
    r"connection (?:from|attempt) (?P<ip>[\d.a-fA-F:]+).*?port (?P<port>\d+)",
    re.IGNORECASE,
)

# Linux firewall/kernel logs — real scans against closed or filtered ports.
RE_FIREWALL_DROP = re.compile(
    r"(?:SRC=|src=)(?P<ip>[\d.a-fA-F:]+).*?(?:DPT=|dpt=)(?P<port>\d+)",
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

    def verify_token(self) -> bool:
        req = urllib.request.Request(
            f"{self.url.rsplit('/api/events', 1)[0]}/api/auth/me",
            headers={"Authorization": f"Bearer {self.token}"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                identity = json.loads(resp.read())
                log.info("Authenticated as user=%s role=%s", identity.get("username"), identity.get("role"))
                return True
        except urllib.error.HTTPError as e:
            log.error("Agent token rejected by backend (HTTP %s). Log in again and replace JWT_TOKEN.", e.code)
        except urllib.error.URLError as e:
            log.error("Cannot reach backend for token verification: %s", e.reason)
        except Exception as e:
            log.error("Unexpected token verification error: %s", e)
        return False

# ── Log parsers ─────────────────────────────────────────────────────────────

def parse_auth_log(line: str):
    """Parse /var/log/auth.log → list of event dicts (may be empty)."""
    events = []

    m = RE_SSH_FAIL.search(line)
    if not m:
        m = RE_SSH_PAM_FAIL.search(line)
    if not m:
        m = RE_SSH_PAM_FAILURE.search(line)
    if not m:
        m = RE_SSH_INVALID.search(line)
    if m:
        events.append({
            "event_type": "SSH_FAILED_LOGIN",
            "source_ip":  m.group("ip"),
            "username":   m.group("user"),
            "raw_log":    line.strip(),
        })
        return events

    if RE_SSH_NEW_KEY.search(line):
        m2 = RE_SSH_OK.search(line)
        events.append({
            "event_type": "SSH_NEW_KEY",
            "source_ip":  m2.group("ip") if m2 else None,
            "username":   m2.group("user") if m2 else None,
            "raw_log":    line.strip(),
        })
        return events

    m = RE_CONN_ATTEMPT.search(line)
    if m:
        events.append({
            "event_type": "PORT_SCAN",
            "source_ip":  m.group("ip"),
            "port":       int(m.group("port")),
            "raw_log":    line.strip(),
        })

    m = RE_SUDO_FAIL.search(line)
    if m:
        events.append({
            "event_type": "SUDO_FAILURE",
            "source_ip":  None,
            "username":   m.group("user"),
            "raw_log":    line.strip(),
        })
        return events

    m = RE_SUDO_CMD.search(line)
    if m:
        events.append({
            "event_type": "SUDO_COMMAND",
            "source_ip":  None,
            "username":   m.group("user"),
            "sudo_command": m.group("cmd").strip(),
            "raw_log":    line.strip(),
        })
        return events

    return events


def parse_firewall_log(line: str):
    """Parse UFW/netfilter-style records into real port-scan observations."""
    m = RE_FIREWALL_DROP.search(line)
    if not m:
        return []
    return [{
        "event_type": "PORT_SCAN",
        "source_ip": m.group("ip"),
        "port": int(m.group("port")),
        "raw_log": line.strip(),
    }]


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
    decoded_uri = unquote(uri)
    raw    = line.strip()

    # Every nginx line is a potential HTTP_FLOOD event
    events.append({
        "event_type": "HTTP_FLOOD",
        "source_ip":  ip,
        "username":   None,
        "raw_log":    raw,
    })

    # Additionally check for SQL injection in the URI
    if RE_SQL.search(decoded_uri):
        events.append({
            "event_type": "SQL_INJECTION",
            "source_ip":  ip,
            "username":   None,
            "raw_log":    raw,
        })

    return events


def get_parser(path: str):
    p = path.lower()
    if "auth" in p:
        return parse_auth_log
    if "nginx" in p or "access" in p:
        return parse_nginx
    if "syslog" in p or "messages" in p:
        return parse_syslog
    if any(name in p for name in ("ufw", "kern.log", "firewall")):
        return parse_firewall_log
    if "system.log" in p:
        return parse_auth_log   # ADD THIS
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


def get_local_host_ip():
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        address = sock.getsockname()[0]
        sock.close()
        return address
    except OSError:
        return "127.0.0.1"


def watch_authorized_keys(path: str, shipper: EventShipper, stop_event: threading.Event):
    """Ship real authorized-key additions from the monitored OS account."""
    import os

    username = getpass.getuser()
    source_ip = get_local_host_ip()
    known_lines = set()
    inode = None
    position = 0
    log.info("Watching authorized keys: %s (user=%s host=%s)", path, username, source_ip)

    while not stop_event.is_set():
        try:
            stat = os.stat(path)
            if inode != stat.st_ino:
                with open(path, "r", errors="replace") as key_file:
                    current_lines = [line.rstrip("\n") for line in key_file if line.strip()]
                known_lines = set(current_lines)
                inode = stat.st_ino
                position = stat.st_size
            elif stat.st_size < position:
                position = 0

            with open(path, "r", errors="replace") as key_file:
                key_file.seek(position)
                new_lines = key_file.readlines()
                position = key_file.tell()

            for line in new_lines:
                key_line = line.strip()
                if not key_line or key_line.startswith("#") or key_line in known_lines:
                    continue
                known_lines.add(key_line)
                event = {
                    "event_type": "SSH_NEW_KEY",
                    "source_ip": source_ip,
                    "username": username,
                    "raw_log": key_line,
                }
                threading.Thread(target=shipper.ship_with_retry, args=(event,), daemon=True).start()
        except FileNotFoundError:
            log.warning("Authorized keys file not found (will retry): %s", path)
        except PermissionError:
            log.error("Permission denied reading authorized keys: %s", path)
        except OSError as exc:
            log.warning("Authorized keys watcher error: %s", exc)
        stop_event.wait(TAIL_POLL_INTERVAL)


# ── Active Port Probe Listener ─────────────────────────────────────────────

def listen_port_probes(shipper: EventShipper, stop_event: threading.Event, ports=None):
    """
    Spins up lightweight listening sockets on secondary ports to catch real port scans (e.g. nmap or nc).
    Ships PORT_SCAN events immediately to the backend.
    """
    import socket
    ports = ports or DEFAULT_PROBE_PORTS
    log.info("Starting Port Probe Listener on ports: %s", ", ".join(map(str, ports)))
    sockets = []
    for p in ports:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("0.0.0.0", p))
            s.listen(5)
            s.settimeout(0.5)
            sockets.append((s, p))
        except OSError as exc:
            log.warning("Port probe listener unavailable on %d: %s", p, exc)

    if not sockets:
        log.error("No port probe listeners started")

    while not stop_event.is_set():
        for s, p in sockets:
            try:
                conn, addr = s.accept()
                src_ip = addr[0]
                conn.close()
                log.info("Port probe caught on port %d from %s", p, src_ip)
                ev = {
                    "event_type": "PORT_SCAN",
                    "source_ip": src_ip,
                    "port": p,
                    "raw_log": f"TCP connection from {src_ip} on port {p}",
                }
                threading.Thread(target=shipper.ship_with_retry, args=(ev,), daemon=True).start()
            except socket.timeout:
                continue
            except Exception:
                pass

    for s, p in sockets:
        try:
            s.close()
        except Exception:
            pass


# ── OS Live System Log Streamer ───────────────────────────────────────────

def stream_system_logs(shipper: EventShipper, stop_event: threading.Event):
    """
    Streams live OS authentication logs (macOS log stream / Linux journalctl).
    Ensures real terminal actions like `sudo` failures and SSH attempts are caught instantly.
    """
    import subprocess

    cmd = None
    if sys.platform == "darwin":
        cmd = ["/usr/bin/log", "stream", "--style", "syslog", "--predicate", 'process == "sudo" || process == "sshd"']
    elif sys.platform.startswith("linux"):
        cmd = ["journalctl", "-f", "-o", "short", "-t", "sshd", "-t", "sudo"]

    if not cmd:
        return

    log.info("Starting Live System Log Streamer: %s", " ".join(cmd))
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1
        )
        while not stop_event.is_set():
            line = proc.stdout.readline()
            if not line:
                break
            events = parse_auth_log(line)
            for ev in events:
                threading.Thread(target=shipper.ship_with_retry, args=(ev,), daemon=True).start()
        proc.terminate()
    except Exception as e:
        log.warning("System log streamer ended: %s", e)


def stream_firewall_journal(shipper: EventShipper, stop_event: threading.Event):
    """Read kernel firewall records when Linux has no UFW/netfilter log file."""
    if not sys.platform.startswith("linux"):
        return

    import subprocess
    cmd = ["journalctl", "-f", "-k", "-o", "short"]
    log.info("Starting Linux kernel firewall log stream: %s", " ".join(cmd))
    try:
        proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1
        )
        while not stop_event.is_set():
            line = proc.stdout.readline()
            if not line:
                break
            events = parse_firewall_log(line)
            for ev in events:
                threading.Thread(target=shipper.ship_with_retry, args=(ev,), daemon=True).start()
        proc.terminate()
    except Exception as e:
        log.warning("Kernel firewall log streamer ended: %s", e)


# ── Live Interactive SSH Login Trap ───────────────────────────────────────

def start_ssh_test_server(shipper: EventShipper, stop_event: threading.Event, port=2222):
    """
    Listens on SSH port 2222 using Paramiko. When user runs `ssh user@localhost -p 2222`,
    it presents a real interactive password prompt, logs every SSH_FAILED_LOGIN, and ships events to LinuxWatch.
    """
    import socket
    try:
        import paramiko
        HAS_PARAMIKO = True
    except ImportError:
        HAS_PARAMIKO = False

    if not HAS_PARAMIKO:
        log.error("SSH trap unavailable: install dependencies with `python3 -m pip install -r requirements.txt`")
        return

    log.info("Starting Interactive SSH Trap on port %d (e.g. ssh user@localhost -p %d)", port, port)

    if HAS_PARAMIKO:
        # Suppress noisy paramiko log output & transport tracebacks
        logging.getLogger("paramiko").setLevel(logging.CRITICAL)
        logging.getLogger("paramiko.transport").setLevel(logging.CRITICAL)
        key_path = Path(__file__).parent / "host_key.pem"
        if key_path.exists():
            try:
                host_key = paramiko.RSAKey(filename=str(key_path))
            except Exception:
                host_key = paramiko.RSAKey.generate(2048)
                host_key.write_private_key_file(str(key_path))
        else:
            host_key = paramiko.RSAKey.generate(2048)
            try:
                host_key.write_private_key_file(str(key_path))
            except Exception:
                pass

        class SSHServer(paramiko.ServerInterface):
            def __init__(self, client_ip, client_port):
                self.client_ip = client_ip
                self.client_port = client_port

            def check_auth_password(self, username, password):
                log.info("SSH password attempt captured: user='%s' src=%s", username, self.client_ip)
                ev = {
                    "event_type": "SSH_FAILED_LOGIN",
                    "source_ip": self.client_ip,
                    "username": username,
                    "raw_log": f"Failed password for {username} from {self.client_ip} port {self.client_port} ssh2",
                }
                threading.Thread(target=shipper.ship_with_retry, args=(ev,), daemon=True).start()
                return paramiko.AUTH_FAILED

            def get_allowed_auths(self, username):
                return "password"

            def check_channel_request(self, kind, chanid):
                return paramiko.OPEN_FAILED_ADMINISTRATIVELY_PROHIBITED

        try:
            server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            server.bind(("0.0.0.0", port))
            server.listen(10)
            server.settimeout(0.5)
        except Exception as e:
            log.warning("Could not bind SSH trap on port %d: %s", port, e)
            return

        while not stop_event.is_set():
            try:
                client, addr = server.accept()

                def handle_paramiko(c, ip, p):
                    try:
                        transport = paramiko.Transport(c)
                        transport.logger.setLevel(logging.CRITICAL)
                        transport.add_server_key(host_key)
                        server_handler = SSHServer(ip, p)
                        try:
                            transport.start_server(server=server_handler)
                        except Exception:
                            return
                        while transport.is_active() and not stop_event.is_set():
                            time.sleep(0.2)
                    except Exception:
                        pass
                    finally:
                        try:
                            transport.close()
                        except Exception:
                            pass

                threading.Thread(target=handle_paramiko, args=(client, addr[0], addr[1]), daemon=True).start()
            except socket.timeout:
                continue
            except Exception:
                pass

        server.close()

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
        "PROBE_PORTS": os.environ.get("PROBE_PORTS", ""),
        "SSH_TRAP_PORT": os.environ.get("SSH_TRAP_PORT", "2222"),
        "ENABLE_PROBE_LISTENER": os.environ.get("ENABLE_PROBE_LISTENER", "false"),
        "ENABLE_TEST_TRAP": os.environ.get("ENABLE_TEST_TRAP", "false"),
        "ENABLE_AUTHORIZED_KEYS_WATCH": os.environ.get("ENABLE_AUTHORIZED_KEYS_WATCH", "true"),
        "SSH_AUTHORIZED_KEYS_PATH": os.environ.get("SSH_AUTHORIZED_KEYS_PATH", os.path.expanduser("~/.ssh/authorized_keys")),
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
        log.warning("No configured log files exist; continuing with live system logs and socket probes")

    log.info("═" * 50)
    log.info("LinuxWatch Agent starting")
    log.info("Backend : %s", backend)
    log.info("Watching: %s", ", ".join(existing))
    log.info("═" * 50)

    shipper    = EventShipper(backend, token)
    if not shipper.verify_token():
        sys.exit(1)
    stop_event = threading.Event()

    raw_probe_ports = cfg.get("PROBE_PORTS", "")
    if raw_probe_ports:
        try:
            probe_ports = [int(p.strip()) for p in raw_probe_ports.split(",") if p.strip()]
            if not probe_ports or any(p < 1 or p > 65535 for p in probe_ports):
                raise ValueError
        except ValueError:
            log.error("PROBE_PORTS must be a comma-separated list of ports from 1 to 65535")
            sys.exit(1)
    else:
        probe_ports = DEFAULT_PROBE_PORTS

    enable_probe_listener = str(cfg.get("ENABLE_PROBE_LISTENER", "false")).lower() in {"1", "true", "yes"}
    enable_test_trap = str(cfg.get("ENABLE_TEST_TRAP", "false")).lower() in {"1", "true", "yes"}
    enable_authorized_keys_watch = str(cfg.get("ENABLE_AUTHORIZED_KEYS_WATCH", "true")).lower() in {"1", "true", "yes"}

    try:
        ssh_trap_port = int(cfg.get("SSH_TRAP_PORT", "2222"))
        if ssh_trap_port < 1 or ssh_trap_port > 65535:
            raise ValueError
    except ValueError:
        log.error("SSH_TRAP_PORT must be a port from 1 to 65535")
        sys.exit(1)

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

    # Optional test-only listeners. Production port-scan detection comes from
    # firewall/kernel logs so the agent does not alter the host's attack surface.
    if enable_probe_listener:
        probe_thread = threading.Thread(
            target=listen_port_probes,
            args=(shipper, stop_event, probe_ports),
            daemon=True,
            name="port-probes",
        )
        probe_thread.start()
        threads.append(probe_thread)
    else:
        log.info("Probe listeners disabled; monitoring firewall logs for real port scans")

    # Spin up OS system log streamer thread
    syslog_thread = threading.Thread(
        target=stream_system_logs,
        args=(shipper, stop_event),
        daemon=True,
        name="syslog-stream",
    )
    syslog_thread.start()
    threads.append(syslog_thread)

    firewall_thread = threading.Thread(
        target=stream_firewall_journal,
        args=(shipper, stop_event),
        daemon=True,
        name="firewall-journal",
    )
    firewall_thread.start()
    threads.append(firewall_thread)

    if enable_authorized_keys_watch:
        keys_thread = threading.Thread(
            target=watch_authorized_keys,
            args=(os.path.expanduser(cfg["SSH_AUTHORIZED_KEYS_PATH"]), shipper, stop_event),
            daemon=True,
            name="authorized-keys",
        )
        keys_thread.start()
        threads.append(keys_thread)
    else:
        log.info("Authorized-keys monitoring disabled")

    if enable_test_trap:
        log.warning("TEST MODE: starting synthetic SSH trap on port %d", ssh_trap_port)
        ssh_trap_thread = threading.Thread(
            target=start_ssh_test_server,
            args=(shipper, stop_event, ssh_trap_port),
            daemon=True,
            name="ssh-trap",
        )
        ssh_trap_thread.start()
        threads.append(ssh_trap_thread)
    else:
        log.info("SSH test trap disabled; monitoring the host's real SSH logs")

    # Wait until signalled
    stop_event.wait()
    log.info("Agent stopped.")


if __name__ == "__main__":
    main()