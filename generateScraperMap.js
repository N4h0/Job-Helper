// Run with the command generateScaperMap.js, which generates a simple file showing all websites which can be scraped - mix between hardcoding and automation of scrapers - ish. 

import fs from 'fs';
import path from 'path';

// Folder where your scraper files are
const scrapersDir = './scrapers';

// Output file
const outputFile = './scraperMap.js';

// List all .js files in scrapers/
const scraperFiles = fs.readdirSync(scrapersDir).filter(file => file.endsWith('.js'));

// Build imports and mappings
let imports = '';
let mappings = '';

scraperFiles.forEach(file => {
  const scraperName = path.basename(file, '.js'); // eg. 'finn'
  imports += `import * as ${scraperName} from './scrapers/${file}';\n`;
  mappings += `  '${scraperName}.no': ${scraperName}.runFinnScraper,\n`; 
  // ⬆️ assumes all scrapers export `runFinnScraper`
});

const content = `// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.

${imports}

export const scraperMap = {
${mappings}
};
`;

fs.writeFileSync(outputFile, content);

console.log('✅ scraperMap.js has been generated!');