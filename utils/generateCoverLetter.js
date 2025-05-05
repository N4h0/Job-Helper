import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { extractGoogleId } from './helperFunctions.js';
import { fileURLToPath } from 'url';

dotenv.config({ path: './credentials/.env' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// — load options.json so you can pull in any Drive/Sheets IDs if needed later —
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const options    = JSON.parse(fs.readFileSync(path.join(__dirname, '../options.json'), 'utf-8')
);

export async function generateCoverLetter(job, documentId) {
  const { llmSettings = {} } = job;
  const language = llmSettings.språk;
  const tone     = llmSettings.tone;
  const model    = llmSettings.model;
  const maxWords = llmSettings.maxLength || 350;
  const cvPreset = llmSettings.resumePreset?.toLowerCase().replace('resume – ', '') || 'simple';

  // load your locally-rendered CV text (if you have variants here)
  let cvText = '';
  try {
    cvText = fs.readFileSync(path.resolve('CVer', `${cvPreset}.txt`), 'utf8');
  } catch (err) {
    console.warn(`⚠️ Could not load CV file: CVer/${cvPreset}.txt`, err);
  }

  const prompt = `
You are a helpful assistant writing a short, professional, and truthful job application letter.
Tone: ${tone}
Language: ${language}
Max words: ${maxWords}

== Job Title ==
${job.stillingstittel}

== Company ==
${job.firma}

== Job Description ==
${job.jobDescription}

== Company Description ==
${job.companyDescription}

== CV ==
${cvText}
`;

  const chat = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: 'You are a cover letter generator. Be clear, concise, and professional.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const letter = chat.choices[0].message.content;

  // connect to Docs API
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/documents']
  });
  const client = await auth.getClient();
  const docs   = google.docs({ version: 'v1', auth: client });

  // fetch existing content
  const doc = await docs.documents.get({ documentId });
  const body = doc.data.body?.content || [];
  const endIndex = body.length ? (body[body.length - 1].endIndex || 1) : 1;

  const requests = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } }
    });
  }
  requests.push({
    insertText: { location: { index: 1 }, text: `${letter}\n\n` }
  });

  await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });

  console.log(`✅ Cover letter written to doc: https://docs.google.com/document/d/${documentId}`);
}
