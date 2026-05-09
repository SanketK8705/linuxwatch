# LinuxWatch Agent

Tails your Linux log files in real time and ships structured events to the
LinuxWatch backend, which runs them through the detection engine and fires
alerts to your dashboard.

## Requirements

- Python 3.7+ (no third-party packages — stdlib only)
- Read access to the log files you want to monitor
- A running LinuxWatch backend
- A valid JWT token (log in to the frontend, open DevTools →
  Application → Local Storage → copy `lw_token`)

---

## Quick start

### Option A — environment variable (simplest)

```bash
JWT_TOKEN=<your_token> python3 agent.py
```

This watches the default paths:
- `/var/log/auth.log`
- `/var/log/syslog`
- `/var/log/nginx/access.log`

### Option B — config file

```bash
cp config.env.example config.env
# edit config.env with your token + backend URL
python3 agent.py --config config.env
```

### Option C — remote backend

```bash
JWT_TOKEN=<token> BACKEND=http://192.168.1.10:3001 python3 agent.py
```

### Option D — custom log paths

```bash
JWT_TOKEN=<token> python3 agent.py --logs /var/log/auth.log /var/log/syslog
```

---

## Log sources and what they detect

| Log file | Detected events |
|---|---|
| `/var/log/auth.log` | `SSH_FAILED_LOGIN`, `SUDO_FAILURE` |
| `/var/log/syslog` | `MALWARE_DETECTED` (keyword heuristics) |
| `/var/log/nginx/access.log` | `HTTP_FLOOD`, `SQL_INJECTION` |

The detection engine on the backend then applies rules on top of these
events and fires alerts (brute force, DDoS, SQL injection campaign, etc.)

---

## Running on a remote Linux server

1. Copy `agent.py` and `config.env.example` to the server.
2. Fill in `config.env` with your token and your backend's IP.
3. Run:

```bash
python3 agent.py --config config.env
```

Log files on Linux typically require root or membership in the `adm` group:

```bash
sudo python3 agent.py --config config.env
# or
sudo usermod -aG adm $USER  # then log out/in
```

### Run as a systemd service (keeps it alive after reboot)

```ini
# /etc/systemd/system/linuxwatch-agent.service
[Unit]
Description=LinuxWatch Agent
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/linuxwatch/agent.py --config /opt/linuxwatch/config.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now linuxwatch-agent
sudo systemctl status linuxwatch-agent
```

---

## macOS notes

macOS doesn't have `/var/log/auth.log` or `/var/log/syslog`. Use:

```
LOG_PATHS=/var/log/system.log,/usr/local/var/log/nginx/access.log
```

SSH failures on macOS appear in `/var/log/system.log` with slightly
different formatting — the agent's auth parser still catches them.

---

## Stopping the agent

```
Ctrl+C
```

Or if running as a service: `sudo systemctl stop linuxwatch-agent`