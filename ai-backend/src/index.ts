import { googleAI } from "@genkit-ai/google-genai";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { knowledgeBase } from "./knowledge_base";
import { systemRules } from "./mead_rules";

const geminiApiKey = defineSecret("GOOGLE_GENAI_API_KEY");

setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

// Схема ответа ИИ (включает все фазы пивоварения и сидроделия)
const RecipeGenerationSchema = z.object({
  ingredientQuantities: z.array(z.object({
    ingredientId: z.string(),
    suggestedQuantityGrams: z.number(),
    aiNote: z.string()
  })),
  steps: z.array(z.object({
    phase: z.enum(["Preparation", "Mashing", "Boiling", "Fermentation", "Aging", "Packaging"]),
    title: z.string(),
    description: z.string(),
    durationValue: z.number(),
    durationUnit: z.enum(["minutes", "days"]),
    targetTempC: z.number().nullable()
  }))
});

// Схема входящих данных от клиента
const RequestDataSchema = z.object({
  beverageType: z.string().optional().default("Mead"),
  style: z.string(),
  sweetness: z.string().optional(),
  honeyTerroir: z.string().optional(),
  targetAbv: z.number().positive(),
  batchSizeLiters: z.number().positive(),
  targetFg: z.number().positive(),
  ingredients: z.array(z.object({
    ingredientId: z.string(),
    globalIngredientId: z.string().nullable().optional(),
    name: z.string(),
    category: z.string(),
    quantity: z.number(),
    nutrientRole: z.string().optional(),
    additiveType: z.string().optional()
  }).passthrough()),
  locale: z.string().optional()
}).passthrough();

const LANGUAGE_MAPPING: Record<string, string> = {
  ru: "Russian (Русский язык)",
  en: "English",
  fi: "Finnish (Suomi)"
};

export const generateRecipeAI = onCall(
  { secrets: [geminiApiKey] }, 
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be authenticated to generate recipes.");
    }

    const parsedData = RequestDataSchema.safeParse(request.data);
    if (!parsedData.success) {
      console.error("Zod Validation Error:", parsedData.error);
      throw new HttpsError("invalid-argument", "Invalid payload format provided by the client.");
    }

    process.env.GEMINI_API_KEY = geminiApiKey.value();

    const ai = genkit({
      plugins: [googleAI({ apiKey: geminiApiKey.value() })],
    });

    const { beverageType, style, sweetness, honeyTerroir, targetAbv, batchSizeLiters, targetFg, ingredients, locale } = parsedData.data;
    const cleanLocale = (locale || "en").split("-")[0].toLowerCase();
    const targetLanguage = LANGUAGE_MAPPING[cleanLocale] || "English";

    try {
      const userPrompt = `
        # KNOWLEDGE BASE
        ${knowledgeBase}

        # CURRENT USER REQUEST
        - Beverage Type: ${beverageType}
        - Style / Category ID: ${style}
        - Sweetness / FG Tier: ${sweetness || 'N/A'}
        - Honey Terroir (if Mead): ${honeyTerroir || 'N/A'}
        - Target ABV: ${targetAbv}%
        - Batch Size: ${batchSizeLiters} Liters
        - Target Final Gravity (FG): ${targetFg}

        # SELECTED INGREDIENTS
        ${JSON.stringify(ingredients, null, 2)}

        TASK:
        1. Evaluate the provided ingredients based on their categories and 'nutrientRole' (Rehydration vs Fermentation).
        2. Calculate precise dosages for yeast nutrients, hops, and additives based on the Batch Size and Target ABV. Do NOT recalculate the base fermentable weights.
        3. Generate detailed technological steps strictly following the constraints for the specific Beverage Type.
        4. CRITICAL TRANSLATION: You MUST generate "title", "description" (inside steps) and "aiNote" (inside ingredientQuantities) strictly in ${targetLanguage}. 
        5. CRITICAL STRUCTURAL RULE: The "phase" field MUST remain strictly in English ("Preparation", "Mashing", "Boiling", "Fermentation", "Aging", "Packaging") regardless of the target language.
      `;

      const aiResponse = await ai.generate({
        model: "googleai/gemini-3.1-flash-lite",
        system: systemRules,
        prompt: userPrompt,
        output: { schema: RecipeGenerationSchema }
      });

      return { status: "success", data: aiResponse.output };

    } catch (error) {
      console.error("AI Generation Error:", error);
      throw new HttpsError("internal", "AI Generation failed.");
    }
  }
);