const i18n = (key, ...subs) => chrome.i18n.getMessage(key, subs);

document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
document.title = `Daily English Gate — ${i18n('settingsTitle')}`;

const durationInput = document.getElementById('duration-input');
const reminderInput = document.getElementById('reminder-time');
const savedMsg      = document.getElementById('saved-msg');

let saveTimer = null;

function showSaved() {
  savedMsg.classList.remove('hidden');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savedMsg.classList.add('hidden'), 2000);
}

// Load saved settings
chrome.storage.local.get({ practiceMins: 10, reminderTime: '20:00' }, (data) => {
  durationInput.value = data.practiceMins;
  reminderInput.value = data.reminderTime;
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
