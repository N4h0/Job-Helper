export function runFinnScraper() {
  function formatDate(rawDate) {
    const clean = rawDate.replace(/\u00A0/g, ' ').trim();

    // 1) Numeric: 5.5.2025 or 05-05-2025
    const numericMatch = clean.match(/^(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})$/);
    if (numericMatch) {
      const [, day, month, year] = numericMatch;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    // month‐name mapping for NO + DE + EN
    const months = {
      // Norwegian
      januar: '01', februar: '02', mars: '03', april: '04', mai: '05', juni: '06',
      juli: '07', august: '08', september: '09', oktober: '10', november: '11', desember: '12',
      // German
      märz: '03', maerz: '03', // handle both spellings
      januar: '01', februar: '02', april: '04', mai: '05', juni: '06',
      juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
      // English
      january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
      july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
    };

    // 2) Textual with dot (e.g. "1. März 2025" or "1. januar 2025")
    let m = clean.match(/^(\d{1,2})\.\s*([A-Za-zæøåÄÖÜß]+)\s+(\d{4})$/i);
    if (m) {
      const [, day, monthName, year] = m;
      const key = monthName.toLowerCase();
      if (months[key]) {
        return `${day.padStart(2, '0')}/${months[key]}/${year}`;
      }
    }

    // 3) English whitespace (e.g. "05 May 2025" or "5 May 2025")
    m = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/i);
    if (m) {
      const [, day, monthName, year] = m;
      const key = monthName.toLowerCase();
      if (months[key]) {
        return `${day.padStart(2, '0')}/${months[key]}/${year}`;
      }
    }

    // fallback
    return rawDate;
  }




  // Stillingstittel
  const heading = document.querySelector('h2[data-cy="vacancy-title"]');
  const stillingstittel = heading ? heading.textContent.trim() : '';

  // Firma
  const firmaEl = document.querySelector('a[data-cy="company-link"] span');
  const firma = firmaEl ? firmaEl.textContent.trim() : '';

  // Frist (jobs.ch har ikkje frist)
  const frist = 'jobs.ch';

  // Stilling opprettet
  let stillingOpprettet = '';
  const pubDateEl = document.querySelector('li[data-cy="info-publication"] span.white-space_nowrap');
  if (pubDateEl) {
    const rawDate = pubDateEl.textContent.trim();           // e.g. "10 April 2025"
    stillingOpprettet = formatDate(rawDate);               // "10/04/2025"
  }

  // Lagt inn (today datetime)
  const now = new Date();
  const lagtInn = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}, ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  // Sektor
  const sektor = "";

  // Sted
  const stedEl = document.querySelector('a[data-cy="info-location-link"]');
  const rawSted = stedEl?.textContent.trim() || '';
  const sted = rawSted;

  // Bransje
  const bransje = "";

  // Stillingsfunksjon
  const stillingsfunksjon = "";

  // Arbeidsspråk
  const arbeidssprakEl = document.querySelector('li[data-cy="info-language"] div span:last-child');
  const rawArbeidssprak = arbeidssprakEl?.textContent.trim() || '';
  const arbeidsspråk = rawArbeidssprak;

  // Nøkkelord
  // Nøkkelord
  const nøkkelordEl = document.querySelector('div[data-cy="vacancy-meta"]');
  const rawNøkkelord = Array.from(nøkkelordEl?.querySelectorAll('a') || [])
    .map(a => a.textContent.trim())
    .join(', ');
  const nøkkelord = rawNøkkelord;

  // Get the current page URL
  const url = window.location.href;

  // Stillingsbeskrivelse
  const jobDescriptionEl = document.querySelector('div[data-cy="vacancy-description"]');
  const rawJobDescription = jobDescriptionEl?.innerText
    .replace(/\s+/g, ' ')
    .trim() || '';
  const jobDescription = rawJobDescription;

  // Beskrivelse av firma
  let companyDescription = '';


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

