import { googleAI } from "@genkit-ai/google-genai";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { knowledgeBase } from "./knowledge_base";
import { systemRules } from "./mead_rules";

const geminiApiKey = defineSecret("GOOGLE_GENAI_API_KEY");

setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

const RecipeGenerationSchema = z.object({
  ingredientQuantities: z.array(z.object({
    ingredientId: z.string(),
    suggestedQuantityGrams: z.number(),
    aiNote: z.string()
  })),
  steps: z.array(z.object({
    phase: z.enum(["Preparation", "Fermentation", "Aging"]),
    title: z.string(),
    description: z.string(),
    durationValue: z.number(),
    durationUnit: z.enum(["minutes", "days"]),
    targetTempC: z.number().nullable()
  }))
});

const RequestDataSchema = z.object({
  style: z.string(),
  sweetness: z.string(),
  honeyTerroir: z.string(),
  targetAbv: z.number().positive(),
  batchSizeLiters: z.number().positive(),
  targetFg: z.number().positive(),
  ingredients: z.array(z.object({
    ingredientId: z.string().optional(),
    globalIngredientId: z.string().optional(),
    name: z.string(),
    category: z.string(),
    quantity: z.number()
  }))
});

export const generateRecipeAI = onCall(
  { secrets: [geminiApiKey] }, 
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Unauthenticated");
    }

    const parsedData = RequestDataSchema.safeParse(request.data);
    if (!parsedData.success) {
      throw new HttpsError("invalid-argument", "Invalid payload");
    }

    process.env.GEMINI_API_KEY = geminiApiKey.value();

    const ai = genkit({
      plugins: [googleAI({ apiKey: geminiApiKey.value() })],
    });

    const { style, sweetness, honeyTerroir, targetAbv, batchSizeLiters, targetFg, ingredients } = parsedData.data;

    try {
      const userPrompt = `
        # KNOWLEDGE BASE
        ${knowledgeBase}

        # CURRENT USER REQUEST
        - Style ID: ${style}
        - Sweetness ID: ${sweetness}
        - Honey Terroir ID: ${honeyTerroir}
        - Target ABV: ${targetAbv}%
        - Batch Size: ${batchSizeLiters} Liters
        - Target Final Gravity (FG): ${targetFg}

        # SELECTED INGREDIENTS
        ${JSON.stringify(ingredients, null, 2)}

        TASK:
        1. Evaluate the provided ingredients. Do NOT calculate honey grams. Calculate precise dosages for yeast nutrients, hops, and additives.
        2. Generate detailed technological steps strictly following constraints.
        3. Generate the text in Russian.
      `;

      const aiResponse = await ai.generate({
        model: "gemini-2.5-flash",
        system: systemRules,
        prompt: userPrompt,
        output: { schema: RecipeGenerationSchema }
      });

      return { status: "success", data: aiResponse.output };

    } catch (error) {
      console.error(error);
      throw new HttpsError("internal", "AI Generation failed");
    }
  }
);