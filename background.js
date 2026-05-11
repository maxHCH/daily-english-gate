const CHATGPT_URL = 'https://chatgpt.com';
const REQUIRED_ACTIVE_SECS = 600; // 10 minutes of active ChatGPT tab time
const ALARM_HEARTBEAT = 'heartbeat';
const ALARM_REMINDER  = 'evening-reminder';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Badge ──────────────────────────────────────────────────

async function updateBadge() {
  const data = await chrome.storage.local.get([
    'lastSessionDate', 'sessionCompleted',
    'accumulatedActiveSecs', 'activeStart', 'streak',
  ]);
  const today = todayStr();

  if (data.sessionCompleted) {
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    chrome.action.setBadgeText({ text: String(data.streak || 1) });
  } else if (data.lastSessionDate === today) {
    const secs = computeActiveSecs(data);
    const minsLeft = Math.ceil((REQUIRED_ACTIVE_SECS - secs) / 60);
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    chrome.action.setBadgeText({ text: `${minsLeft}m` });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.action.setBadgeText({ text: '!' });
  }
}

function computeActiveSecs(data) {
  let total = data.accumulatedActiveSecs || 0;
  if (data.activeStart) total += (Date.now() - data.activeStart) / 1000;
  return Math.min(total, REQUIRED_ACTIVE_SECS);
}

// ── Session start ──────────────────────────────────────────

async function startSession() {
  const today = todayStr();
  // Write date first to prevent race between onStartup + onFocusChanged
  const { lastSessionDate } = await chrome.storage.local.get('lastSessionDate');
  if (lastSessionDate === today) return;
  await chrome.storage.local.set({ lastSessionDate: today });

  const tab = await chrome.tabs.create({ url: CHATGPT_URL, active: true });
  await chrome.storage.local.set({
    sessionCompleted: false,
    chatGptTabId: tab.id,
    accumulatedActiveSecs: 0,
    activeStart: Date.now(), // newly created tab is immediately active
  });

  chrome.alarms.create(ALARM_HEARTBEAT, { periodInMinutes: 1 });
  updateBadge();
}

// ── Complete session ───────────────────────────────────────

async function completeSession(data) {
  await chrome.storage.local.set({ sessionCompleted: true, activeStart: null });
  chrome.alarms.clear(ALARM_HEARTBEAT);

  const today = todayStr();
  await recalcStats(today, data);

  const { streak } = await chrome.storage.local.get('streak');
  chrome.notifications.create('complete', {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: chrome.i18n.getMessage('notifCompleteTitle'),
    message: chrome.i18n.getMessage('notifCompleteMsg', String(streak)),
  });
  updateBadge();
}

// ── Active-time tracking ───────────────────────────────────

async function onActiveTabChanged(tabId) {
  const data = await chrome.storage.local.get([
    'lastSessionDate', 'sessionCompleted', 'chatGptTabId',
    'accumulatedActiveSecs', 'activeStart',
  ]);
  const today = todayStr();
  if (data.lastSessionDate !== today || data.sessionCompleted) return;

  const now = Date.now();
  let accumulated = data.accumulatedActiveSecs || 0;
  if (data.activeStart) accumulated += (now - data.activeStart) / 1000;
  accumulated = Math.min(accumulated, REQUIRED_ACTIVE_SECS);

  const isGpt = tabId === data.chatGptTabId;
  await chrome.storage.local.set({
    accumulatedActiveSecs: Math.floor(accumulated),
    activeStart: isGpt ? now : null,
  });

  if (accumulated >= REQUIRED_ACTIVE_SECS) {
    await completeSession({ ...data, accumulatedActiveSecs: accumulated });
    return;
  }
  updateBadge();
}

