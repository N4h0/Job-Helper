// app.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { google } from 'googleapis';
import { generateCoverLetter } from './utils/generateCoverLetter.js';
import { generateCV } from './utils/generateCV.js';
import { extractGoogleId } from './utils/helperFunctions.js';
import fs from 'fs';
import path from 'path';


const app = express();
const port = 3000;

// 1) Load your options.json at startup
const optionsPath = path.resolve('./options.json');
if (!fs.existsSync(optionsPath)) {
  console.error(`⚠️  options.json not found at ${optionsPath}`);
  process.exit(1);
}
const options = JSON.parse(fs.readFileSync(optionsPath, 'utf-8'));
// Destructure the five fields
const {
  jobJSONObjects = [],
  oldContentFiles = '',
  JobbutlysningerHTML = '',
  Søknader = '',
  CVer = ''
} = options;

// Google Auth + constants
const auth = new google.auth.GoogleAuth({
  keyFile: './credentials/googleDrive.json',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});
const SPREADSHEET_ID         = extractGoogleId(rawOpts.spreadsheet);
const coverLettersFolderId   = extractGoogleId(rawOpts.CVer);
const htmlFilesFolderId      = extractGoogleId(rawOpts.JobbutlysningerHTML);
const sheetsToCheck          = ['Planlagt/usikker','Sendt/ligg inne','Avslått','Søkte ikkje'];

app.use(express.json({ limit: '5mb' }));
app.use(bodyParser.json());
app.use(cors());

app.post('/submit-job', async (req, res) => {
  try {
    // 2) Determine which jobs to process
    let jobs = [];
    if (req.body && Object.keys(req.body).length > 0) {
      // if caller sent a body
      if (Array.isArray(req.body.jobJSONObjects)) {
        jobs = req.body.jobJSONObjects;
      } else {
        jobs = [req.body];
      }
    } else {
      // fallback to your options.json array
      jobs = jobJSONObjects;
    }

    if (!jobs.length) {
      return res.status(400).json({ error: '❌ No job objects to process' });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const drive  = google.drive({ version: 'v3', auth: client });

    const createdSummaries = [];

    // 3) Loop over each job
    for (const job of jobs) {
      console.log('––––––––––––––––––––––––––––––––––––––––––––––');
      console.log('Processing job:', job.stillingstittel, '@', job.firma);

      // 3a) Duplicate‐check in all sheets
      for (const sheetName of sheetsToCheck) {
        const getRes = await sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!B2:D`
        });
        for (const row of getRes.data.values || []) {
          const [t, f, d] = row;
          if (t===job.stillingstittel && f===job.firma && d===job.stillingOpprettet) {
            throw new Error(`Job already exists in sheet "${sheetName}"`);
          }
        }
      }

      // 3b) Build a safe title & timestamp
      const now   = new Date();
      const stamp = `${(now.getMonth()+1).toString().padStart(2,'0')}_${now.getFullYear()}`;
      const safe  = (job.firma + '_' + job.stillingstittel)
                      .replace(/[\/\\:*?"<>|]/g,'_');
      const docTitle = `${safe}_${stamp}`;

      // 3c) Delete any old cover‐letter, then create a fresh Google Doc
      const listRes = await drive.files.list({
        q: `'${coverLettersFolderId}' in parents
            and name='${docTitle}'
            and mimeType='application/vnd.google-apps.document'
            and trashed=false`,
        fields: 'files(id)'
      });
      if ((listRes.data.files||[]).length) {
        await drive.files.delete({ fileId: listRes.data.files[0].id });
      }
      const createDoc = await drive.files.create({
        resource: {
          name: docTitle,
          mimeType:'application/vnd.google-apps.document',
          parents:[coverLettersFolderId]
        },
        fields:'id,webViewLink'
      });
      const documentId = createDoc.data.id;
      const docUrl     = createDoc.data.webViewLink;

      // 3d) Upload the raw HTML snippet as its own file
      if (!job.htmlContent) {
        throw new Error('No HTML content provided in job.htmlContent');
      }
      const htmlName = `${safe}_${stamp}.html`;
      const htmlUp = await drive.files.create({
        resource: {
          name: htmlName,
          mimeType:'text/html',
          parents:[htmlFilesFolderId]
        },
        media: {
          mimeType:'text/html',
          body: job.htmlContent
        },
        fields:'webViewLink'
      });
      const htmlUrl = htmlUp.data.webViewLink.split('?')[0];

      // 3e) Write out the job JSON + the five extra fields
      const outDir = path.resolve('./jobs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
      const jsonOut = {
        ...job,
        oldContentFiles,
        JobbutlysningerHTML,
        Søknader,
        CVer,
        generatedDocId: documentId,
      };
      const jsonName = `${safe}_${stamp}.json`;
      const jsonPath = path.join(outDir, jsonName);
      fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null,2), 'utf-8');

      // 3f) Append to your “Planlagt/usikker” sheet
      const frist = (!job.frist || ['NotFound','Ikke oppgitt'].includes(job.frist))
                    ? 'Ikkje oppgitt' : job.frist;
      const rowValues = [
        `=HYPERLINK("${docUrl}","${job.stillingstittel}")`,
        `=HYPERLINK("${job.url}","${job.firma}")`,
        job.stillingOpprettet,
        `=HYPERLINK("${htmlUrl}",${JSON.stringify(frist)})`,
        job.pros, job.cons, job.notat, job.sendt, job.lagtInn,
        job.sektor, job.sted, job.bransje, job.stillingsfunksjon,
        job.arbeidsspråk, job.nøkkelord, job.datoAvslag, job.stegVidere,
        // now include your five extra fields in the sheet too:
        oldContentFiles,
        JobbutlysningerHTML,
        Søknader,
        CVer
      ];
      // find next empty row
      const getColB = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range:'Planlagt/usikker!B2:B'
      });
      const nextRow = ((getColB.data.values||[]).length + 2);
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range:`Planlagt/usikker!B${nextRow}`,
        valueInputOption:'USER_ENTERED',
        insertDataOption:'INSERT_ROWS',
        requestBody:{ values:[rowValues] }
      });

      // 3g) (Optional) styling/borders omitted for brevity…

      // 3h) Generate CV / Cover letter if requested
      const tasks = [];
      if (job.booleanCV) {
        tasks.push(
          generateCV()
            .then(fileId => {
              const cvLink = `=HYPERLINK("https://drive.google.com/file/d/${fileId}/view","CV")`;
              return sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range:`Planlagt/usikker!D${nextRow}`,
                valueInputOption:'USER_ENTERED',
                requestBody:{ values:[[cvLink]] }
              });
            })
        );
      }
      if (job.booleanGenerateCoverLetter) {
        tasks.push(generateCoverLetter(job, documentId));
      }
      await Promise.all(tasks);

      // 3i) collect summary
      createdSummaries.push({
        jsonFile: jsonName,
        sheetRow: nextRow,
        coverLetterUrl: docUrl,
        htmlUrl,
        extras: { oldContentFiles, JobbutlysningerHTML, Søknader, CVer }
      });
    }

    // 4) return everything to the caller
    res.json({
      success: true,
      created: createdSummaries
    });

  } catch (err) {
    console.error('❌ /submit-job error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Sheets API listening at http://localhost:${port}`);
});

