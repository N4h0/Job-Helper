import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { extractGoogleId } from './helperFunctions.js';

// ES-module __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load environment and options
dotenv.config({ path: path.resolve(__dirname, '../credentials/.env') });
const options = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../options.json'), 'utf-8')
);

// Configure source (Drive) and local destination file
const SOURCE_FOLDER_ID = extractGoogleId(options.jobJSONObjects);
const DEST_PATH         = path.resolve(__dirname, '..');  // one level above script folder
const LOCAL_DEST_FILE   = 'debug-latest-job.json';       // overwrite this file

if (!SOURCE_FOLDER_ID) {
  throw new Error(
    `Could not extract Drive folder ID from options.jobJSONObjects="${options.jobJSONObjects}"`
  );
}

// Authenticate with Google Drive
async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(__dirname, '../credentials/googleDrive.json'),
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const client = await auth.getClient();
  return google.drive({ version: 'v3', auth: client });
}

// List matching files in Drive folder
async function listFilesInFolder(drive, folderId, fileName) {
  console.log(`Searching for file "${fileName}" in Google Drive folder ${folderId}...`);
  const query = `'${folderId}' in parents and name='${fileName}' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name, modifiedTime)',
    spaces: 'drive',
  });
  return res.data.files || [];
}

// Download file to local DEST_PATH as debug-latest-job.json, replacing existing
async function downloadFile(drive, file) {
  const destFilePath = path.join(DEST_PATH, LOCAL_DEST_FILE);

  // Ensure DEST_PATH exists
  await fsPromises.mkdir(DEST_PATH, { recursive: true });

  // Remove existing local file if present
  try {
    await fsPromises.access(destFilePath);
    console.log(`Replacing existing file at ${destFilePath}`);
    await fsPromises.unlink(destFilePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  // Get file stream from Drive
  const res = await drive.files.get(
    { fileId: file.id, alt: 'media' },
    { responseType: 'stream' }
  );

  // Pipe to local file
  await new Promise((resolve, reject) => {
    const destStream = fs.createWriteStream(destFilePath);
    res.data
      .on('end', () => {
        console.log(`File replaced successfully at: ${destFilePath}`);
        resolve();
      })
      .on('error', err => reject(err))
      .pipe(destStream);
  });
}

// Main
async function main() {
  // Join all args as one filename (handles spaces)
  const rawName = process.argv.slice(2).join(' ');
  if (!rawName) {
    console.error('Usage: node moveLatestByName.js "<fileName>"');
    process.exit(1);
  }
  // Append .json if not provided
  const fileName = rawName.endsWith('.json') ? rawName : `${rawName}.json`;

  const drive = await getDriveClient();

  // 1) Find all matching in Drive
  const files = await listFilesInFolder(drive, SOURCE_FOLDER_ID, fileName);
  if (files.length === 0) {
    console.error(`Could not find file "${fileName}" in Drive.`);
    process.exit(2);
  }
  if (files.length > 1) {
    console.error(
      `Multiple files named "${fileName}" found in Drive folder (found ${files.length}). Please ensure only one exists.`
    );
    process.exit(3);
  }

  // 2) Download and replace debug-latest-job.json
  const file = files[0];
  console.log(`Found file (modified ${file.modifiedTime}): ${file.name}`);

  await downloadFile(drive, file);
}

// Execute main
main().catch(err => {
  console.error('Error:', err.message);
  process.exit(99);
});
