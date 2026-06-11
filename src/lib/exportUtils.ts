// ═══════════════════════════════════════════════════════════════
// AzFIT Export & Share Utilities
// CSV, PDF report, and social share image generation
// ═══════════════════════════════════════════════════════════════

/* ── CSV Export ─────────────────────────────────────────── */

export function exportWorkoutsToCSV(workouts: {
  date: string;
  workoutName: string;
  exercises: string;
  sets: number;
  volume: number;
  duration: number;
}[]): string {
  const headers = ['Date', 'Workout', 'Exercises', 'Total Sets', 'Volume (kg)', 'Duration (min)'];
  const rows = workouts.map((w) => [
    w.date,
    w.workoutName,
    w.exercises,
    w.sets.toString(),
    w.volume.toString(),
    w.duration.toString(),
  ]);
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

export function exportNutritionToCSV(entries: {
  date: string;
  calories: number;
  protein: number;
  fats: number;
  carbs: number;
  water: number;
}[]): string {
  const headers = ['Date', 'Calories', 'Protein (g)', 'Fats (g)', 'Carbs (g)', 'Water (ml)'];
  const rows = entries.map((e) => [
    e.date,
    e.calories.toString(),
    e.protein.toString(),
    e.fats.toString(),
    e.carbs.toString(),
    e.water.toString(),
  ]);
  return [headers, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/* ── PDF Report Generator ──────────────────────────────── */

export interface ReportData {
  clientName: string;
  dateRange: string;
  totalWorkouts: number;
  totalVolume: number;
  avgDuration: number;
  weightChange: number;
  bodyFatChange: number;
  streakDays: number;
  topExercises: { name: string; volume: number }[];
  weeklySummary: { week: string; workouts: number; volume: number }[];
}

export function generatePDFReportHTML(data: ReportData): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AzFIT Progress Report - ${data.clientName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B1120; color: #fff; padding: 40px; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #00AEEF; }
    .header h1 { font-size: 28px; color: #00AEEF; margin-bottom: 8px; }
    .header p { color: #94A3B8; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
    .stat-card { background: #1A2235; border: 1px solid #2A3447; border-radius: 12px; padding: 20px; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #00AEEF; }
    .stat-label { font-size: 12px; color: #94A3B8; margin-top: 4px; text-transform: uppercase; }
    .section { margin-bottom: 32px; }
    .section h2 { font-size: 18px; color: #F0F0F0; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #2A3447; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px; background: #1A2235; color: #94A3B8; font-size: 12px; text-transform: uppercase; }
    td { padding: 12px; border-bottom: 1px solid #2A3447; font-size: 14px; }
    .positive { color: #22C55E; }
    .negative { color: #EF4444; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #2A3447; color: #64748B; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>AzFIT Progress Report</h1>
    <p>${data.clientName} • ${data.dateRange}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${data.totalWorkouts}</div>
      <div class="stat-label">Workouts</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.totalVolume.toLocaleString()}</div>
      <div class="stat-label">Total Volume (kg)</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.avgDuration}m</div>
      <div class="stat-label">Avg Duration</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${data.weightChange >= 0 ? 'positive' : 'negative'}">${data.weightChange >= 0 ? '+' : ''}${data.weightChange.toFixed(1)}kg</div>
      <div class="stat-label">Weight Change</div>
    </div>
    <div class="stat-card">
      <div class="stat-value ${data.bodyFatChange <= 0 ? 'positive' : 'negative'}">${data.bodyFatChange <= 0 ? '' : '+'}${data.bodyFatChange.toFixed(1)}%</div>
      <div class="stat-label">Body Fat Change</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${data.streakDays}</div>
      <div class="stat-label">Day Streak</div>
    </div>
  </div>

  <div class="section">
    <h2>Top Exercises by Volume</h2>
    <table>
      <thead><tr><th>Exercise</th><th>Volume (kg)</th></tr></thead>
      <tbody>
        ${data.topExercises.map((ex) => `<tr><td>${ex.name}</td><td>${ex.volume.toLocaleString()}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Weekly Summary</h2>
    <table>
      <thead><tr><th>Week</th><th>Workouts</th><th>Volume (kg)</th></tr></thead>
      <tbody>
        ${data.weeklySummary.map((w) => `<tr><td>${w.week}</td><td>${w.workouts}</td><td>${w.volume.toLocaleString()}</td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    Generated by AzFIT.ai • Your Personal Training Companion
  </div>
</body>
</html>`;
}

export function downloadPDFReport(html: string, _filename: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}

/* ── Social Share Image ────────────────────────────────── */

export interface ShareImageData {
  clientName: string;
  workoutsThisWeek: number;
  totalVolume: number;
  streak: number;
  quote: string;
}

export function generateShareCanvas(data: ShareImageData): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(''); return; }

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
    gradient.addColorStop(0, '#0B1120');
    gradient.addColorStop(1, '#1A2235');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);

    // Border
    ctx.strokeStyle = '#00AEEF';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, 1040, 1040);

    // Logo area
    ctx.fillStyle = '#00AEEF';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AzFIT.ai', 540, 120);

    // Name
    ctx.fillStyle = '#F0F0F0';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText(data.clientName, 540, 240);

    // Stats
    const stats = [
      { label: 'Workouts', value: data.workoutsThisWeek.toString() },
      { label: 'Volume', value: `${(data.totalVolume / 1000).toFixed(1)}k kg` },
      { label: 'Streak', value: `${data.streak} days` },
    ];

    stats.forEach((stat, i) => {
      const x = 180 + i * 360;
      ctx.fillStyle = '#1A2235';
      ctx.fillRect(x - 140, 320, 280, 200);
      ctx.strokeStyle = '#2A3447';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 140, 320, 280, 200);

      ctx.fillStyle = '#00AEEF';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText(stat.value, x, 430);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '28px sans-serif';
      ctx.fillText(stat.label, x, 480);
    });

    // Quote
    ctx.fillStyle = '#64748B';
    ctx.font = 'italic 36px sans-serif';
    const maxWidth = 800;
    const words = data.quote.split(' ');
    let line = '';
    let y = 680;
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && line !== '') {
        ctx.fillText(line, 540, y);
        line = word + ' ';
        y += 50;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 540, y);

    // Footer
    ctx.fillStyle = '#64748B';
    ctx.font = '24px sans-serif';
    ctx.fillText('Track your progress at azfit.ai', 540, 980);

    resolve(canvas.toDataURL('image/png'));
  });
}

export function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ── iCalendar Export ──────────────────────────────────── */

export function generateICalEvent(event: {
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
}): string {
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${event.title}
DTSTART:${formatDate(event.start)}
DTEND:${formatDate(event.end)}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
END:VEVENT
END:VCALENDAR`;
}

export function downloadICS(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
