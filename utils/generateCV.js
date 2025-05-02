import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { google } from 'googleapis';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

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
  fs.copyFileSync(templatePath, outputPath);

  const backupDir = path.resolve(`${cvFolder}/oldContentFiles`);
  const backupPath = path.resolve(backupDir, `${fileSafeName}_${formattedDate}.tex`);
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(outputPath, backupPath);

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
