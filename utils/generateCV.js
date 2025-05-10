import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import { extractGoogleId } from './helperFunctions.js';

dotenv.config({ path: './credentials/.env' });
const execAsync = promisify(exec);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load options
const options = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../options.json'), 'utf-8')
);

// IDs from options
const DRIVE_FOLDER_ID = extractGoogleId(options.CVer);
const SPREADSHEET_ID = extractGoogleId(options.spreadsheet);
if (!DRIVE_FOLDER_ID) throw new Error(
  `Could not extract Drive folder ID from options.CVer="${options.CVer}"`
);
if (!SPREADSHEET_ID) throw new Error(
  `Could not extract Spreadsheet ID from options.spreadsheet="${options.spreadsheet}"`
);

const JOB_PATH = path.resolve('./debug-latest-job.json');
const CV_FOLDER = path.resolve('./LatexCV');

/**
 * Generates a tailored LaTeX CV, uploads both .tex and .pdf to Drive,
 * and returns their file IDs.
 */
export async function generateCV() {
  // Read the job definition
  const job = JSON.parse(fs.readFileSync(JOB_PATH, 'utf-8'));
  const lang = job.llmSettings?.språk;
  const profile = job.llmSettings?.resumePreset;

  // Load the LaTeX template for this language/profile
  const templatePath = path.resolve(
    `${CV_FOLDER}/contentTemplates/${lang}/${profile}.tex`
  );
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  // Build the OpenAI prompt
  const prompt = `Only use the information provided in the CV and job description. Make sure to not change the LaTeX formatting.
Language: ${lang}
Job Title: ${job.stillingstittel}
Company: ${job.firma}

Job Description:
${job.jobDescription}

Company Description:
${job.companyDescription}

LaTeX CV Template:
${templateContent}`;

  // Call the OpenAI API to tailor the CV
  const chat = await openai.chat.completions.create({
    model: job.llmSettings?.model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant that updates LaTeX resumes and tailors them to specific jobs.' },
      { role: 'user', content: prompt }
    ]
  });

  const tailoredCV = chat.choices[0].message.content;
  const match = tailoredCV.match(/\\begin\{greenbox}[\s\S]*?\\vspace\{2pt\}/);
  if (!match) {
    fs.writeFileSync('./temp.txt', tailoredCV);
    throw new Error('No LaTeX block found in LLM response. Raw output saved to temp.txt');
  }

  // Write out the content.tex file
  const latexOnly = match[0];
  const contentTexPath = path.resolve(`${CV_FOLDER}/content.tex`);
  fs.writeFileSync(contentTexPath, latexOnly, 'utf-8');

  // Compile to PDF
  await execAsync('latexmk -pdf cv.tex', { cwd: CV_FOLDER });
  const pdfPath = path.resolve(CV_FOLDER, 'cv.pdf');

  // Build Drive-safe filenames
  const now = new Date();
  const stamp = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;
  const safeName = `${job.firma}_${job.stillingstittel}`.replace(/[\/\\:*?"<>|]/g, '_');
  const pdfFileName = `${safeName}_${stamp}.pdf`;
  const texFileName = `${safeName}_${stamp}.tex`;

  // Google Drive client
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
  });
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });

  // 1) Upload content.tex
  const texRes = await drive.files.create({
    resource: { name: texFileName, mimeType: 'text/plain', parents: [extractGoogleId(options.oldContentFiles)] },
    media: { mimeType: 'text/plain', body: fs.createReadStream(contentTexPath) },
    fields: 'id'
  });
  const texFileId = texRes.data.id;

  // 2) Upload or update the PDF
  const listRes = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${pdfFileName}' and trashed=false`,
    fields: 'files(id)', spaces: 'drive'
  });
  const media = { mimeType: 'application/pdf', body: fs.createReadStream(pdfPath) };

  let pdfFileId;
  if ((listRes.data.files || []).length) {
    const updateRes = await drive.files.update({ fileId: listRes.data.files[0].id, media });
    pdfFileId = updateRes.data.id;
  } else {
    const createRes = await drive.files.create({
      resource: { name: pdfFileName, mimeType: 'application/pdf', parents: [DRIVE_FOLDER_ID] },
      media,
      fields: 'id'
    });
    pdfFileId = createRes.data.id;
  }

  // 3) Return both file IDs
  return { pdfFileId, texFileId };
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCV()
    .then(ids => console.log(`RETURN_PDF_ID::${ids.pdfFileId}`, `RETURN_TEX_ID::${ids.texFileId}`))
    .catch(err => { console.error('❌ Error in generateCV:', err.message); process.exit(1); });
}
