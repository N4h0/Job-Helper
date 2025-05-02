export function runFinnScraper() {
  console.log("Running scraper inside the page...");

  // Stillingstittel
  const heading = document.querySelector('h2');
  const stillingstittel = heading ? heading.textContent.trim() : '';

  // Firma
  const firmaElement = document.querySelector('section.space-y-16 > p');
  const firma = firmaElement ? firmaElement.textContent.trim() : '';

  // Frist
  let frist = '';
  const allLiElements = document.querySelectorAll('li.flex.flex-col');
  allLiElements.forEach(li => {
    if (li.textContent.includes('Frist')) {
      const span = li.querySelector('span.font-bold');
      if (span) {
        const rawFrist = span.textContent.trim();
        frist = rawFrist.replaceAll('.', '/');
      }
    }
  });

  // Stilling opprettet
  let stillingOpprettet = '';
  const allLiGapElements = document.querySelectorAll('li.flex.gap-x-16');
  allLiGapElements.forEach(li => {
    if (li.textContent.includes('Sist endret')) {
      const time = li.querySelector('time');
      if (time) {
        const fullText = time.textContent.trim();
        const datePart = fullText.split(',')[0];
        stillingOpprettet = datePart.replaceAll('.', '/');
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
    .replace(/\s+/g, ' ') // remove excessive whitespace
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
    stillingstittel: stillingstittel,// Here there's also going to be a hyperlink to my application letter
    firma: firma, // Hyperlink to the job url
    stillingOpprettet: stillingOpprettet, // Here there's also going to be a hyperlink to my CV. If not found, the date is NotFound (string).
    frist: frist, // Hyperlink to the downloaded job ad
    pros: '',
    cons: '',
    notat: '',
    sendt: '', // DateTime format of the time I sent the application
    lagtInn: lagtInn, // DateTime format of the time I added the application to my google docs
    sektor: sektor,
    sted: sted,
    bransje: bransje,
    stillingsfunksjon: stillingsfunksjon,
    arbeidsspråk: arbeidsspråk,
    nøkkelord: nøkkelord,
    datoAvslag: '', // DateTime format of the time I got a rejection
    stegVidere: '',
    url: url,  // Add the URL to the job object
    jobDescription,
    companyDescription
  };

  console.log('✅ Scraped Job (plain object):', job);

  chrome.runtime.sendMessage({
    type: "jobScraped",
    payload: job
  });
}