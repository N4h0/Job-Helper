import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { extractGoogleId } from '../utils/helperFunctions.js';

dotenv.config({ path: './credentials/.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const optsPath = path.resolve(process.cwd(), 'options.json');
const options = JSON.parse(fs.readFileSync(optsPath, 'utf-8'));

const jobPath = './debug-latest-job.json';
const cvFolder = './LatexCV';
const driveFolderId = extractGoogleId(options.CVer);
const contentFolderId = extractGoogleId(options.oldContentFiles);
const spreadsheetId = extractGoogleId(options.spreadsheet);
const sheetName = 'Planlagt/usikker';

async function replaceManuallyEditedCV() {
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

  // --- Build base filename: FIRM_POSITION_MM_YYYY
  const fileSafeName = `${job.firma}_${job.stillingstittel}`.replace(/[\/\\:*?"<>|]/g, '_');
  const now = new Date();
  const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  
  // --- Paths & names
  const cvPdfPath = path.resolve(cvFolder, 'cv.pdf');
  const contentTexPath = path.resolve(cvFolder, 'content.tex');
  const baseName = `${fileSafeName}_${formattedDate}`;
  const pdfName = `${baseName}.pdf`;
  const texName = `${baseName}.tex`;

  if (!fs.existsSync(cvPdfPath)) {
    throw new Error(`❌ cv.pdf not found at ${cvPdfPath}`);
  }
  if (!fs.existsSync(contentTexPath)) {
    throw new Error(`❌ content.tex not found at ${contentTexPath}`);
  }

  // --- Auth
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets'
    ]
  });
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });
  const sheets = google.sheets({ version: 'v4', auth: client });

  // --- 1) DELETE old PDF if it exists
  const pdfList = await drive.files.list({
    q: `'${driveFolderId}' in parents and name='${pdfName}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive'
  });
  if (pdfList.data.files.length > 0) {
    await drive.files.delete({ fileId: pdfList.data.files[0].id });
    console.log(`🗑️ Deleted old CV: ${pdfName}`);
  }

  // --- 2) UPLOAD new PDF
  const pdfMedia = { mimeType: 'application/pdf', body: fs.createReadStream(cvPdfPath) };
  const pdfCreate = await drive.files.create({
    resource: { name: pdfName, mimeType: 'application/pdf', parents: [driveFolderId] },
    media: pdfMedia,
    fields: 'id'
  });
  const newPdfId = pdfCreate.data.id;
  const pdfLinkFormula = `=HYPERLINK("https://drive.google.com/file/d/${newPdfId}/view","${job.stillingOpprettet}")`;
  console.log(`✅ Uploaded new CV: ${pdfName}`);

  // --- 3) DELETE old .tex if it exists
  const texList = await drive.files.list({
    q: `'${contentFolderId}' in parents and name='${texName}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive'
  });
  if (texList.data.files.length > 0) {
    await drive.files.delete({ fileId: texList.data.files[0].id });
    console.log(`🗑️ Deleted old content: ${texName}`);
  }

  // --- 4) UPLOAD new content.tex
  const texMedia = { mimeType: 'application/x-tex', body: fs.createReadStream(contentTexPath) };
  const texCreate = await drive.files.create({
    resource: { name: texName, mimeType: 'application/x-tex', parents: [contentFolderId] },
    media: texMedia,
    fields: 'id'
  });
  const newTexId = texCreate.data.id;
  const texLinkFormula = `=HYPERLINK("https://drive.google.com/file/d/${newTexId}/view","${job.lagtInn}")`;
  console.log(`✅ Uploaded new content: ${texName}`);

  // --- 5) FIND the row in the sheet
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!B2:D`
  });
  const rows = rowsRes.data.values || [];
  const rowIndex = rows.findIndex(([title, firm, date]) =>
    title?.includes(job.stillingstittel) &&
    firm === job.firma &&
    date === job.stillingOpprettet
  );
  const rowNumber = rowIndex >= 0 ? rowIndex + 2 : null;

  if (rowNumber) {
    // update CV link in D
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!D${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[pdfLinkFormula]] }
    });
    console.log(`🔗 Updated CV link in D${rowNumber}`);

    // update content link in J
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!J${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[texLinkFormula]] }
    });
    console.log(`🔗 Updated content link in J${rowNumber}`);
  } else {
    console.warn('⚠️ Could not find matching row in sheet to update links.');
  }

  return newPdfId;
}

// CLI entry
if (process.argv[1] === __filename) {
  replaceManuallyEditedCV()
    .then(id => console.log(`✅ Done. File ID: ${id}`))
    .catch(err => {
      console.error('❌ Failed to replace CV:', err.message);
      process.exit(1);
    });
}
