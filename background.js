const CHATGPT_URL    = 'https://chatgpt.com';
const ALARM_HEARTBEAT = 'heartbeat';
const ALARM_REMINDER  = 'evening-reminder';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Returns the Monday of the week containing dateStr (used as freeze week key)
function weekKey(dateStr) {
  const d   = new Date(dateStr);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

async function getSettings() {
  const data = await chrome.storage.local.get({
    practiceMins: 10, reminderTime: '20:00', streakFreezeEnabled: true,
  });
  return {
    requiredSecs: data.practiceMins * 60,
    reminderTime: data.reminderTime,
    streakFreezeEnabled: data.streakFreezeEnabled,
  };
}

// ── Badge ──────────────────────────────────────────────────

async function updateBadge() {
  const [data, { requiredSecs }] = await Promise.all([
    chrome.storage.local.get([
      'lastSessionDate', 'sessionCompleted',
      'accumulatedActiveSecs', 'activeStart', 'streak',
    ]),
    getSettings(),
  ]);
  const today = todayStr();

  if (data.sessionCompleted) {
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    chrome.action.setBadgeText({ text: String(data.streak || 1) });
  } else if (data.lastSessionDate === today) {
    const secs     = computeActiveSecs(data, requiredSecs);
    const minsLeft = Math.ceil((requiredSecs - secs) / 60);
    chrome.action.setBadgeBackgroundColor({ color: '#3b82f6' });
    chrome.action.setBadgeText({ text: `${minsLeft}m` });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    chrome.action.setBadgeText({ text: '!' });
  }
}

function computeActiveSecs(data, cap) {
  let total = data.accumulatedActiveSecs || 0;
  if (data.activeStart) total += (Date.now() - data.activeStart) / 1000;
  return Math.min(total, cap);
}

// ── Daily prompt notification ──────────────────────────────

async function showDailyPrompt() {
  const today = todayStr();
  const data  = await chrome.storage.local.get(['lastSessionDate', 'promptShownDate']);
  if (data.lastSessionDate === today) return;   // already started
  if (data.promptShownDate === today) return;   // already shown today

  await chrome.storage.local.set({ promptShownDate: today });
  chrome.notifications.create('daily-prompt', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: chrome.i18n.getMessage('notifPromptTitle'),
    message: chrome.i18n.getMessage('notifPromptMsg'),
    buttons: [{ title: chrome.i18n.getMessage('notifPromptBtn') }],
    requireInteraction: true,
    priority: 2,
  });
}

// ── Begin session (called when user clicks notification or popup btn) ──

async function beginSession() {
  const today = todayStr();
  const { lastSessionDate } = await chrome.storage.local.get('lastSessionDate');
  if (lastSessionDate === today) return;
  await chrome.storage.local.set({ lastSessionDate: today });

  chrome.notifications.clear('daily-prompt');

  // Reuse existing ChatGPT tab if one is already open
  const existing = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
  let tab;
  if (existing.length > 0) {
    tab = existing[0];
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });
  } else {
    tab = await chrome.tabs.create({ url: CHATGPT_URL, active: true });
  }

  await chrome.storage.local.set({
    sessionCompleted: false,
    chatGptTabId: tab.id,
    accumulatedActiveSecs: 0,
    activeStart: Date.now(),
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
  const [data, { requiredSecs }] = await Promise.all([
    chrome.storage.local.get([
      'lastSessionDate', 'sessionCompleted', 'chatGptTabId',
      'accumulatedActiveSecs', 'activeStart',
    ]),
    getSettings(),
  ]);
  const today = todayStr();
  if (data.lastSessionDate !== today || data.sessionCompleted) return;

  const now         = Date.now();
  let accumulated   = data.accumulatedActiveSecs || 0;
  if (data.activeStart) accumulated += (now - data.activeStart) / 1000;
  accumulated = Math.min(accumulated, requiredSecs);

  const isGpt = tabId === data.chatGptTabId;
  await chrome.storage.local.set({
    accumulatedActiveSecs: Math.floor(accumulated),
    activeStart: isGpt ? now : null,
  });

  if (accumulated >= requiredSecs) {
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

  const { requiredSecs } = await getSettings();
  const accumulated = Math.min(
    (data.accumulatedActiveSecs || 0) + (Date.now() - data.activeStart) / 1000,
    requiredSecs,
  );
  await chrome.storage.local.set({ accumulatedActiveSecs: Math.floor(accumulated), activeStart: null });
  updateBadge();
}

// ── Listeners ──────────────────────────────────────────────

chrome.runtime.onStartup.addListener(async () => {
  scheduleEveningReminder();
  await showDailyPrompt();
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await pauseTracking();
    return;
  }
  await showDailyPrompt();
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

// Reschedule reminder and re-check completion when settings change
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.reminderTime) {
    await scheduleEveningReminder();
  }
  if (changes.practiceMins) {
    const requiredSecs = (changes.practiceMins.newValue || 10) * 60;
    const data = await chrome.storage.local.get([
      'lastSessionDate', 'sessionCompleted', 'accumulatedActiveSecs', 'activeStart',
    ]);
    if (data.lastSessionDate === todayStr() && !data.sessionCompleted) {
      const secs = computeActiveSecs(data, requiredSecs);
      if (secs >= requiredSecs) {
        await completeSession(data);
        return;
      }
    }
    updateBadge();
  }
});

