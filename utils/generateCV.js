import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { google } from 'googleapis';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config({ path: './credentials/.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const execAsync = promisify(exec);

export async function generateCV() {
  const jobPath = './debug-latest-job.json';
  const cvFolder = './LatexCV';

  const job = JSON.parse(fs.readFileSync(jobPath, 'utf-8'));
  const lang = job.llmSettings?.språk || 'english';
  const profile = job.llmSettings?.resumePreset || 'simple';

  const templatePath = path.resolve(`${cvFolder}/contentTemplates/${lang}/${profile}.tex`);
  const outputPath = path.resolve(`${cvFolder}/content.tex`);
  const fileSafeName = `${job.firma}_${job.stillingstittel}`.replace(/[\/\\:*?"<>|]/g, '_');
  const now = new Date();
  const formattedDate = `${String(now.getMonth() + 1).padStart(2, '0')}_${now.getFullYear()}`;

  if (!fs.existsSync(templatePath)) throw new Error(`Template not found: ${templatePath}`);

  const templateContent = fs.readFileSync(templatePath, 'utf-8');

  const prompt = `You are a helpful assistant updating a LaTeX CV for a specific job application.
Only modify the text content of the LaTeX source to better match the job, without changing formatting.
Keep the length roughly the same and do not invent any qualifications.
Write in the same language as the CV template: ${lang}.

Job Title: ${job.stillingstittel}
Company: ${job.firma}

Job Description:
${job.jobDescription || 'Not provided'}

Company Description:
${job.companyDescription || 'Not provided'}

LaTeX CV Template:
${templateContent}`;

  const chat = await openai.chat.completions.create({
    model: job.llmSettings?.model,
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant that updates LaTeX resumes to match job descriptions.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const tailoredCV = chat.choices[0].message.content;
  fs.writeFileSync(outputPath, tailoredCV);

  const backupDir = path.resolve(`${cvFolder}/oldContentFiles`);
  const backupPath = path.resolve(backupDir, `${fileSafeName}_${formattedDate}.tex`);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.writeFileSync(backupPath, tailoredCV);

  await execAsync('latexmk -pdf cv.tex', { cwd: cvFolder });

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  const client = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: client });

  const fileName = `${fileSafeName}_${formattedDate}.pdf`;
  const driveFolderId = '1AqQhCSsLCNlMe_6l1D6ncK8LYey9aFJ0';
  const cvPdfPath = path.resolve(cvFolder, 'cv.pdf');

  const listRes = await drive.files.list({
    q: `'${driveFolderId}' in parents and name='${fileName}' and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive'
  });

  const media = {
    mimeType: 'application/pdf',
    body: fs.createReadStream(cvPdfPath)
  };

  let fileId;
  if (listRes.data.files.length > 0) {
    const updateRes = await drive.files.update({
      fileId: listRes.data.files[0].id,
      media
    });
    fileId = updateRes.data.id;
  } else {
    const createRes = await drive.files.create({
      resource: {
        name: fileName,
        mimeType: 'application/pdf',
        parents: [driveFolderId]
      },
      media,
      fields: 'id'
    });
    fileId = createRes.data.id;
  }

  return fileId;
}

// CLI entrypoint:
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateCV()
    .then(id => console.log(`RETURN_FILE_ID::${id}`))
    .catch(err => {
      console.error('❌ Error in generateCV:', err.message);
      process.exit(1);
    });
}
