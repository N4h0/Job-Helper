import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { google } from 'googleapis';
import { generateCoverLetter } from './utils/generateCoverLetter.js';
import { generateCV } from './utils/generateCV.js';
import fs from 'fs';

const app = express();
const port = 3000;
app.use(express.json({ limit: '5mb' }));
app.use(bodyParser.json());
app.use(cors());

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials/googleDrive.json',
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});

const SPREADSHEET_ID = '1-jewsfYMKapRSDmD36heyzaUP6VvTBqmS87PhWS_rYo';
const coverLettersFolderId = '1ecDNJDPn2C9sBcLj-qR5198UGvKaBIJb';
const sheetsToCheck = ['Planlagt/usikker', 'Sendt/ligg inne', 'Avslått', 'Søkte ikkje'];

app.post('/submit-job', async (req, res) => {
  try {
    const job = req.body;
    console.log('______________________________________________________________________');
    console.log('Writing new job to Google Sheets: ', job.stillingstittel, " at firm:", job.firma);

    if (!job || Object.keys(job).length === 0) {
      console.error('❌ Job data is empty');
      return res.status(400).json({ error: '❌ Empty job data' });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const drive = google.drive({ version: 'v3', auth: client });

    for (const sheetName of sheetsToCheck) {
      const getRowsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!B2:D`,
      });

      const rows = getRowsResponse.data.values;
      if (rows) {
        for (const row of rows) {
          const [stillingstittel, firma, stillingOpprettet] = row;
          if (stillingstittel === job.stillingstittel && firma === job.firma && stillingOpprettet === job.stillingOpprettet) {
            console.log(`❌ Job already exists in the ${sheetName} sheet.`);
            return res.status(400).json({ error: `❌ Job already exists in the ${sheetName} sheet.` });
          }
        }
      }
    }

    const date = new Date();
    const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
    const docTitle = `${job.firma}_${job.stillingstittel.replace(/[\/\\:*?"<>|]/g, '_')}_${formattedDate}`;
    async function deleteExistingCoverLetterIfExists(drive, folderId, docTitle) {
      const listRes = await drive.files.list({
        q: `'${folderId}' in parents and name = '${docTitle}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
    
      const files = listRes.data.files;
      if (files.length > 0) {
        const fileId = files[0].id;
        await drive.files.delete({ fileId });
        console.log(`🗑️ Deleted existing document: ${files[0].name}`);
      }
    }

    await deleteExistingCoverLetterIfExists(drive, coverLettersFolderId, docTitle);

    const createResponse = await drive.files.create({
      resource: {
        name: docTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [coverLettersFolderId]
      },
      fields: 'id,webViewLink'
    });

    const documentId = createResponse.data.id;
    const docUrl = createResponse.data.webViewLink;
    const positionTitleHyperlink = `=HYPERLINK("${docUrl}", "${job.stillingstittel}")`;
    const firmaHyperlink = `=HYPERLINK("${job.url}", "${job.firma}")`;

    const html = job.htmlContent;
    if (!html) {
      console.error('❌ No HTML content provided');
      return res.status(400).json({ error: '❌ No HTML content' });
    }

    const htmlFilesFolderId = '16H7D73f520_BJEAvCnAjRsUfNjRCYmXk';
    const filename = `${job.firma}_${job.stillingstittel.replace(/[\/\\:*?"<>|]/g, '_')}_${formattedDate}.html`;

    const fileMetadata = {
      name: filename,
      mimeType: 'text/html',
      parents: [htmlFilesFolderId]
    };

    const media = {
      mimeType: 'text/html',
      body: html
    };

    const uploadResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    let frist = job.frist;
    if (!frist || frist === 'NotFound' || frist === 'Ikke oppgitt') frist = 'Ikkje oppgitt';

    const htmlFileUrl = uploadResponse.data.webViewLink.split('?')[0];
    const htmlLinkAndFrist = `=HYPERLINK("${htmlFileUrl}", ${JSON.stringify(frist)})`;

    job.generatedDocId = documentId;
    const jobNoHtml = { ...job };
    delete jobNoHtml.htmlContent;
    fs.writeFileSync('./debug-latest-job.json', JSON.stringify(jobNoHtml, null, 2));
    fs.writeFileSync(`./jobs/${job.firma.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_')}_${job.stillingstittel.replace(/[\/\\:*?"<>|]/g, '_')}_${formattedDate}.json`, JSON.stringify(job, null, 2), 'utf-8');

    const getRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Planlagt/usikker!B2:B',
    });

    const rows = getRowsResponse.data.values;
    let firstEmptyRow = rows && rows.length > 0 ? rows.length + 2 : 3;

    const jobArray = [[
      positionTitleHyperlink,
      firmaHyperlink,
      job.stillingOpprettet,
      htmlLinkAndFrist,
      job.pros,
      job.cons,
      job.notat,
      job.sendt,
      job.lagtInn,
      job.sektor,
      job.sted,
      job.bransje,
      job.stillingsfunksjon,
      job.arbeidsspråk,
      job.nøkkelord,
      job.datoAvslag,
      job.stegVidere,
    ]];

    const range = `Planlagt/usikker!B${firstEmptyRow}`;
    const resSheet = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: jobArray }
    });

    console.log('✅ Job data added to Google Sheets:', resSheet.data.updates.updatedRange);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: firstEmptyRow - 1,
                endRowIndex: firstEmptyRow,
                startColumnIndex: 1,
                endColumnIndex: 18,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.85, green: 1.0, blue: 0.85 },
                  horizontalAlignment: 'LEFT',
                  wrapStrategy: 'CLIP'
                }
              },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,wrapStrategy)',
            }
          },
          {
            updateBorders: {
              range: {
                sheetId: 0,
                startRowIndex: firstEmptyRow - 1,
                endRowIndex: firstEmptyRow,
                startColumnIndex: 1,
                endColumnIndex: 18,
              },
              top: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
              left: { style: 'SOLID', width: 2, color: { red: 0, green: 0, blue: 0 } },
              right: { style: 'SOLID', width: 2, color: { red: 0, green: 0, blue: 0 } },
              bottom: { style: 'SOLID', width: 2, color: { red: 0, green: 0, blue: 0 } },
              innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } },
              innerVertical: { style: 'SOLID', width: 1, color: { red: 0, green: 0, blue: 0 } }
            }
          }
        ]
      }
    });

    const tasks = [];

    if (job.booleanCV) {
      tasks.push(
        generateCV().then(fileId => {
          job.cvFileId = fileId;
          const cvLink = `=HYPERLINK("https://drive.google.com/file/d/${fileId}/view", "${job.stillingOpprettet}")`;
          return sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Planlagt/usikker!D${firstEmptyRow}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[cvLink]]
            }
          }).then(() => {
            console.log(`📎 CV link added to cell D${firstEmptyRow}`);
          });
        }).catch(err => console.error('❌ CV generation failed:', err.message))
      );
    } else {
      console.log('📎 No CV generation requested.');
    }

    if (job.booleanGenerateCoverLetter) {
      tasks.push(
        generateCoverLetter(job, documentId).catch(err =>
          console.error('❌ Cover letter generation failed:', err.message))
      );
    } else {
      console.log('✉️ No cover letter generation requested.');
    }

    await Promise.all(tasks);
    console.log('✅ Finished all tasks!');
    res.status(200).json({ status: '✅ Job added to Google Sheets!' });

  } catch (err) {
    console.error('❌ Error writing to Sheets:', err.message);
    res.status(500).json({ error: '❌ Failed to write job to Sheets', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Sheets API listening at http://localhost:${port}`);
});
