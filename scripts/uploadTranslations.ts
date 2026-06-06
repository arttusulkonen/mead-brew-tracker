import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolvedKeyPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(resolvedKeyPath)) {
  console.error(`❌ serviceAccountKey.json not found at: ${resolvedKeyPath}`);
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(fs.readFileSync(resolvedKeyPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}

const db = admin.firestore();
const languages = ['en', 'ru'];

async function uploadTranslations() {
  console.log('Starting translation upload...');

  for (const lang of languages) {
    try {
      const filePath = path.join(
        __dirname,
        '..',
        'public',
        'locales',
        lang,
        'translation.json'
      );

      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Translation file missing for: ${lang.toUpperCase()}`);
        continue;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const translations = JSON.parse(fileContent);
      const docRef = db.collection('translations').doc(lang);
      await docRef.set(translations, { merge: true });

      console.log(
        `✅ Successfully uploaded translations for: ${lang.toUpperCase()}`
      );
    } catch (error) {
      console.error(error);
    }
  }
}

uploadTranslations();