// ── Alarms ─────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_HEARTBEAT) {
    const [data, { requiredSecs }] = await Promise.all([
      chrome.storage.local.get([
        'lastSessionDate', 'sessionCompleted', 'chatGptTabId',
        'accumulatedActiveSecs', 'activeStart',
      ]),
      getSettings(),
    ]);
    const today = todayStr();
    if (data.lastSessionDate !== today || data.sessionCompleted) {
      chrome.alarms.clear(ALARM_HEARTBEAT);
      return;
    }
    if (data.chatGptTabId && data.activeStart) {
      try {
        const tab   = await chrome.tabs.get(data.chatGptTabId);
        const [win] = await chrome.windows.query({ focused: true });
        if (tab.active && win && tab.windowId === win.id) {
          const now         = Date.now();
          const accumulated = Math.min(
            (data.accumulatedActiveSecs || 0) + (now - data.activeStart) / 1000,
            requiredSecs,
          );
          await chrome.storage.local.set({
            accumulatedActiveSecs: Math.floor(accumulated),
            activeStart: now,
          });
          if (accumulated >= requiredSecs) {
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

// ── Evening reminder ───────────────────────────────────────

async function scheduleEveningReminder() {
  const { reminderTime } = await chrome.storage.local.get({ reminderTime: '20:00' });
  const [hour, min] = reminderTime.split(':').map(Number);

  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, min, 0, 0);
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

// ── Notification clicks ────────────────────────────────────

chrome.notifications.onClicked.addListener((id) => {
  if (id === 'daily-prompt') beginSession();
});

chrome.notifications.onButtonClicked.addListener((id) => {
  if (id === 'daily-prompt') beginSession();
});

// ── Popup messages ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.action === 'startNow') {
    chrome.storage.local.remove('lastSessionDate', () => {
      beginSession().then(() => respond({ ok: true }));
    });
    return true;
  }
});

// ── Stats ──────────────────────────────────────────────────

async function recalcStats(today, prevData) {
  const { completedDays } = await chrome.storage.local.get('completedDays');
  const days = completedDays || {};
  days[today] = true;

  // Streak (with optional freeze)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr      = yesterday.toISOString().slice(0, 10);
  const prevStreak = prevData.streak || 0;
  let streak;

  if (days[yStr]) {
    streak = prevStreak + 1;
  } else if (prevStreak > 0) {
    const { streakFreezeEnabled = true, freezeUsedWeek } =
      await chrome.storage.local.get({ streakFreezeEnabled: true, freezeUsedWeek: null });
    const thisWeek = weekKey(today);
    if (streakFreezeEnabled && freezeUsedWeek !== thisWeek) {
      streak = prevStreak; // freeze consumed — keep streak
      await chrome.storage.local.set({ freezeUsedWeek: thisWeek });
      chrome.notifications.create('freeze', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: chrome.i18n.getMessage('notifFreezeTitle'),
        message: chrome.i18n.getMessage('notifFreezeMsg', String(prevStreak)),
      });
    } else {
      streak = 1;
    }
  } else {
    streak = 1;
  }

  // Weekly count
  const todayDate   = new Date(today);
  const dow         = todayDate.getDay();
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  let weeklyCount   = 0;
  for (let i = 0; i <= daysFromMon; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - i);
    if (days[d.toISOString().slice(0, 10)]) weeklyCount++;
  }

  // Prune entries older than 90 days
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(days)) {
    if (key < cutoffStr) delete days[key];
  }

  await chrome.storage.local.set({ completedDays: days, streak, weeklyCount });
}
