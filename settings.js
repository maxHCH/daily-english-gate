const i18n = (key, ...subs) => chrome.i18n.getMessage(key, subs);

document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
document.title = `Daily English Gate — ${i18n('settingsTitle')}`;

const durationInput = document.getElementById('duration-input');
const reminderInput = document.getElementById('reminder-time');
const promptInput   = document.getElementById('prompt-input');
const topicsToggle  = document.getElementById('topics-toggle');
const freezeToggle  = document.getElementById('freeze-toggle');
const savedMsg      = document.getElementById('saved-msg');

const DEFAULT_PROMPT =
  "Let's have a 10-minute English conversation practice. " +
  "Please start by asking me a casual question to get us going.";

let saveTimer = null;

function showSaved() {
  savedMsg.classList.remove('hidden');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savedMsg.classList.add('hidden'), 2000);
}

// Load saved settings
chrome.storage.local.get({
  practiceMins: 10, reminderTime: '20:00',
  customPrompt: '', topicsEnabled: true,
  streakFreezeEnabled: true,
}, (data) => {
  durationInput.value   = data.practiceMins;
  reminderInput.value   = data.reminderTime;
  promptInput.value     = data.customPrompt || DEFAULT_PROMPT;
  topicsToggle.checked  = data.topicsEnabled;
  freezeToggle.checked  = data.streakFreezeEnabled;
});

// Duration: validate and save on change
durationInput.addEventListener('change', () => {
  let val = parseInt(durationInput.value, 10);
  if (isNaN(val) || val < 1)  val = 1;
  if (val > 60)               val = 60;
  durationInput.value = val;
  durationInput.classList.remove('error');
  chrome.storage.local.set({ practiceMins: val }, showSaved);
});

durationInput.addEventListener('input', () => {
  const val = parseInt(durationInput.value, 10);
  durationInput.classList.toggle('error', isNaN(val) || val < 1 || val > 60);
});

// Reminder time
reminderInput.addEventListener('change', () => {
  chrome.storage.local.set({ reminderTime: reminderInput.value }, showSaved);
});

// Prompt textarea (save on blur)
promptInput.addEventListener('blur', () => {
  const val = promptInput.value.trim();
  chrome.storage.local.set({ customPrompt: val }, showSaved);
});

// Topics toggle
topicsToggle.addEventListener('change', () => {
  chrome.storage.local.set({ topicsEnabled: topicsToggle.checked }, showSaved);
});

// Streak freeze toggle
freezeToggle.addEventListener('change', () => {
  chrome.storage.local.set({ streakFreezeEnabled: freezeToggle.checked }, showSaved);
});
