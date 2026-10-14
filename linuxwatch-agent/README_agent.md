# LinuxWatch Agent

Tails your Linux log files in real time and ships structured events to the
LinuxWatch backend, which runs them through the detection engine and fires
alerts to your dashboard.

## Requirements

- Python 3.7+
- Optional Paramiko (`python3 -m pip install -r requirements.txt`) for the local test trap
- Read access to the log files you want to monitor
- A running LinuxWatch backend
- A valid JWT token (log in to the frontend, open DevTools →
  Application → Local Storage → copy `lw_token`)

The frontend stores the token after login specifically so a host agent can use
the same account. Never commit `config.env` or share the token.

---

## Quick start

Install the optional test dependency only if you explicitly enable the synthetic
test trap:

```bash
python3 -m pip install -r requirements.txt
```

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

## Real host telemetry and what it detects

| Log file | Detected events |
|---|---|
| `/var/log/auth.log` | `SSH_FAILED_LOGIN`, `SUDO_FAILURE` |
| `/var/log/syslog` | `MALWARE_DETECTED` (keyword heuristics) |
| `/var/log/ufw.log`, `/var/log/kern.log` | `PORT_SCAN` from firewall drops |
| `/var/log/nginx/access.log` | `HTTP_FLOOD`, `SQL_INJECTION` |
| `~/.ssh/authorized_keys` | `SSH_NEW_KEY` when a new key line appears |

The detection engine on the backend then applies rules on top of these
events and fires alerts (brute force, DDoS, SQL injection campaign, etc.)

The deployed agent does not create a fake SSH service or fake scan ports.
SSH brute force is read from the host's real SSH daemon logs, sudo abuse from
the host's real sudo/PAM logs, and port scans from firewall/kernel logs. The
synthetic SSH trap and probe listeners exist only as explicit local test modes
(`ENABLE_TEST_TRAP=true` or `ENABLE_PROBE_LISTENER=true`).

---

## Running on a remote Linux server

1. Copy `agent.py` and `config.env.example` to the server.
2. Fill in `config.env` with your token and your backend's IP.
3. Run:

```bash
python3 agent.py --config config.env
```

The agent is required on every host whose SSH, sudo, or local port activity you
want to monitor. Deploying only the backend does not provide access to another
machine's operating-system logs or network sockets.

For a Linux VPS, run the agent as a service after creating `config.env`:

```ini
# /etc/systemd/system/linuxwatch-agent.service
[Unit]
Description=LinuxWatch host detection agent
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=/opt/linuxwatch-agent
ExecStart=/usr/bin/python3 /opt/linuxwatch-agent/Agent.py --config /opt/linuxwatch-agent/config.env
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now linuxwatch-agent
sudo journalctl -u linuxwatch-agent -f
```

The startup log should show the live system-log stream and should say that SSH
test traps and probe listeners are disabled. In production, enable firewall
logging so filtered connection attempts reach the agent. For UFW:

```bash
sudo ufw logging medium
sudo systemctl restart linuxwatch-agent
```

The agent then reads `/var/log/ufw.log` or `/var/log/kern.log` and detects
scans against real server ports, including closed or filtered ports.

To verify authorized-key monitoring safely, append a temporary public key line,
wait for the alert, then remove that exact line:

```bash
ssh-keygen -t ed25519 -N '' -f /tmp/linuxwatch-demo-key
cat /tmp/linuxwatch-demo-key.pub >> ~/.ssh/authorized_keys
# Check the dashboard for SSH_NEW_KEY (CRITICAL), then remove the test key:
grep -v -F "$(cat /tmp/linuxwatch-demo-key.pub)" ~/.ssh/authorized_keys > /tmp/authorized_keys.clean
mv /tmp/authorized_keys.clean ~/.ssh/authorized_keys
rm -f /tmp/linuxwatch-demo-key /tmp/linuxwatch-demo-key.pub
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