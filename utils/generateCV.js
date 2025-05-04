// utils/generateCV.js
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { google } from 'googleapis';
import { extractGoogleId } from './extractLinkId.js';

dotenv.config({ path: './credentials/.env' });
const execAsync = promisify(exec);
const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// — load options.json relative to this file —
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const options    = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../options.json'), 'utf-8')
);

// derive your Drive-folder ID from the “CVer” URL in options.json
const DRIVE_FOLDER_ID = extractGoogleId(options.CVer);
if (!DRIVE_FOLDER_ID) {
  throw new Error(`Could not extract Drive folder ID from options.CVer="${options.CVer}"`);
}

// local paths
const JOB_PATH = path.resolve('./debug-latest-job.json');
const CV_FOLDER = path.resolve('./LatexCV');

export async function generateCV() {
  // 1) read the most recent job
  const job = JSON.parse(fs.readFileSync(JOB_PATH, 'utf-8'));
  const lang    = job.llmSettings?.språk;
  const profile = job.llmSettings?.resumePreset;

  // 2) load and validate your .tex template
  const templatePath = path.resolve(`${CV_FOLDER}/contentTemplates/${lang}/${profile}.tex`);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  // 3) build the prompt and call OpenAI
  const prompt = `Only use the information provided in the CV and job description...
Language: ${lang}
Job Title: ${job.stillingstittel}
Company: ${job.firma}

Job Description:
${job.jobDescription}

Company Description:
${job.companyDescription}

LaTeX CV Template:
${templateContent}`;

  const chat = await openai.chat.completions.create({
    model: job.llmSettings?.model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant that updates LaTeX resumes.' },
      { role: 'user',   content: prompt }
    ]
  });

  const tailoredCV = chat.choices[0].message.content;
  const match = tailoredCV.match(/\\begin{greenbox}[\s\S]*\\vspace{2pt}/);
  if (!match) throw new Error('No LaTeX block found in LLM response.');

  const latexOnly = match[0];
  const outputPath = path.resolve(`${CV_FOLDER}/content.tex`);
  fs.writeFileSync(outputPath, latexOnly);

  // 4) backup old version
  const now = new Date();
  const stamp = `${String(now.getMonth()+1).padStart(2,'0')}_${now.getFullYear()}`;
  const safeName = `${job.firma}_${job.stillingstittel}`.replace(/[\/\\:*?"<>|]/g,'_');
  const backupDir  = path.resolve(`${CV_FOLDER}/oldContentFiles`);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(
    path.join(backupDir, `${safeName}_${stamp}.tex`),
    latexOnly
  );

  // 5) compile to PDF
  await execAsync('latexmk -pdf cv.tex', { cwd: CV_FOLDER });
  const pdfPath = path.resolve(CV_FOLDER, 'cv.pdf');
  const fileName = `${safeName}_${stamp}.pdf`;

  // 6) upload (or update) in Google Drive
  const auth   = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const client = await auth.getClient();
  const drive  = google.drive({ version: 'v3', auth: client });

  // see if it already exists
  const listRes = await drive.files.list({
    q: `'${DRIVE_FOLDER_ID}' in parents and name='${fileName}' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive'
  });

  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(pdfPath)
  };

  let fileId;
  if ((listRes.data.files||[]).length) {
    // update
    const updateRes = await drive.files.update({
      fileId: listRes.data.files[0].id,
      media
    });
    fileId = updateRes.data.id;
  } else {
    // create
    const createRes = await drive.files.create({
      resource: {
        name: fileName,
        mimeType: 'application/pdf',
        parents: [DRIVE_FOLDER_ID]
      },
      media,
      fields: 'id'
    });
    fileId = createRes.data.id;
  }

  return fileId;
}

// allow CLI invocation
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCV()
    .then(id => console.log(`RETURN_FILE_ID::${id}`))
    .catch(err => {
      console.error('❌ Error in generateCV:', err);
      process.exit(1);
    });
}