async function pauseTracking() {
  const data = await chrome.storage.local.get([
    'lastSessionDate', 'sessionCompleted', 'accumulatedActiveSecs', 'activeStart',
  ]);
  const today = todayStr();
  if (data.lastSessionDate !== today || data.sessionCompleted || !data.activeStart) return;

  const accumulated = Math.min(
    (data.accumulatedActiveSecs || 0) + (Date.now() - data.activeStart) / 1000,
    REQUIRED_ACTIVE_SECS,
  );
  await chrome.storage.local.set({ accumulatedActiveSecs: Math.floor(accumulated), activeStart: null });
  updateBadge();
}

// ── Listeners ──────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  scheduleEveningReminder();
  await startSession();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await pauseTracking();
    return;
  }
  await startSession();
  const [tab] = await chrome.tabs.query({ active: true, windowId });
  if (tab) await onActiveTabChanged(tab.id);
});

chrome.tabs.onActivated.addListener(({ tabId }) => onActiveTabChanged(tabId));

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { chatGptTabId } = await chrome.storage.local.get('chatGptTabId');
  if (tabId !== chatGptTabId) return;
  await pauseTracking();
  await chrome.storage.local.set({ chatGptTabId: null });
});

// ── Alarms ─────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_HEARTBEAT) {
    const data = await chrome.storage.local.get([
      'lastSessionDate', 'sessionCompleted', 'chatGptTabId',
      'accumulatedActiveSecs', 'activeStart',
    ]);
    const today = todayStr();
    if (data.lastSessionDate !== today || data.sessionCompleted) {
      chrome.alarms.clear(ALARM_HEARTBEAT);
      return;
    }
    if (data.chatGptTabId && data.activeStart) {
      try {
        const tab = await chrome.tabs.get(data.chatGptTabId);
        // Only accumulate if ChatGPT tab is the active tab in a focused window
        const [win] = await chrome.windows.query({ focused: true });
        if (tab.active && win && tab.windowId === win.id) {
          const now = Date.now();
          const accumulated = Math.min(
            (data.accumulatedActiveSecs || 0) + (now - data.activeStart) / 1000,
            REQUIRED_ACTIVE_SECS,
          );
          await chrome.storage.local.set({
            accumulatedActiveSecs: Math.floor(accumulated),
            activeStart: now,
          });
          if (accumulated >= REQUIRED_ACTIVE_SECS) {
            await completeSession({ ...data, accumulatedActiveSecs: accumulated });
            return;
          }
        }
      } catch {
        await chrome.storage.local.set({ activeStart: null, chatGptTabId: null });
      }
    }
    updateBadge();
  }

  if (alarm.name === ALARM_REMINDER) {
    const data = await chrome.storage.local.get(['lastSessionDate', 'sessionCompleted', 'streak']);
    if (data.lastSessionDate === todayStr() && data.sessionCompleted) return;
    chrome.notifications.create('reminder', {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: chrome.i18n.getMessage('notifReminderTitle'),
      message: chrome.i18n.getMessage('notifReminderMsg', String(data.streak || 0)),
    });
  }
});

// ── Evening reminder setup ─────────────────────────────────

function scheduleEveningReminder() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(20, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  chrome.alarms.create(ALARM_REMINDER, {
    when: next.getTime(),
    periodInMinutes: 24 * 60,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleEveningReminder();
  updateBadge();
});

// ── Popup messages ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.action === 'startNow') {
    chrome.storage.local.remove('lastSessionDate', () => {
      startSession().then(() => respond({ ok: true }));
    });
    return true;
  }
});

// ── Stats ──────────────────────────────────────────────────

async function recalcStats(today, prevData) {
  const { completedDays } = await chrome.storage.local.get('completedDays');
  const days = completedDays || {};
  days[today] = true;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const streak = days[yStr] ? (prevData.streak || 0) + 1 : 1;

  const todayDate  = new Date(today);
  const dow        = todayDate.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  let weeklyCount  = 0;
  for (let i = 0; i <= daysFromMon; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    if (days[d.toISOString().slice(0, 10)]) weeklyCount++;
  }

  await chrome.storage.local.set({ completedDays: days, streak, weeklyCount });
}
