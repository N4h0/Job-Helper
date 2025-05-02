import { google } from 'googleapis';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: './credentials/.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateCoverLetter() {
  const jobFilePath = './debug-latest-job.json';

  if (!fs.existsSync(jobFilePath)) {
    console.error('❌ Could not find debug-latest-job.json');
    process.exit(1);
  }

  const job = JSON.parse(fs.readFileSync(jobFilePath, 'utf-8'));
  const docId = job.generatedDocId;

  if (!docId) {
    console.error('❌ No generatedDocId found in the job object');
    return;
  }

  const { llmSettings = {} } = job;

  const language = llmSettings.språk || 'nynorsk';
  const tone = llmSettings.tone || 'profesjonell';
  const model = llmSettings.model || 'gpt-4';
  const maxLength = llmSettings.maxLength || 350;
  const cvName = llmSettings.resumePreset?.toLowerCase().replace('resume – ', '') || 'simple';

  const jobDesc = job.jobDescription || '';
  const companyDesc = job.companyDescription || '';
  const title = job.stillingstittel || '';
  const company = job.firma || '';

  let cvText = '';
  try {
    const cvPath = path.resolve('CVer', `${cvName}.txt`);
    cvText = fs.readFileSync(cvPath, 'utf8');
  } catch (err) {
    console.warn(`⚠️ Could not load CV file: CVer/${cvName}.txt`, err);
  }

  const prompt = `
You are a helpful assistant writing a short, professional, and truthful job application letter.

Only use the information provided in the CV and job description. Do not make up skills or experience. Highlight what is most relevant to the position, and explain why the candidate is a good match.

Tone: ${tone}
Language: ${language}
Max words: ${maxLength}

== Job Title ==
${title}

== Company ==
${company}

== Job Description ==
${jobDesc}

== Company Description ==
${companyDesc}

== CV ==
${cvText}
`;

  const chat = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: `You are a cover letter generator. Be clear, concise, and professional. Follow the user's instructions.`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const letter = chat.choices[0].message.content;

  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/documents']
  });

  const client = await auth.getClient();
  const docs = google.docs({ version: 'v1', auth: client });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: `${letter}\n\n`
          }
        }
      ]
    }
  });

  console.log(`✅ Cover letter written to doc: https://docs.google.com/document/d/${docId}`);
}

// If run directly from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCoverLetter();
}
