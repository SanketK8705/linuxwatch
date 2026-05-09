# LinuxWatch — Frontend

React dashboard for the LinuxWatch intrusion detection platform.

## Stack
- **React 18** + **Vite**
- **Tailwind CSS**
- **Socket.io-client** — real-time alert feed
- **Axios** — REST API calls

## Getting Started

```bash
npm install
npm run dev        # → http://localhost:3000
```

## Backend Contract

| Thing | Value |
|---|---|
| Backend URL | `http://localhost:5000` |
| Socket event | `new_alert` |
| REST endpoint | `GET /api/alerts` |

### Alert object shape
```json
{
  "id": "string",
  "ip": "string",
  "timestamp": "ISO 8601 string",
  "type": "SSH_BRUTE_FORCE",
  "severity": "CRITICAL | HIGH | MEDIUM",
  "status": "OPEN"
}
```

## Demo Mode

If the backend is unreachable, the dashboard auto-switches to **Demo Mode** and
generates simulated SSH brute-force alerts every 3.5 s so you can present without
the backend running. Use the **+ Simulate Alert** button in the topbar to fire a
single alert manually at any time.

## File Structure

```
src/
├── components/
│   ├── icons.jsx          # All SVG icons
│   ├── AlertCard.jsx      # Individual alert card (feed)
│   ├── AlertsTable.jsx    # Full alerts table
│   ├── LiveFeedSection.jsx# Real-time feed panel
│   ├── Sidebar.jsx        # Left navigation
│   ├── Topbar.jsx         # Top bar + status
│   ├── StatCard.jsx       # Summary stat tile
│   ├── SeverityBadge.jsx  # Coloured severity tag
│   ├── StatusBadge.jsx    # Alert status tag
│   └── SystemStatus.jsx   # Connection indicator
├── hooks/
│   └── useSocket.js       # Socket.io + demo mode logic
├── pages/
│   ├── DashboardPage.jsx  # Main dashboard view
│   ├── AlertsPage.jsx     # Filterable alerts view
│   └── PlaceholderPage.jsx# Stub for future modules
├── constants.js           # Config + demo data factory
├── utils.js               # Date/time formatters
├── App.jsx                # Root component + routing
├── main.jsx               # React entry point
└── index.css              # Global styles + CSS tokens
```

## Build for Production

```bash
npm run build    # outputs to dist/
npm run preview  # preview the production build
```
