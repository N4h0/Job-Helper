import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';  // Import cors
import { google } from 'googleapis';
import { generateCoverLetter } from './utils/generateCoverLetter.js';

const app = express();
const port = 3000;
app.use(express.json({ limit: '5mb' }));


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
const coverLettersFolderId = '1ecDNJDPn2C9sBcLj-qR5198UGvKaBIJb';

// Sheets to check for existing job
const sheetsToCheck = ['Planlagt/usikker', 'Sendt/ligg inne', 'Avslått', 'Søkte ikkje'];

// POST route to handle job data submission
app.post('/submit-job', async (req, res) => {
    try {
        const job = req.body;

        if (!job || Object.keys(job).length === 0) {
            console.error('❌ Job data is empty');
            return res.status(400).json({ error: '❌ Empty job data' });
        }

        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const drive = google.drive({ version: 'v3', auth: client });

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

        // Step 1.5 or something: finish creating the job object

        const date = new Date();
        const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}_${date.getFullYear()}`;
        const docTitle = `${job.firma}_${job.stillingstittel.replace(/[\/\\:*?"<>|]/g, '_')}_${formattedDate}`;
        const createResponse = await drive.files.create({
            resource: {
                name: docTitle, // The title of the document
                mimeType: 'application/vnd.google-apps.document',
                parents: ["1ecDNJDPn2C9sBcLj-qR5198UGvKaBIJb"] // The folder where the document will be saved
            },
            fields: 'id,webViewLink' // This ensures we get the URL back
        });

        const documentId = createResponse.data.id;
        const docUrl = createResponse.data.webViewLink;
        console.log(`✅ Created document: ${docUrl}`);
        const positionTitleHyperlink = `=HYPERLINK("${docUrl}", "${job.stillingstittel}")`;
        const firmaHyperlink = `=HYPERLINK("${job.url}", "${job.firma}")`;

        // Step 1.75: Upload the job listing as a html file to Google Drive

        const html = job.htmlContent;
        if (!html) {
            console.error('❌ No HTML content provided');
            return res.status(400).json({ error: '❌ No HTML content' });
        }
        const htmlFilesFolderId = '16H7D73f520_BJEAvCnAjRsUfNjRCYmXk'; // Replace with your actual folder ID

        // Generate the filename
        const filename = `${job.firma}_${job.stillingstittel.replace(/[\/\\:*?"<>|]/g, '_')}_${formattedDate}.html`; // Define filename here

        // Prepare the file metadata
        const fileMetadata = {
            name: filename,
            mimeType: 'text/html',
            parents: [htmlFilesFolderId] // The folder ID where you want to store the file
        };

        const media = {
            mimeType: 'text/html',
            body: html  // Sending the HTML content here
        };

        // Upload the HTML file to Google Drive
        const uploadResponse = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink'
        });

        let frist = job.frist;
        if (frist === undefined || frist === null || frist === '' || frist === 'NotFound' || frist === 'Ikke oppgitt' || frist === 'Ikke oppgitt' || frist === 'Ikke oppgitt' || frist === 'Ikke oppgitt') {
            frist = 'Ikkje oppgitt'; // Set default value if frist is not provided
        }

        const rawLink = uploadResponse.data.webViewLink;
        const htmlFileUrl = rawLink.split('?')[0]; // Removes ?usp=drivesdk or any other query params
        const htmlLinkAndFrist = `=HYPERLINK("${htmlFileUrl}", ${JSON.stringify(frist)})`;

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

        const jobArray = [
            [
                positionTitleHyperlink,// Use formulaValue to ensure it's treated as a formula
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
            ]
        ];

        // Step 3: Insert the data
        const range = `Planlagt/usikker!B${firstEmptyRow}`;
        const resSheet = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'USER_ENTERED',  // Ensure the formula is properly interpreted
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: jobArray
            }
        });

        console.log('✅ Job data added to Google Sheets:', resSheet.data.updates.updatedRange);

        // Step 4: Apply formatting to the entire row (B to R)
        const updateRange = `Planlagt/usikker!B${firstEmptyRow}:R${firstEmptyRow}`;
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
                                endColumnIndex: 18, // Up to column R
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
        await generateCoverLetter(job, documentId);

    } catch (err) {
        console.error('❌ Error writing to Sheets:', err);
        console.error('Detailed error:', err.response || err);  // Log detailed error
        res.status(500).json({ error: '❌ Failed to write job to Sheets', details: err.message });
    }
});



app.listen(port, () => {
    console.log(`✅ Sheets API listening at http://localhost:${port}`);
});