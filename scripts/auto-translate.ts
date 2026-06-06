import { googleAI } from '@genkit-ai/googleai';
import * as fs from 'fs';
import { genkit, z } from 'genkit';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey) {
  console.error('Missing GOOGLE_GENAI_API_KEY environment variable.');
  process.exit(1);
}

const langsConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../languages.json'), 'utf8')
);

const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
  model: 'googleai/gemini-3.1-flash-lite', 
});

const localesDir = path.resolve(__dirname, '../public/locales');
const targetLocales = Object.keys(langsConfig.localeNames);
const localeNames: Record<string, string> = langsConfig.localeNames;

async function translateMissing() {
  for (const locale of targetLocales) {
    const filePath = path.join(localesDir, locale, 'translation.json');

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      continue;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const translations = JSON.parse(fileContent);

    const missingKeys = Object.keys(translations).filter(
      (key) => translations[key] === '',
    );

    if (missingKeys.length === 0) {
      console.log(`✅ No empty strings for [${locale}]`);
      continue;
    }

    console.log(`⏳ Translating ${missingKeys.length} keys for [${locale}]...`);

    const batchSize = 15;
    for (let i = 0; i < missingKeys.length; i += batchSize) {
      const batchKeys = missingKeys.slice(i, i + batchSize);

      const inputItems = batchKeys.map((key) => ({
        originalKey: key,
        textToTranslate: key,
      }));

      try {
        const response = await ai.generate({
          prompt: `You are an expert translator specializing in brewing, mead-making, and fermentation terminology. Translate the 'textToTranslate' fields from English to ${localeNames[locale]}. 
          Context: A web application for homebrewing and mead-making (Mead & Brew Tracker). Key features include workspace management (Breweries), recipe formulation, ingredient inventory, detailed fermentation tracking (logs, Specific Gravity, pH, temperature, nutrients), and split batch management.
          
          CRITICAL RULES:
          1. You MUST return exactly ${batchKeys.length} items in the array.
          2. Maintain EXACTLY the same 'originalKey' in your response. Do not alter it in any way.
          3. Do not translate placeholder variables like {{count}} or {{opponent}}.
          4. Only translate the text into natural, UI-friendly language appropriate for the brewing domain.
          
          Data to translate:
          ${JSON.stringify(inputItems, null, 2)}`,
          output: {
            schema: z.array(
              z.object({
                originalKey: z.string(),
                translatedText: z.string(),
              }),
            ),
          },
        });

        const translatedBatch = response.output;

        if (translatedBatch && Array.isArray(translatedBatch)) {
          translatedBatch.forEach((item) => {
            if (item.originalKey && translations[item.originalKey] === '') {
              translations[item.originalKey] = item.translatedText;
            }
          });
        }
      } catch (error) {
        console.error(error);
      }
    }

    const sortedTranslations = Object.keys(translations)
      .sort()
      .reduce((acc: Record<string, string>, key) => {
        acc[key] = translations[key];
        return acc;
      }, {});

    fs.writeFileSync(
      filePath,
      JSON.stringify(sortedTranslations, null, 2) + '\n',
      'utf8',
    );
  }
}

translateMissing()
  .then(() => console.log('🚀 Translations completed!'))
  .catch(console.error);