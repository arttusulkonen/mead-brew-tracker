import { googleAI } from '@genkit-ai/google-genai';
import * as fs from 'fs';
import { genkit, z } from 'genkit';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GOOGLE_GENAI_API_KEY or GEMINI_API_KEY environment variable.');
  process.exit(1);
}

const langsConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../languages.json'), 'utf8')
);

const ai = genkit({
  plugins: [googleAI({ apiKey })],
  model: 'googleai/gemini-3.1-flash-lite',
});

const localesDir = path.resolve(__dirname, '../public/locales');
const targetLocales = Object.keys(langsConfig.localeNames);
const localeNames: Record<string, string> = langsConfig.localeNames;

const constantsPath = path.join(localesDir, 'en', 'constants.json');
const constants = fs.existsSync(constantsPath) 
  ? JSON.parse(fs.readFileSync(constantsPath, 'utf8')) 
  : {};

async function translateMissing() {
  for (const locale of targetLocales) {
    const filePath = path.join(localesDir, locale, 'translation.json');

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}`);
      continue;
    }

    let translations = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // --- ИСПРАВЛЕННАЯ ЛОГИКА СИНХРОНИЗАЦИИ ---
    Object.keys(constants).forEach(key => {
      if (locale === 'en') {
        // Для английского языка ВСЕГДА берем эталонное значение из constants.json
        translations[key] = constants[key];
      } else {
        // Для других языков: сбрасываем значение, если ключа нет или парсер случайно записал ключ вместо текста
        if (!(key in translations) || translations[key] === key) {
          translations[key] = '';
        }
      }
    });

    const missingKeys = Object.keys(translations).filter(
      (key) => translations[key] === '',
    );

    if (missingKeys.length === 0) {
      console.log(`✅ No empty strings for [${locale}]`);
      fs.writeFileSync(filePath, JSON.stringify(translations, null, 2) + '\n', 'utf8');
      continue;
    }

    console.log(`⏳ Translating ${missingKeys.length} keys for [${locale}]...`);

    const batchSize = 15;
    for (let i = 0; i < missingKeys.length; i += batchSize) {
      const batchKeys = missingKeys.slice(i, i + batchSize);
      const inputItems = batchKeys.map((key) => ({
        originalKey: key,
        textToTranslate: key.includes('.') ? constants[key] || key : key,
      }));

      try {
        const response = await ai.generate({
          prompt: `You are an expert translator specializing in brewing (beer, cider) and mead-making terminology. Translate the 'textToTranslate' fields from English to ${localeNames[locale]}.
          Context: A professional SaaS platform for craft brewers and mead makers (Ingria Brewcraft).
          
          CRITICAL RULES:
          1. You MUST return exactly ${batchKeys.length} items in the array.
          2. Maintain EXACTLY the same 'originalKey' in your response.
          3. Do not translate placeholder variables like {{count}} or {{opponent}}.
          4. For short units of measurement (g, kg, L, ml, oz, lb, gal, ppm), use the standard local abbreviation (e.g., 'kg' -> 'кг' in Russian, 'lb' -> 'фунт').
          
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
        console.error(`❌ Error translating batch for ${locale}:`, error);
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
    console.log(`🎉 File [${locale}] updated!`);
  }
}

translateMissing()
  .then(() => console.log('🚀 Translations completed!'))
  .catch(console.error);