// options.js
const form = document.getElementById('settings-form');
const saveBtn = document.getElementById('save-btn');

// 1) Define your settings schema
const fields = [
  // ←— Just the one Google-Sheets setting:
  { key: 'spreadsheetId', label: 'Google Spreadsheet ID', type: 'text' },
  { key: 'jobJSONObjects',      label: 'jobJSONObjects',      type: 'text' },
  { key: 'oldContentFiles',     label: 'oldContentFiles',     type: 'text' },
  { key: 'JobbutlysningerHTML',  label: 'Jobbutlysninger HTML', type: 'text' },
  { key: 'Søknader',            label: 'Søknader',             type: 'text' },
  { key: 'CVer',                label: 'CVer',                 type: 'text' },
];

// 2) Build the form
fields.forEach(({ key, label, type }) => {
  const lbl = document.createElement('label');
  lbl.textContent = label;
  lbl.htmlFor     = key;

  const input = document.createElement('input');
  input.type      = type;
  input.id        = key;
  input.name      = key;

  form.append(lbl, input);
});

// 3) Load defaults from your static options.json
async function loadDefaults() {
  const url = chrome.runtime.getURL('options.json');
  try {
    const resp     = await fetch(url);
    const defaults = await resp.json();
    fields.forEach(f => {
      if (defaults[f.key] != null) {
        document.getElementById(f.key).value = defaults[f.key];
      }
    });
  } catch (err) {
    console.warn('Could not load options.json', err);
  }
}

// 4) Overlay any saved user-overrides
function loadSaved() {
  chrome.storage.sync.get(fields.map(f => f.key), prefs => {
    fields.forEach(f => {
      if (prefs[f.key] != null) {
        document.getElementById(f.key).value = prefs[f.key];
      }
    });
  });
}

// 5) Save back to storage
saveBtn.addEventListener('click', () => {
  const toSave = {};
  fields.forEach(f => {
    const val = document.getElementById(f.key).value;
    toSave[f.key] = f.type === 'number' ? Number(val) : val;
  });
  chrome.storage.sync.set(toSave, () => {
    saveBtn.textContent = 'Saved!';
    setTimeout(() => saveBtn.textContent = 'Save', 1500);
  });
});

// init
(async () => {
  await loadDefaults();
  loadSaved();
})();