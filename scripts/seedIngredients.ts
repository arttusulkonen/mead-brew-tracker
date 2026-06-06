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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const seedData: (IngredientUnion & { id: string })[] = [
  {
    id: 'honey_orange_blossom',
    name: 'Orange Blossom Honey',
    category: 'Honey',
    sugarContentBrix: 80.0,
    moistureContentPct: 18.0,
    origin: 'USA',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'honey_wildflower',
    name: 'Wildflower Honey',
    category: 'Honey',
    sugarContentBrix: 82.0,
    moistureContentPct: 17.0,
    origin: 'Global',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'yeast_lalvin_d47',
    name: 'Lalvin ICV D47',
    category: 'Yeast',
    tempMinC: 15,
    tempMaxC: 20,
    alcoholTolerancePct: 14.0,
    nitrogenDemand: 'Low',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'yeast_lalvin_ec1118',
    name: 'Lalvin EC-1118',
    category: 'Yeast',
    tempMinC: 10,
    tempMaxC: 30,
    alcoholTolerancePct: 18.0,
    nitrogenDemand: 'Low',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'yeast_lalvin_71b',
    name: 'Lalvin 71B',
    category: 'Yeast',
    tempMinC: 15,
    tempMaxC: 30,
    alcoholTolerancePct: 14.0,
    nitrogenDemand: 'Medium',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'additive_fermaid_o',
    name: 'Fermaid O',
    category: 'Additive',
    additiveType: 'Nutrient',
    yanValuePerGramPerLiter: 40.0,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'additive_go_ferm',
    name: 'Go-Ferm Protect Evolution',
    category: 'Additive',
    additiveType: 'Nutrient',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'additive_pectic_enzyme',
    name: 'Pectic Enzyme',
    category: 'Additive',
    additiveType: 'Clarifier',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'additive_k_sorbate',
    name: 'Potassium Sorbate',
    category: 'Additive',
    additiveType: 'Stabilizer',
    updatedAt: new Date().toISOString(),
  }
];

async function seedIngredients() {
  const batch = db.batch();

  for (const ingredient of seedData) {
    const docRef = db.collection('ingredients').doc(ingredient.id);
    batch.set(docRef, ingredient, { merge: true });
  }

  try {
    await batch.commit();
  } catch (error) {
    process.exit(1);
  }
}

seedIngredients();