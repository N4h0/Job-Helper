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

  // ✅ Build final job object
  const job = {
    stillingstittel: stillingstittel,
    firma: firma,
    stillingOpprettet: stillingOpprettet,
    frist: frist,
    pros: '',
    cons: '',
    notat: '',
    sendt: '',
    lagtInn: lagtInn,
    sektor: sektor,
    sted: sted,
    bransje: bransje,
    stillingsfunksjon: stillingsfunksjon,
    arbeidsspråk: arbeidsspråk,
    nøkkelord: nøkkelord,
    datoAvslag: '',
    stegVidere: '',
    url: url  // Add the URL to the job object
  };

  console.log('✅ Scraped Job (plain object):', job);

  chrome.runtime.sendMessage({
    type: "jobScraped",
    payload: job
  });
}
