import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
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
  const batch = db.batch();
  
  try {
    const snapshot = await db.collection('ingredients').get();
    if (snapshot.empty) {
      console.log('No ingredients found to clean.');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('All placeholder ingredients deleted from global catalog.');
  } catch (error) {
    console.error('Failed to clean ingredients collection:', error);
    process.exit(1);
  }
}

clearIngredients();