# Dashboard Structure

## Trainer Dashboard (`src/components/dashboard/TrainerDashboard.tsx`)

**Purpose:** "Who needs my attention right now?"

Sections, top to bottom:

1. **Header**
   - Greeting (Coach {firstName})
   - Notification bell
   - Add Client button (opens `QuickAddClientModal`)

2. **Needs Attention Strip** (conditional)
   - Missed workouts this week
   - Check-ins pending review
   - Unread messages

3. **Today's Sessions**
   - Fetched live from `useSessions` (`todaySessions`)
   - Shows client name, time, duration, type, status
   - Loading skeletons + empty state linking to `/schedule`

4. **Business at a Glance** (3 cards)
   - Revenue ring
   - Client compliance ring
   - Active clients count

5. **Weekly Summary Metrics** (4-up)
   - Total volume, Avg RPE, Session hours, Client PRs

6. **Client Health Grid**
   - Status tiles per client (on track / at risk / needs attention / deload)

7. **AI Insights + Revenue Snapshot**
   - AI insight cards with suggested actions
   - Revenue snapshot card

8. **Quick Actions** (6 buttons)
   - Add Client, Build Program, AI Builder, Log Assessment, Export, Broadcast

9. **Weekly Schedule Overview**
   - Placeholder for hourly timeline (Phase A4)

## Client Dashboard (`src/components/dashboard/ClientDashboard.tsx`)

**Purpose:** "What do I need to do today?"

Sections, top to bottom:

1. **Header**
   - Greeting ({firstName})
   - Notification bell
   - Streak badge

2. **Your Coach Card**
   - Coach avatar, name, online status
   - Next session (live from `useSessions` `nextUpcomingSession`)
   - Message + Book Session buttons

3. **Today's Workout**
   - Start Workout button
   - Exercise checklist with progress bar

4. **Check-in Due Card** (conditional)
   - Links to `/bioprint` placeholder

5. **Activity Rings Row** (3 cards)
   - Steps ring
   - Macros ring
   - Recovery ring (sleep / quality / HRV)

6. **Quick Log Row** (4 actions)
   - Water, Meal, Sleep, Weight

7. **Weekly Compliance Chart**
   - Bar chart of 7-day compliance

## Shared Dashboard Components

- `GlassCard` — frosted-glass card wrapper
- `ProgressRing` — circular progress indicator with glow
- `CollapsibleSection` — expandable section header with badge + action
- `ClientHealthGrid` — grid of client status tiles
- `AIInsightsPanel` — insight cards with action buttons
- `RevenueSnapshot` — revenue summary card
