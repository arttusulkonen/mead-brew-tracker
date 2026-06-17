import { generate } from "@genkit-ai/ai";
import { configureGenkit } from "@genkit-ai/core";
import { gemini15Flash, googleAI } from "@genkit-ai/googleai";
import * as logger from "firebase-functions/logger";
import { setGlobalOptions } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

configureGenkit({
  plugins: [googleAI()],
  logLevel: "info",
  enableTracingAndMetrics: true,
});

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
  volumeLiters: z.number().positive(),
  selectedIngredients: z.array(z.any())
});

export const generateRecipeAI = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to generate recipes.");
  }

  const parsedData = RequestDataSchema.safeParse(request.data);
  if (!parsedData.success) {
    throw new HttpsError("invalid-argument", "Invalid payload structure.", parsedData.error);
  }

  const { style, volumeLiters, selectedIngredients } = parsedData.data;

  const prompt = `
    Ты — профессиональный мастер-технолог классических медовух.
    Пользователь хочет сварить ${volumeLiters} литров медовухи в стиле "${style}".
    
    Вот ингредиенты, которые есть у пользователя (с их характеристиками):
    ${JSON.stringify(selectedIngredients, null, 2)}
    
    Твоя задача:
    1. Рассчитать идеальные граммовки для хмеля (опираясь на Альфа-кислотность), дрожжей и добавок. Мёд рассчитывать не нужно.
    2. Расписать подробные технологические шаги (Preparation, Fermentation, Aging).
    3. Обязательно учитывай температурные режимы (Толерантность дрожжей).
    
    Верни результат СТРОГО в указанном JSON формате.
  `;

  try {
    const aiResponse = await generate({
      model: gemini15Flash,
      prompt: prompt,
      output: { schema: RecipeGenerationSchema }
    });

    return { status: "success", data: aiResponse.output() };
  } catch (error) {
    logger.error("AI Generation failed", error);
    throw new HttpsError("internal", "Failed to generate recipe. Please try again later.");
  }
});