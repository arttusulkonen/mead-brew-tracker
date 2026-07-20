// supabase/functions/generate-recipe/index.ts
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { knowledgeBase } from './knowledge_base.ts';
import { systemRules } from './mead_rules.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LANGUAGE_MAPPING: Record<string, string> = {
  ru: 'Russian (Русский язык)',
  en: 'English',
  fi: 'Finnish (Suomi)',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();

    if (!requestBody) {
      throw new Error('Empty request body');
    }

    const {
      beverageType,
      style,
      sweetness,
      honeyTerroir,
      targetAbv,
      batchSizeLiters,
      targetFg,
      isSafeBacksweetening, 
      isColdCrashEnabled, 
      ingredients,
      locale,
    } = requestBody;

    if (
      !ingredients ||
      !Array.isArray(ingredients) ||
      ingredients.length === 0
    ) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message:
            'No ingredients provided. Please add at least a base fermentable and yeast before generating the recipe.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const cleanLocale =
      typeof locale === 'string' ? locale.split('-')[0].toLowerCase() : 'en';
    const targetLanguage = LANGUAGE_MAPPING[cleanLocale] || 'English';

    const userPrompt = `  

      # KNOWLEDGE BASE
      ${knowledgeBase}

      # CURRENT USER REQUEST
      - Beverage Type: ${beverageType || 'N/A'}
      - Style / Category ID: ${style || 'N/A'}
      - Sweetness / FG Tier: ${sweetness || 'N/A'}
      - Honey Terroir (if Mead): ${honeyTerroir || 'N/A'}
      - Target ABV: ${targetAbv || 0}%
      - Batch Size: ${batchSizeLiters || 0} Liters
      - Target Final Gravity (FG): ${targetFg || 1.0}
      - Safe Homebrew Backsweetening Mode (Mjolnir Hack): ${isSafeBacksweetening ? 'ENABLED (Use Erythritol for sweetness)' : 'DISABLED (Use commercial stabilization)'}
      - Cold Crash (Refrigeration step): ${isColdCrashEnabled ? 'ENABLED (Include 3-day step at 2-4°C)' : 'DISABLED (Do NOT include Cold Crash. Clarify at room temp)'}

      # SELECTED INGREDIENTS WITH FRONTEND CALCULATED EXACT QUANTITIES
      ${JSON.stringify(ingredients, null, 2)}

      TASK:
      1. VALIDATE: Calculate the potential ABV of the base fermentable weight in the selected Batch Size. If it contradicts the requested Target ABV or Style (e.g., 5kg honey for 10L Session), set 'isMismatch: true' and write a correctionReason!
      2. STRICT MATH: For nutrients like Go-Ferm and Fermaid O, USE THE EXACT QUANTITIES from the JSON above in your step descriptions. Do NOT invent standard numbers like "6.25g".
      3. Generate detailed technological steps strictly following the NO-BOIL constraints for Mead/Cider and TOSNA rules.
      4. CRITICAL TRANSLATION: You MUST generate "title", "description" (inside steps), "aiNote", and "correctionReason" strictly in ${targetLanguage}. 
      5. CRITICAL STRUCTURAL RULE: The "phase" field MUST remain strictly in English ("Preparation", "Mashing", "Boiling", "Fermentation", "Conditioning", "Packaging") regardless of the target language.
      6. TONE RULE: Write descriptions like a friendly mentor! Explain WHY things are done, add 💡 tips, and use emojis like ⚠️ or 💡.
    `;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemRules }] },
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Gemini API Error: ${data.error?.message || response.statusText}`,
      );
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!aiText) {
      throw new Error('Received empty response from Gemini API');
    }

    const parsedJson = JSON.parse(aiText);

    return new Response(
      JSON.stringify({ status: 'success', data: parsedJson }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    return new Response(
      JSON.stringify({ status: 'error', message: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});