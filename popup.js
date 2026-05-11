const CIRCUMFERENCE = 2 * Math.PI * 52;

const ringFg      = document.getElementById('ring-fg');
const timeDisplay = document.getElementById('time-display');
const targetLabel = document.getElementById('target-label');
const statusText  = document.getElementById('status-text');
const streakVal   = document.getElementById('streak-val');
const weeklyVal   = document.getElementById('weekly-val');
const startBtn    = document.getElementById('start-btn');
const calEl        = document.getElementById('calendar');
const freezeEl     = document.getElementById('freeze-indicator');
const settingsBtn  = document.getElementById('settings-btn');

function weekKey(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

const i18n = (key, ...subs) => chrome.i18n.getMessage(key, subs);

// Static translations
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
startBtn.textContent = i18n('btnStart');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtSecs(s) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function setRing(progress) {
  ringFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
}

function computeActiveSecs(data, totalSecs) {
  let t = data.accumulatedActiveSecs || 0;
  if (data.activeStart) t += (Date.now() - data.activeStart) / 1000;
  return Math.min(t, totalSecs);
}

// ── Calendar ───────────────────────────────────────────────

function renderCalendar(completedDays) {
  const today       = todayStr();
  const todayDate   = new Date(today);
  const dow         = todayDate.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const dayLabels   = i18n('calDays').split(',');

  calEl.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d    = new Date(todayDate);
    d.setDate(todayDate.getDate() - daysFromMon + i);
    const dStr   = d.toISOString().slice(0, 10);
    const isDone = completedDays?.[dStr];
    const isToday = dStr === today;
    const isFuture = dStr > today;

    const cell  = document.createElement('div');
    cell.className = 'cal-day';

    const dot = document.createElement('div');
    dot.className = 'cal-dot'
      + (isDone   ? ' done'   : '')
      + (isToday  ? ' today'  : '')
      + (isFuture ? ' future' : '');

    const lbl = document.createElement('div');
    lbl.className = 'cal-label' + (isToday ? ' today' : '');
    lbl.textContent = dayLabels[i];

    cell.appendChild(dot);
    cell.appendChild(lbl);
    calEl.appendChild(cell);
  }
}

// ── Freeze indicator ───────────────────────────────────────

function renderFreeze(data) {
  const enabled = data.streakFreezeEnabled !== false; // default true
  const streak  = data.streak || 0;

  if (!enabled || streak === 0) {
    freezeEl.className = 'hidden';
    return;
  }

  const used = data.freezeUsedWeek === weekKey(todayStr());
  freezeEl.textContent = i18n(used ? 'freezeUsed' : 'freezeAvailable');
  freezeEl.className   = used ? 'freeze-used' : 'freeze-available';
}

// ── Render ─────────────────────────────────────────────────

function render(data) {
  const today      = todayStr();
  const totalSecs  = (data.practiceMins || 10) * 60;
  const totalMins  = data.practiceMins || 10;

  streakVal.textContent = data.streak ?? 0;
  weeklyVal.textContent = `${data.weeklyCount ?? 0}/7`;
  targetLabel.textContent = i18n('targetLabel', String(totalMins));
  renderCalendar(data.completedDays);
  renderFreeze(data);

  if (data.lastSessionDate !== today) {
    timeDisplay.textContent = '0:00';
    setRing(0);
    ringFg.classList.remove('done');
    statusText.textContent = i18n('statusNotStarted');
    statusText.className = '';
    startBtn.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.textContent = i18n('btnStart');
    return;
  }

  startBtn.classList.add('hidden');

  if (data.sessionCompleted) {
    timeDisplay.textContent = fmtSecs(totalSecs);
    setRing(1);
    ringFg.classList.add('done');
    statusText.textContent = i18n('statusCompleted');
    statusText.className = 'done';
    return;
  }

  ringFg.classList.remove('done');
  const activeSecs = computeActiveSecs(data, totalSecs);
  timeDisplay.textContent = fmtSecs(activeSecs);
  setRing(activeSecs / totalSecs);

  if (data.activeStart) {
    statusText.textContent = i18n('statusInProgress');
    statusText.className = 'active';
  } else {
    statusText.textContent = i18n('statusPaused');
    statusText.className = 'paused';
  }
}

async function refresh() {
  const data = await chrome.storage.local.get([
    'lastSessionDate', 'sessionCompleted',
    'accumulatedActiveSecs', 'activeStart',
    'streak', 'weeklyCount', 'completedDays', 'practiceMins',
    'streakFreezeEnabled', 'freezeUsedWeek',
  ]);
  render(data);
}

setInterval(refresh, 1000);
refresh();

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  startBtn.textContent = i18n('btnStarting');
  chrome.runtime.sendMessage({ action: 'startNow' }, () => setTimeout(refresh, 400));
});

settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
