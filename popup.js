import { scraperMap } from './scraperMap.js'; // auto-generated map

document.addEventListener('DOMContentLoaded', () => {
  const result = document.getElementById('result');

  // ✅ Listen for scraped job result
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "jobScraped") {
      const job = message.payload;

      // Add default LLM settings
      job.llmSettings = {
        språk: 'Norwegian nynorsk',
        tone: 'profesjonell',
        model: 'gpt-4',
        includeProsCons: true
      };

      // Clear previous output and add tabs
      result.innerHTML = `
        <h3>✅ New Job scraped – edit before sending:</h3>
        <div id="tabContainer">
          <div id="tabButtons" style="margin-bottom: 12px;">
            <button id="tabLLM" class="active-tab">🤖 LLM Settings</button>
            <button id="tabJob">📋 Job Info</button>
          </div>
          <div id="tabContent">
            <div id="llmSettingsTab"></div>
            <div id="jobForm" style="display:none;"></div>
          </div>
        </div>
      `;

      const tabLLM = document.getElementById('tabLLM');
      const tabJob = document.getElementById('tabJob');
      const jobForm = document.getElementById('jobForm');
      const llmSettingsTab = document.getElementById('llmSettingsTab');

      tabLLM.addEventListener('click', () => {
        tabLLM.classList.add('active-tab');
        tabJob.classList.remove('active-tab');
        llmSettingsTab.style.display = 'block';
        jobForm.style.display = 'none';
      });

      tabJob.addEventListener('click', () => {
        tabJob.classList.add('active-tab');
        tabLLM.classList.remove('active-tab');
        jobForm.style.display = 'block';
        llmSettingsTab.style.display = 'none';
      });

      // ✅ Render LLM Settings Tab
      llmSettingsTab.innerHTML = `
        <label>- språk:</label><br>
        <select id="llmLang" style="width:100%;margin-bottom:10px;">
          <option value="Norwegian nynorsk">nynorsk</option>
          <option value="Norwegian bokmål">bokmål</option>
          <option value="English">engelsk</option>
        </select><br>

        <label>- tone:</label><br>
        <select id="llmTone" style="width:100%;margin-bottom:10px;">
          <option value="profesjonell">profesjonell</option>
          <option value="formell">formell</option>
          <option value="vennlig">vennlig</option>
        </select><br>

        <label>- Modell:</label><br>
        <select id="llmModel" style="width:100%;margin-bottom:10px;">
          <option value="gpt-4">gpt-4</option>
          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
        </select><br>

        <label><input type="checkbox" id="includeProsCons" checked> Ta med pros/cons i prompt</label>
      `;

      document.getElementById('llmLang').addEventListener('change', e => job.llmSettings.språk = e.target.value);
      document.getElementById('llmTone').addEventListener('change', e => job.llmSettings.tone = e.target.value);
      document.getElementById('llmModel').addEventListener('change', e => job.llmSettings.model = e.target.value);
      document.getElementById('includeProsCons').addEventListener('change', e => job.llmSettings.includeProsCons = e.target.checked);

      // ✅ Create Job Info Fields
      Object.entries(job).forEach(([key, value]) => {
        if (key === 'språk' || key === 'llmSettings') return; // Already handled

        const isMultiline = ['pros', 'cons', 'notat', 'stegVidere'].includes(key);

        const fieldContainer = document.createElement('div');
        fieldContainer.style.marginBottom = '8px';

        const label = document.createElement('label');
        label.textContent = `- ${key}:`;
        label.style.display = 'block';

        const input = isMultiline
          ? document.createElement('textarea')
          : document.createElement('input');

        input.value = value;
        input.name = key;
        input.style.width = '100%';

        input.addEventListener('input', (e) => {
          job[key] = e.target.value;
        });

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(input);
        jobForm.appendChild(fieldContainer);
      });

      // ✅ Capture full HTML of the tab and attach it to job.htmlContent
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0].id;

        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => document.documentElement.outerHTML
        }, (injectionResults) => {
          const html = injectionResults[0].result;
          job.htmlContent = html;

          const submitBtn = document.createElement('button');
          submitBtn.textContent = '📤 Send to Google Sheets';
          submitBtn.style.marginTop = '12px';

          submitBtn.addEventListener('click', () => {
            fetch('http://localhost:3000/submit-job', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(job)
            })
              .then(res => res.json())
              .then(data => {
                alert(data.status || '✅ Sent!');
              })
              .catch(err => {
                console.error(err);
                alert('❌ Failed to send job to Google Sheets.');
              });
          });

          result.appendChild(submitBtn);
        });
      });
    }
  });

  // ✅ Automatically run scraper on popup open
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];

    if (currentTab && currentTab.url) {
      const url = new URL(currentTab.url);
      const hostname = url.hostname.replace('www.', '');

      const scraper = scraperMap[hostname];

      if (scraper) {
        result.textContent = `✅ Recognized ${hostname}, running scraper...`;

        chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: scraper
        });
      } else {
        result.textContent = `❌ No scraper available for ${hostname}.`;
      }
    } else {
      result.textContent = "❓ Couldn't detect current tab.";
    }
  });
});
