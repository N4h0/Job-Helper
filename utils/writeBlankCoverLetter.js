import { google } from 'googleapis';
import path from 'path';

export async function writeBlankCoverLetter(documentId) {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/documents'],
  });
  const client = await auth.getClient();
  const docs = google.docs({ version: 'v1', auth: client });

  // Get current content length
  const doc = await docs.documents.get({ documentId });
  const body = doc.data.body?.content || [];
  const endIndex = body.length ? (body[body.length - 1].endIndex || 1) : 1;

  const requests = [];

  // Remove old content if it exists
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } }
    });
  }

  // Insert a placeholder or empty string
  requests.push({
    insertText: { location: { index: 1 }, text: '\n\n' }
  });

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });

  console.log(`📝 Blank cover letter inserted into doc: https://docs.google.com/document/d/${documentId}`);
}