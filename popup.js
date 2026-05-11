const TOTAL_SECS  = 600; // 10 minutes
const CIRCUMFERENCE = 2 * Math.PI * 52;

const ringFg      = document.getElementById('ring-fg');
const timeDisplay = document.getElementById('time-display');
const statusText  = document.getElementById('status-text');
const streakVal   = document.getElementById('streak-val');
const weeklyVal   = document.getElementById('weekly-val');
const startBtn    = document.getElementById('start-btn');

const i18n = (key, ...subs) => chrome.i18n.getMessage(key, subs);

// Apply static translations once on load
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtSecs(s) {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// progress 0..1 → fill ring clockwise from empty
function setRing(progress) {
  ringFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)));
}

function computeActiveSecs(data) {
  let total = data.accumulatedActiveSecs || 0;
  if (data.activeStart) total += (Date.now() - data.activeStart) / 1000;
  return Math.min(total, TOTAL_SECS);
}

function render(data) {
  const today = todayStr();

  streakVal.textContent = data.streak ?? 0;
  weeklyVal.textContent = `${data.weeklyCount ?? 0}/7`;

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
    timeDisplay.textContent = '10:00';
    setRing(1);
    ringFg.classList.add('done');
    statusText.textContent = i18n('statusCompleted');
    statusText.className = 'done';
    return;
  }

  // In progress — ring fills as active time accumulates
  ringFg.classList.remove('done');
  const activeSecs = computeActiveSecs(data);
  timeDisplay.textContent = fmtSecs(activeSecs);
  setRing(activeSecs / TOTAL_SECS);

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
    'streak', 'weeklyCount',
  ]);
  render(data);
}

// Live display: poll every second
setInterval(refresh, 1000);
refresh();

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  startBtn.textContent = i18n('btnStarting');
  chrome.runtime.sendMessage({ action: 'startNow' }, () => setTimeout(refresh, 400));
});
