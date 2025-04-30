import { google } from 'googleapis';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: './credentials/.env' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateCoverLetter(job, docId) {
  const auth = new google.auth.GoogleAuth({
    keyFile: './credentials/googleDrive.json',
    scopes: ['https://www.googleapis.com/auth/documents']
  });

  const client = await auth.getClient();
  const docs = google.docs({ version: 'v1', auth: client });
  const { llmSettings = {} } = job;
  const language = llmSettings.språk; //default to 'Norwegian Nynorsk'
  const tone = llmSettings.tone; //default to 'profesjonell'
  const model = llmSettings.model;

  const prompt = `Write a short, professional placeholder cover letter for a job titled "${job.stillingstittel}" at "${job.firma}".`;

  const chat = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: 'system',
        content: `You are a cover letter generator. Your task is to create ${tone} and concise cover letters in ${language}.`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  const letter = chat.choices[0].message.content;

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

  console.log(`✅ Cover letter written to doc ${docId}`);
}
