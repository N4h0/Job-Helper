export function runFinnScraper() {
  console.log("Running scraper inside the page...");

  // ✅ Utility: Convert date to dd/mm/yyyy from both `dd.mm.yyyy` and `1. januar 2025`
  function formatDate(rawDate) {
    const clean = rawDate.replace(/\u00A0/g, ' ').trim(); // Replace non-breaking spaces

    const numericMatch = clean.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$/);
    if (numericMatch) {
      const [, day, month, year] = numericMatch;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    const textMatch = clean.match(/^(\d{1,2})\.\s*([a-zæøå]+)\s+(\d{4})$/i);
    if (textMatch) {
      const [, day, monthName, year] = textMatch;
      const months = {
        januar: '01', februar: '02', mars: '03', april: '04', mai: '05', juni: '06',
        juli: '07', august: '08', september: '09', oktober: '10', november: '11', desember: '12'
      };
      const month = months[monthName.toLowerCase()];
      if (month) return `${day.padStart(2, '0')}/${month}/${year}`;
    }

    return rawDate;
  }




  // Stillingstittel
  const heading = document.querySelector('h2');
  const stillingstittel = heading ? heading.textContent.trim() : '';

  // Firma
  const firmaElement = document.querySelector('section.space-y-16 > p');
  const firma = firmaElement ? firmaElement.textContent.trim() : '';

  // Frist
  const allLiElements = document.querySelectorAll('li.flex.flex-col');
  let frist = '';
  allLiElements.forEach(li => {
    if (li.textContent.includes('Frist')) {
      const span = li.querySelector('span.font-bold');
      if (span) {
        const rawFrist = span.textContent ? span.textContent.trim() : '';
        frist = formatDate(rawFrist);
      }
    }
  });

  // Stilling opprettet
  const allLiGapElements = document.querySelectorAll('li.flex.gap-x-16');
  let stillingOpprettet = '';
  allLiGapElements.forEach(li => {
    if (li.textContent.includes('Sist endret')) {
      const time = li.querySelector('time');
      if (time) {
        const fullText = time.textContent ? time.textContent.trim() : '';
        const datePart = fullText.split(',')[0];
        stillingOpprettet = formatDate(datePart);
      }
    }
  });

  // Lagt inn (today datetime)
  const now = new Date();
  const lagtInn = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Sektor, Sted, Bransje, Stillingsfunksjon, Arbeidsspråk
  let sektor = '';
  let sted = '';
  let bransje = '';
  let stillingsfunksjon = '';
  let arbeidsspråk = '';

  const infoListItems = document.querySelectorAll('ul.space-y-10 > li');

  infoListItems.forEach(li => {
    const labelSpan = li.querySelector('span.font-bold');
    if (!labelSpan) return;

    const label = labelSpan.textContent.replace(':', '').trim();

    if (label === 'Sektor') {
      sektor = li.textContent.replace('Sektor:', '').trim();
    } else if (label === 'Sted') {
      sted = li.textContent.replace('Sted:', '').trim();
    } else if (label === 'Bransje') {
      const links = li.querySelectorAll('a');
      bransje = Array.from(links).map(a => a.textContent.trim()).join(', ');
    } else if (label === 'Stillingsfunksjon') {
      const link = li.querySelector('a');
      stillingsfunksjon = link ? link.textContent.trim() : li.textContent.replace('Stillingsfunksjon:', '').trim();
    } else if (label === 'Arbeidsspråk') {
      arbeidsspråk = li.textContent.replace('Arbeidsspråk:', '').trim();
    }
  });

  // Nøkkelord
  let nøkkelord = '';
  const allHeadings = document.querySelectorAll('h2');

  for (const h2 of allHeadings) {
    if (h2.textContent.trim() === 'Nøkkelord') {
      const p = h2.nextElementSibling;
      if (p && p.tagName === 'P') {
        nøkkelord = p.textContent.trim();
      }
      break;
    }
  }

  // Get the current page URL
  const url = window.location.href;

  // Stillingsbeskrivelse
  let jobDescription = '';
  const jobSection = document.querySelector('section > h1.t3')?.parentElement;
  if (jobSection) {
    jobDescription = jobSection.innerText
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Beskrivelse av firma
  let companyDescription = '';
  const companySection = document.querySelector('section.my-16');
  if (companySection) {
    const intro = companySection.querySelector('div.import-decoration em');
    const cleanedIntro = intro ? intro.textContent.trim() : '';
    companyDescription = cleanedIntro;
  }

  // ✅ Build final job object
  const job = {
    stillingstittel,
    firma,
    stillingOpprettet,
    frist,
    pros: '',
    cons: '',
    notat: '',
    sendt: '',
    lagtInn,
    sektor,
    sted,
    bransje,
    stillingsfunksjon,
    arbeidsspråk,
    nøkkelord,
    datoAvslag: '',
    stegVidere: '',
    url,
    jobDescription,
    companyDescription
  };

  console.log('✅ Scraped Job (plain object):', job);

  // ✅ Send message with error handling
  try {
    chrome.runtime.sendMessage(
      {
        type: "jobScraped",
        payload: job,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Failed to send message:", chrome.runtime.lastError);
        } else {
          console.log("Job data sent to background script");
        }
      }
    );
  } catch (error) {
    console.error("Failed to send message to Chrome runtime:", error);
  }
}

