# AzFIT - Fitness Coaching App

A modern fitness personal training mobile web app with a dual-mode interface: a polished dashboard view and an embedded spreadsheet/grid mode for data entry. Light mode default with full dark mode support.

## Features

- **Landing Page** - Full hero with holographic gym background, AzFIT AI Showcase orb, feature highlights, testimonials
- **Dashboard** - 4 animated progress rings (Fitness Score, Macros, Steps, Sleep), activity timeline, achievement badges
- **Sheets Mode** - Full spreadsheet data entry with Daily Tracking, Workouts, and Nutrition tabs
- **Analytics** - Weight trends, workout volume charts, macro distribution donut, consistency heatmap, PRs
- **Coach Dashboard** - Client management, program builder, messaging, revenue analytics
- **Settings** - Profile, dark mode toggle, units preference, notifications, connected devices

## Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v3 + shadcn/ui
- Framer Motion (animations)
- Recharts (data visualization)
- Lucide React (icons)

## Getting Started

### Prerequisites

- Node.js 20+
- VS Code (recommended)
- Kimi Code extension for VS Code

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd azfit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

## Kimi Code Setup (VS Code)

1. Install the **Kimi Code** extension from the VS Code marketplace
2. Open the AzFIT project in VS Code
3. Use Kimi Code to:
   - Ask questions about the codebase
   - Get help adding new features
   - Refactor and optimize components
   - Debug issues in real-time

### Recommended VS Code Extensions

VS Code will prompt you to install recommended extensions when you open the project:

- Tailwind CSS IntelliSense
- ESLint
- Prettier
- Auto Rename Tag
- Material Icon Theme

## Project Structure

```
azfit/
├── public/                    # Static assets (logos, images, badges)
│   ├── azfit-logo.png         # AzFIT metallic logo
│   ├── azfit-logo-text.png    # Logo with text on black
│   ├── azfit-hero-bg.png      # Holographic gym background
│   ├── azfit-bg-2.png         # Secondary background
│   ├── avatar-*.jpg           # User avatars
│   └── badge-*.png            # Achievement badges
├── src/
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── coach/            # Coach dashboard sub-components
│   │   ├── AIShowcase.tsx    # AI orb with rotating icons
│   │   ├── Footer.tsx        # App footer
│   │   ├── Layout.tsx        # App layout (nav, sidebar, tabs)
│   │   ├── ModeToggle.tsx    # Dashboard/Sheets toggle pill
│   │   ├── Navbar.tsx        # Top navigation bar
│   │   ├── ProgressRing.tsx  # Circular progress ring (SVG)
│   │   └── SheetsPanel.tsx   # Spreadsheet data entry panel
│   ├── pages/
│   │   ├── Home.tsx          # Landing page
│   │   ├── Dashboard.tsx     # Main dashboard
│   │   ├── Analytics.tsx     # Analytics & charts
│   │   ├── Coach.tsx         # Coach dashboard
│   │   └── Settings.tsx      # User settings
│   ├── hooks/
│   │   ├── useTheme.tsx      # Dark/light mode hook
│   │   └── use-mobile.ts     # Mobile detection hook
│   ├── App.tsx               # Root component with routes
│   ├── index.css             # Global styles + CSS animations
│   └── main.tsx              # Entry point
├── .vscode/                  # VS Code settings
├── index.html
├── tailwind.config.js        # Tailwind theme customization
├── vite.config.ts
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Primary | `#0D9488` | Teal - buttons, active states |
| Secondary | `#06B6D4` | Aqua - highlights, data accents |
| Accent | `#8B5CF6` | Purple - achievements, badges |
| Success | `#84CC16` | Lime - positive trends, streaks |
| Danger | `#F87171` | Coral - errors, destructive |

## Design Tokens

All colors use CSS custom properties with full dark mode support. Toggle between themes via the Settings page or the sidebar toggle.

## License

MIT
