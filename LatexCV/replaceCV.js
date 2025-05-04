import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { extractGoogleId } from '../utils/extractLinkId.js';


dotenv.config({ path: './credentials/.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const optsPath = path.resolve(process.cwd(), 'options.json');


const jobPath = './debug-latest-job.json';
const cvFolder = './LatexCV';
const driveFolderId = extractGoogleId(options.CVer);
const spreadsheetId = extractGoogleId(options.spreadsheet);
const sheetName = 'Planlagt/usikker';

async function replaceManuallyEditedCV() {
  const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));

  const fileSafeName = `${job.firma}_${job.stillingstittel}`.replace(/[\/\\:*?"<>|]/g, '_');
  const now = new Date();
  const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  const fileName = `${fileSafeName}_${formattedDate}.pdf`;
  const cvPdfPath = path.resolve(cvFolder, 'cv.pdf');

  if (!fs.existsSync(cvPdfPath)) {
    throw new Error(`❌ cv.pdf not found at ${cvPdfPath}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
  });

  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });
  const sheets = google.sheets({ version: 'v4', auth: client });

  // 🔍 Check for existing file
  const listRes = await drive.files.list({
    q: `'${driveFolderId}' in parents and name='${fileName}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive'
  });

  if (listRes.data.files.length > 0) {
    const fileId = listRes.data.files[0].id;
    await drive.files.delete({ fileId });
    console.log(`🗑️ Deleted old CV: ${fileName}`);
  }

  // ⬆️ Upload the new file
  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(cvPdfPath)
  };

  const createRes = await drive.files.create({
    resource: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [driveFolderId]
    },
    media,
    fields: 'id'
  });

  const newFileId = createRes.data.id;
  const cvLinkFormula = `=HYPERLINK("https://drive.google.com/file/d/${newFileId}/view", "${job.stillingOpprettet}")`;

  console.log(`✅ Uploaded new CV: ${fileName}`);

  // 🧠 Find row in spreadsheet
  const rowsRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!B2:D`
  });

  const rows = rowsRes.data.values;
  const rowIndex = rows?.findIndex(([title, firm, date]) =>
    title?.includes(job.stillingstittel) && firm === job.firma && date === job.stillingOpprettet
  );

  if (rowIndex === -1 || rowIndex === undefined) {
    console.warn('⚠️ Could not find matching row in sheet to update CV link.');
  } else {
    const rowNumber = rowIndex + 2;
    const updateRes = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!D${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[cvLinkFormula]]
      }
    });
    console.log(`🔗 Updated CV link in sheet row D${rowNumber}`);
  }

  return newFileId;
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
