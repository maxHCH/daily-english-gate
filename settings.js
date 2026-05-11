const i18n = (key, ...subs) => chrome.i18n.getMessage(key, subs);

// Apply static translations
document.querySelectorAll('[data-i18n]').forEach(el => {
  el.textContent = i18n(el.dataset.i18n);
});
document.title = `Daily English Gate — ${i18n('settingsTitle')}`;

const reminderInput = document.getElementById('reminder-time');
const savedMsg      = document.getElementById('saved-msg');
const segBtns       = document.querySelectorAll('.seg-btn');

let saveTimer = null;

function showSaved() {
  savedMsg.classList.remove('hidden');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => savedMsg.classList.add('hidden'), 2000);
}

function setActiveDuration(mins) {
  segBtns.forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) === mins);
  });
}

// Load saved settings
chrome.storage.local.get({ practiceMins: 10, reminderTime: '20:00' }, (data) => {
  setActiveDuration(data.practiceMins);
  reminderInput.value = data.reminderTime;
});

// Duration buttons
segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mins = Number(btn.dataset.value);
    setActiveDuration(mins);
    chrome.storage.local.set({ practiceMins: mins }, showSaved);
  });
});

// Reminder time
reminderInput.addEventListener('change', () => {
  chrome.storage.local.set({ reminderTime: reminderInput.value }, showSaved);
});
