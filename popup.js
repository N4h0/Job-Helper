import { scraperMap } from './scraperMap.js'; // auto-generated map

// Define presets as functions to inject job-specific data (role and word count)
const llmPresets = {
  'Cover letter – structure 1': (job) => `To compose a compelling cover letter for the position of ${job.stillingstittel || job.role || 'the role'}, you must scrutinise the job description for key qualifications. Begin with a succinct introduction about the candidate's identity and career goals. Highlight skills aligned with the job, underpinned by tangible examples. Incorporate details about the company, emphasising its mission or unique aspects that align with the candidate's values. Conclude by reaffirming the candidate's suitability, inviting further discussion. Use job-specific terminology for a tailored and impactful letter. Please provide your response in under ${job.llmSettings.maxLength} words.`
};

// Added 'kjemi' as a new CV option
const cvOptions = ['simple', 'systemdev', 'webdev', 'kjemi'];

// Add event listener to the options button
document.getElementById('options-button').addEventListener('click', () => {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    // fallback for older MV2
    window.open(chrome.runtime.getURL('options.html'), '_blank');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const result = document.getElementById('result');

  // Listen for scraped job data
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "jobScraped") {
      const job = message.payload;

      

      // Initialize LLM settings
      job.llmSettings = {
        språk: 'nynorsk',
        tone: 'profesjonell',
        model: 'gpt-4',
        resumePreset: 'simple',
        cvFile: 'simple.txt',
        maxLength: 350
      };
      job.llmSettings.prompt = llmPresets['Cover letter – structure 1'](job);

      job.generatedDocId = '';
      job.booleanGenerateCoverLetter = true;
      job.booleanCV = false;

      // Render UI
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
        <div id="statusMessage" style="margin-top: 12px; font-weight: bold;"></div>
      `;

      // Cache DOM nodes
      const tabLLM = document.getElementById('tabLLM');
      const tabJob = document.getElementById('tabJob');
      const jobForm = document.getElementById('jobForm');
      const llmSettingsTab = document.getElementById('llmSettingsTab');
      const statusMessage = document.getElementById('statusMessage');

      // Tab switching
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

      // Populate LLM settings tab
      llmSettingsTab.innerHTML = `
        <label>- språk:</label><br>
        <select id="llmLang" style="width:100%;margin-bottom:10px;">
          <option value="nynorsk">nynorsk</option>
          <option value="bokmål">bokmål</option>
          <option value="engelsk">engelsk</option>
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
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4.1">gpt-4.1</option>
          <option value="gpt-4.5-preview">gpt-4.5 preview</option>
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
        </select><br>

        <label>- Cover letter structure:</label><br>
        <select id="llmPrompt" style="width:100%;margin-bottom:10px;"></select>
        <details style="margin-bottom:10px;"><summary>Vis promptinnhold</summary>
          <pre id="promptPreview" style="white-space:pre-wrap;padding:8px;border:1px solid #ccc;background:#f9f9f9;"></pre>
        </details>

        <label>- CV:</label><br>
        <select id="resumePrompt" style="width:100%;margin-bottom:10px;"></select><br>

        <label>- Maks lengde (ord):</label><br>
        <input type="number" id="llmMaxLength" value="350" min="100" style="width:100%;margin-bottom:10px;"><br>
        <label style="display:flex;align-items:center;margin-bottom:6px;">
        <input type="checkbox" id="checkboxGenerateCoverLetter" style="margin-right:8px;" checked>
        Generer søknad
        </label>

        <label style="display:flex;align-items:center;margin-bottom:10px;">
        <input type="checkbox" id="checkboxGenerateCV" style="margin-right:8px;">
        Generer CV
        </label>
      `;

      // Helpers to update prompt preview
      const setPromptPreview = (value) => {
        document.getElementById('promptPreview').textContent = llmPresets[value](job);
      };

      // Wire up LLM settings inputs
      document.getElementById('llmMaxLength').addEventListener('input', e => {
        job.llmSettings.maxLength = parseInt(e.target.value, 10) || 350;
        job.llmSettings.prompt = llmPresets['Cover letter – structure 1'](job);
        setPromptPreview('Cover letter – structure 1');
      });

      const llmPromptSelect = document.getElementById('llmPrompt');
      Object.keys(llmPresets).forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        llmPromptSelect.appendChild(option);
      });
      llmPromptSelect.value = 'Cover letter – structure 1';
      setPromptPreview('Cover letter – structure 1');
      llmPromptSelect.addEventListener('change', e => {
        job.llmSettings.prompt = llmPresets[e.target.value](job);
        setPromptPreview(e.target.value);
      });

      const resumePromptSelect = document.getElementById('resumePrompt');
      cvOptions.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        resumePromptSelect.appendChild(option);
      });
      resumePromptSelect.value = job.llmSettings.resumePreset;
      resumePromptSelect.addEventListener('change', e => {
        job.llmSettings.resumePreset = e.target.value;
        job.llmSettings.cvFile = `${e.target.value}.txt`;
      });

      // Checkbox change handlers
      document.getElementById('checkboxGenerateCoverLetter').addEventListener('change', e => {
        job.booleanGenerateCoverLetter = e.target.checked;
      });
      document.getElementById('checkboxGenerateCV').addEventListener('change', e => {
        job.booleanCV = e.target.checked;
      });

      ['llmLang', 'llmTone', 'llmModel'].forEach(id => {
        document.getElementById(id).addEventListener('change', e => {
          const keyMap = { llmLang: 'språk', llmTone: 'tone', llmModel: 'model' };
          job.llmSettings[keyMap[id]] = e.target.value;
        });
      });

      // Build job info form fields
      Object.entries(job).forEach(([key, value]) => {
        if (key === 'llmSettings') return;
        const isMultiline = ['pros','cons','notat','stegVidere'].includes(key);
        const fieldContainer = document.createElement('div');
        fieldContainer.style.marginBottom = '8px';
        const	label = document.createElement('label');
        label.textContent = `- ${key}:`;
        label.style.display = 'block';
        const input = isMultiline ? document.createElement('textarea') : document.createElement('input');
        input.value = value || '';
        input.name = key;
        input.style.width = '100%';
        input.addEventListener('input', e => {
          job[key] = e.target.value;
          job.llmSettings.prompt = llmPresets['Cover letter – structure 1'](job);
          setPromptPreview('Cover letter – structure 1');
        });
        fieldContainer.append(label, input);
        jobForm.appendChild(fieldContainer);
      });

      // Create Send button, disabled until HTML is gathered
      const submitBtn = document.createElement('button');
      submitBtn.textContent = '📤 Send to Google Sheets';
      submitBtn.style.marginTop = '12px';
      submitBtn.disabled = true;
      submitBtn.addEventListener('click', () => {
        statusMessage.textContent = 'Sending...';
        fetch('http://localhost:3000/submit-job', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(job)
        })
          .then(res => res.json())
          .then(data => statusMessage.textContent = data.status || '✅ Sent successfully')
          .catch(err => { console.error(err); statusMessage.textContent = '❌ Failed to send job. Please try again later.'; });
      });
      result.appendChild(submitBtn);

      // Retrieve page HTML within the same scope
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0].id;
        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => document.documentElement.outerHTML
        }, (injectionResults) => {
          if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
            console.error('Injection failed:', chrome.runtime.lastError);
            statusMessage.textContent = '❌ Failed to grab page HTML.';
            return;
          }
          job.htmlContent = injectionResults[0].result;
          submitBtn.disabled = false;
          statusMessage.textContent = '';
        });
      });
    }
  });

  // Run scraper if available
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      const url = new URL(currentTab.url);
      const hostname = url.hostname.replace('www.', '');
      const scraper = scraperMap[hostname];
      if (scraper) {
        result.textContent = `✅ Recognized ${hostname}, running scraper...`;
        chrome.scripting.executeScript({ target: { tabId: currentTab.id }, func: scraper });
      } else {
        result.textContent = `❌ No scraper available for ${hostname}.`;
      }
    } else {
      result.textContent = "❓ Couldn't detect current tab.";
    }
  });
});
