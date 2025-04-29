import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';  // Import cors
import { google } from 'googleapis';

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());  // Enable CORS

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials/googleDrive.json', // Update to your file path
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
  ]
});

// Your target Google Sheets ID
const SPREADSHEET_ID = '1-jewsfYMKapRSDmD36heyzaUP6VvTBqmS87PhWS_rYo';

// Sheets to check for existing job
const sheetsToCheck = ['Planlagt/usikker', 'Sendt/ligg inne', 'Avslått', 'Søkte ikkje'];

// POST route to handle job data submission
app.post('/submit-job', async (req, res) => {
  try {
    const job = req.body;
    console.log('Received job data:', job);  // Log the received job data

    if (!job || Object.keys(job).length === 0) {
      console.error('❌ Job data is empty');
      return res.status(400).json({ error: '❌ Empty job data' });
    }

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const jobArray = [
      [
        job.stillingstittel,
        job.firma,
        job.stillingOpprettet,
        job.frist,
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
      ]
    ];

    console.log('Job data appended to jobarray');

    // Step 1: Check if job already exists in any of the sheets
    for (const sheetName of sheetsToCheck) {
      const getRowsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!B2:D`,  // Check columns B, C, D for match
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

    // Step 2: If no match found, proceed to insert job data
    const getRowsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Planlagt/usikker!B2:B',  // Column B will give us the first row with data (starting from B2)
    });

    const rows = getRowsResponse.data.values;
    let firstEmptyRow = 3; // Start from row 3, as row 1 and 2 are header and empty

    if (rows && rows.length > 0) {
      firstEmptyRow = rows.length + 2; // Set row to the first empty row after the header
    }

    console.log('First empty row:', firstEmptyRow);

    // Step 3: Insert the data
    const range = `Planlagt/usikker!B${firstEmptyRow}`;
    const resSheet = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: jobArray
      }
    });

    console.log('✅ Job data added to Google Sheets:', resSheet.data.updates.updatedRange);

    // Step 4: Apply formatting to the entire row (B to N)
    const updateRange = `Planlagt/usikker!B${firstEmptyRow}:N${firstEmptyRow}`;
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
                endColumnIndex: 18, // Up to column N
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.85,
                    green: 1.0,
                    blue: 0.85
                  },
                  horizontalAlignment: 'LEFT',
                }
              },
              fields: 'userEnteredFormat(backgroundColor,horizontalAlignment)',
            }
          },
          {
            updateBorders: {
              range: {
                sheetId: 0,
                startRowIndex: firstEmptyRow - 1,
                endRowIndex: firstEmptyRow,
                startColumnIndex: 1,
                endColumnIndex: 18, // Up to column R
              },
              top: {
                style: firstEmptyRow === 3 ? 'SOLID' : 'SOLID', // Always solid, but different width
                width: firstEmptyRow === 3 ? 3 : 1, // Thicker for row 3, thin for others
                color: { red: 0, green: 0, blue: 0 }
              },
              left: {
                style: 'SOLID',
                width: 2,
                color: { red: 0, green: 0, blue: 0 }
              },
              right: {
                style: 'SOLID',
                width: 2,
                color: { red: 0, green: 0, blue: 0 }
              },
              bottom: {
                style: 'SOLID',
                width: 2,
                color: { red: 0, green: 0, blue: 0 }
              },
              innerHorizontal: {
                style: 'SOLID',
                width: 1,
                color: { red: 0, green: 0, blue: 0 }
              },
              innerVertical: {  // Adds the thin borders between cells
                style: 'SOLID',
                width: 1,
                color: { red: 0, green: 0, blue: 0 }
              }
            }
          }
        ]
      }
    });

    res.status(200).json({ status: '✅ Job added to Google Sheets!' });

  } catch (err) {
    console.error('❌ Error writing to Sheets:', err);
    console.error('Detailed error:', err.response || err);  // Log detailed error
    res.status(500).json({ error: '❌ Failed to write job to Sheets', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Sheets API listening at http://localhost:${port}`);
});
