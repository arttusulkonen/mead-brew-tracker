import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resolvedKeyPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(resolvedKeyPath)) {
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedKeyPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function clearIngredients() {
  if (!db) return;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Are you sure you want to delete ALL ingredients? (y/N) ', async (answer) => {
    if (answer.toLowerCase() !== 'y') {
      rl.close();
      return;
    }

    try {
      const snapshot = await db.collection('ingredients').get();
      if (snapshot.empty) {
        rl.close();
        return;
      }

      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 500) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + 500);
        chunk.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }
      console.log('All ingredients deleted.');
    } catch (error) {
      console.error(error);
      process.exit(1);
    } finally {
      rl.close();
    }
  });
}

clearIngredients();