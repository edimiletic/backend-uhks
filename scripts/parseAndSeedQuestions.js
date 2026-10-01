require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { QuestionBank } = require('../models/Exams');

const RAW_PATH = path.join(__dirname, 'baza-pitanja-raw.txt');

const normalize = (text) =>
  text.replace(/\s+/g, ' ').replace(/\s+([?.!])/g, '$1').trim();

const parseQuestions = (raw) => {
  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/Redni broj\s+Tekst pitanja\s+Točan odgovor/g, '')
    .replace(/-- \d+ of \d+ --/g, '\n')
    .trim();

  // Question numbers sit at the start of a line: alone, then a tab, or then a capital letter.
  const chunks = cleaned.split(/(?:^|\n)(\d{1,3})(?=\s)(?=\s*(?:$|[A-ZČĆŠĐŽI„"']))/);
  const questions = [];

  for (let i = 1; i < chunks.length; i += 2) {
    const number = Number(chunks[i]);
    const body = (chunks[i + 1] || '').trim();
    const match = body.match(/^(.*?)(?:\s+)(DA|NE)\s*$/s);
    if (!match || !number) {
      console.warn(`Could not parse question ${number || i}`);
      continue;
    }
    questions.push({
      number,
      questionText: normalize(match[1]),
      correctAnswer: match[2] === 'DA',
      category: 'FIBA pravila',
      isActive: true
    });
  }

  return questions;
};

const seed = async () => {
  const raw = fs.readFileSync(RAW_PATH, 'utf8');
  const parsed = parseQuestions(raw);
  const unique = [];
  const seen = new Set();
  for (const question of parsed) {
    const key = question.questionText.toLowerCase();
    if (seen.has(key)) {
      console.log(`Skip duplicate #${question.number}`);
      continue;
    }
    seen.add(key);
    unique.push(question);
  }

  if (unique.length < 25) {
    throw new Error(`Parsed only ${unique.length} questions, need at least 25`);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverApi: { version: '1', strict: true, deprecationErrors: true }
  });

  await QuestionBank.deleteMany({});
  await QuestionBank.insertMany(
    unique.map(({ questionText, correctAnswer, category, isActive }) => ({
      questionText,
      correctAnswer,
      category,
      isActive
    }))
  );

  const count = await QuestionBank.countDocuments({ isActive: true });
  console.log(`Seeded ${unique.length} unique questions (${parsed.length} parsed from source)`);
  console.log(`Active questions in DB: ${count}`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
