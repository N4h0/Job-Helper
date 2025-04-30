import { google } from 'googleapis';
import { config } from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs';

config({ path: './credentials/.env' });


// 1. Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 2. Get basic text
async function generateText() {
  const chat = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: "You are a helpful assistant writing cover letters." },
      { role: "user", content: "Write a short sentence as a placeholder cover letter." }
    ]
  });

  return chat.choices[0].message.content;
}

// 3. Write to a Google Doc
async function addToGoogleDoc(docId, text) {
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
            location: { index: 1 }, // Beginning of document
            text: `${text}\n\n`
          }
        }
      ]
    }
  });

  console.log('✅ Text added to document!');
}

// 4. Run it
const docId = '1fx8ycy-6_9Ozv5hvpRUlFyw2h_xZFwF24NtM1LLXqLk'; // Replace with actual Google Doc ID

generateText()
  .then(text => addToGoogleDoc(docId, text))
  .catch(console.error);