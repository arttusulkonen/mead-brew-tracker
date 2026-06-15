import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IngredientUnion } from '../src/types/ingredient';

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

const seedData: (IngredientUnion & { id: string })[] = [
  {
    id: 'honey_oiemesi',
    name: 'Õiemesi (Эстонское разнотравье)',
    category: 'Honey',
    sugarContentBrix: 80.0,
    moistureContentPct: 18.0,
    origin: 'Estonia',
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'yeast_s04',
    name: 'Fermentis SafAle S-04',
    category: 'Yeast',
    tempMinC: 15,
    tempMaxC: 20,
    alcoholTolerancePct: 11.0,
    nitrogenDemand: 'Medium',
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'hops_saaz_2024',
    name: 'Saaz 2024',
    category: 'Hops',
    alphaAcidPct: 2.9,
    origin: 'Czech Republic',
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'additive_lalbrew_nutrient',
    name: 'LalBrew Yeast Nutrition',
    category: 'Additive',
    additiveType: 'Nutrient',
    yanValuePerGramPerLiter: 40.0,
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'additive_cinnamon',
    name: 'Корица (Cinnamon)',
    category: 'Additive',
    additiveType: 'Spice',
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  },
  {
    id: 'additive_nutmeg',
    name: 'Мускатный орех (Nutmeg)',
    category: 'Additive',
    additiveType: 'Spice',
    updatedAt: new Date().toISOString(),
    createdBy: 'system'
  }
];

async function seedIngredients() {
  if (!db) return;
  const batch = db.batch();

  for (const ingredient of seedData) {
    if (!ingredient || !ingredient.id) continue;
    const docRef = db.collection('ingredients').doc(ingredient.id);
    batch.set(docRef, ingredient, { merge: true });
  }

  try {
    await batch.commit();
    console.log('Ingredients seeded successfully.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedIngredients();