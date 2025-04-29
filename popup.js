import { scraperMap } from './scraperMap.js'; // auto-generated map

document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('checkButton');
  const result = document.getElementById('result');

  // ✅ Listen for scraped job result
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "jobScraped") {
      const job = message.payload;

      // Clear previous output
      result.innerHTML = `<h3>✅ New Job scraped – edit before sending:</h3><div id="jobForm"></div>`;
      const formContainer = document.getElementById('jobForm');

      // ✅ Create form fields
      Object.entries(job).forEach(([key, value]) => {
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
        formContainer.appendChild(fieldContainer);
      });

      // ✅ Add the submit button once
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

      // ✅ Download the full HTML of the page
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTabId = tabs[0].id;

        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func: () => document.documentElement.outerHTML
        }, (injectionResults) => {
          const html = injectionResults[0].result;
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);

          // Get the current month (01, 02, ..., 12)
          const currentMonth = new Date().toLocaleString('default', { month: '2-digit' });

          // Get the current year (e.g., 2025)
          const currentYear = new Date().getFullYear();

          // Sanitize job title and company name for safe filename
          const safeTitle = (job.stillingstittel || 'job').replace(/[\/\\:*?"<>|]/g, '-');
          const safeFirma = (job.firma || 'company').replace(/[\/\\:*?"<>|]/g, '-');

          // Append current year and month to filename
          const filename = `${safeFirma}_${safeTitle}_${currentMonth}_${currentYear}.html`;

          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
      });
    }
  });

  // ✅ Only run scraper on button click
  button.addEventListener('click', () => {
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
});