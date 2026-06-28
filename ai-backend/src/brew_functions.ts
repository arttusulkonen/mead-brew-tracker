import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "genkit";

initializeApp();
const db = getFirestore();

export const aggregateRecipeStats = onDocumentUpdated(
  "breweries/{breweryId}/brew_sessions/{sessionId}",
  async (event) => {
    if (!event || !event.data || !event.data.after || !event.data.before) return;

    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();

    if (!beforeData || !afterData) return;
    if (afterData.status !== "completed" || beforeData.status === "completed") return;
    if (afterData.isAggregated === true) return;

    const recipeId = afterData.recipeId;
    const volume = typeof afterData.batchSizeLiters === "number" ? afterData.batchSizeLiters : 0;
    const abv = typeof afterData.actualAbv === "number" ? afterData.actualAbv : (typeof afterData.targetAbv === "number" ? afterData.targetAbv : 0);

    if (!recipeId) return;

    const recipeRef = db.collection("recipes").doc(recipeId);
    const sessionRef = event.data.after.ref;

    try {
      await db.runTransaction(async (transaction) => {
        const recipeDoc = await transaction.get(recipeRef);
        if (!recipeDoc || !recipeDoc.exists) return;

        const recipeData = recipeDoc.data();
        if (!recipeData) return;

        const currentTotalBrews = typeof recipeData.totalBrews === "number" ? recipeData.totalBrews : 0;
        const currentTotalVolume = typeof recipeData.totalVolumeLiters === "number" ? recipeData.totalVolumeLiters : 0;
        const currentAverageAbv = typeof recipeData.averageAbv === "number" ? recipeData.averageAbv : 0;

        const newTotalBrews = currentTotalBrews + 1;
        const newTotalVolume = currentTotalVolume + volume;
        const newAverageAbv = newTotalBrews > 0 ? ((currentAverageAbv * currentTotalBrews) + abv) / newTotalBrews : abv;

        transaction.update(recipeRef, {
          totalBrews: newTotalBrews,
          totalVolumeLiters: newTotalVolume,
          averageAbv: newAverageAbv,
          updatedAt: new Date().toISOString()
        });

        transaction.update(sessionRef, {
          isAggregated: true
        });
      });
    } catch (error) {
      throw new Error("Aggregation failed");
    }
  }
);

const SplitBatchSchema = z.object({
  breweryId: z.string(),
  parentSessionId: z.string(),
  splits: z.array(z.object({
    volumeLiters: z.number().positive(),
    namePostfix: z.string().trim().min(1)
  }))
});

export const splitBatch = onCall(async (request) => {
  if (!request || !request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Unauthenticated");
  }

  if (!request.data) {
    throw new HttpsError("invalid-argument", "No data provided");
  }

  const parsedData = SplitBatchSchema.safeParse(request.data);
  if (!parsedData || !parsedData.success || !parsedData.data) {
    throw new HttpsError("invalid-argument", "Invalid payload");
  }

  const { breweryId, parentSessionId, splits } = parsedData.data;

  if (!breweryId || !parentSessionId || !splits || splits.length === 0) {
    throw new HttpsError("invalid-argument", "Missing required fields");
  }

  const breweryRef = db.collection("breweries").doc(breweryId);
  const parentSessionRef = db.collection(`breweries/${breweryId}/brew_sessions`).doc(parentSessionId);

  try {
    await db.runTransaction(async (transaction) => {
      const breweryDoc = await transaction.get(breweryRef);
      if (!breweryDoc || !breweryDoc.exists) {
        throw new HttpsError("not-found", "Brewery not found");
      }

      const breweryData = breweryDoc.data();
      const uid = request.auth?.uid;
      
      if (!uid) {
        throw new HttpsError("unauthenticated", "Unauthenticated");
      }

      const isOwner = breweryData?.ownerId === uid;
      const isMember = Array.isArray(breweryData?.members) && breweryData.members.includes(uid);

      if (!isOwner && !isMember) {
        throw new HttpsError("permission-denied", "Unauthorized access to this brewery");
      }

      const parentDoc = await transaction.get(parentSessionRef);
      if (!parentDoc || !parentDoc.exists) {
        throw new HttpsError("not-found", "Parent session not found");
      }

      const parentData = parentDoc.data();
      if (!parentData) {
        throw new HttpsError("internal", "Parent data is empty");
      }

      if (parentData.isSplit === true) {
        throw new HttpsError("failed-precondition", "Session is already split");
      }
      
      const parentBatchSize = typeof parentData.batchSizeLiters === "number" ? parentData.batchSizeLiters : 0;
      const totalSplitVolume = splits.reduce((sum, split) => sum + (typeof split.volumeLiters === "number" ? split.volumeLiters : 0), 0);

      if (totalSplitVolume > parentBatchSize) {
        throw new HttpsError("invalid-argument", "Total split volume exceeds parent batch size");
      }

      const splitTimestamp = new Date().toISOString();
      const { logs, ...restParentData } = parentData;

      transaction.update(parentSessionRef, {
        isSplit: true,
        batchSizeLiters: 0,
        updatedAt: splitTimestamp
      });

      for (const split of splits) {
        if (!split || !split.namePostfix || typeof split.volumeLiters !== "number") continue;

        const childRef = db.collection(`breweries/${breweryId}/brew_sessions`).doc();
        const childData = {
          ...restParentData, 
          id: childRef.id,
          recipeName: `${parentData.recipeName} - ${split.namePostfix}`,
          batchSizeLiters: split.volumeLiters,
          parentSessionId: parentSessionId,
          splitTimestamp: splitTimestamp,
          createdAt: splitTimestamp,
          updatedAt: splitTimestamp,
          isAggregated: false,
          isSplit: false
        };

        transaction.set(childRef, childData);
      }
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Split batch failed");
  }
});

const StartSessionSchema = z.object({
  breweryId: z.string(),
  recipeId: z.string(),
  recipeName: z.string(),
  beverageType: z.string().default("Mead"), // Добавлена поддержка beverageType
  batchSizeLiters: z.number().positive(),
  targetOg: z.number().nullable().optional(),
  targetFg: z.number().nullable().optional(),
  sessionIngredients: z.array(z.object({
    globalIngredientId: z.string().min(1),
    quantity: z.number().positive()
  }).passthrough()),
  sessionSteps: z.array(z.record(z.any()))
});

/**
 * Processes an ingredient transaction against the brewery inventory.
 */
function processIngredientTransaction(inventoryDoc: any, ingredient: any, transaction: any, inventoryRef: any) {
  const currentData = inventoryDoc.data();
  // Используем корректное поле quantityOnHand
  const currentQty = inventoryDoc.exists && typeof currentData?.quantityOnHand === "number" ? currentData.quantityOnHand : 0;
  
  if (currentQty < ingredient.quantity) {
    throw new HttpsError("failed-precondition", `Insufficient inventory for ingredient ${ingredient.globalIngredientId}. Required: ${ingredient.quantity}, Available: ${currentQty}`);
  }
  
  transaction.set(inventoryRef, {
    quantityOnHand: currentQty - ingredient.quantity,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export const startBrewSession = onCall(async (request) => {
  if (!request || !request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Unauthenticated");
  }

  if (!request.data) {
    throw new HttpsError("invalid-argument", "No data provided");
  }

  const parsedData = StartSessionSchema.safeParse(request.data);
  if (!parsedData || !parsedData.success || !parsedData.data) {
    throw new HttpsError("invalid-argument", "Invalid payload");
  }

  const { breweryId, recipeId, recipeName, beverageType, batchSizeLiters, targetOg, targetFg, sessionIngredients, sessionSteps } = parsedData.data;

  if (!breweryId || !recipeId) {
    throw new HttpsError("invalid-argument", "Missing required identifiers");
  }

  const breweryRef = db.collection("breweries").doc(breweryId);
  const sessionRef = db.collection(`breweries/${breweryId}/brew_sessions`).doc();

  try {
    await db.runTransaction(async (transaction) => {
      const breweryDoc = await transaction.get(breweryRef);
      if (!breweryDoc || !breweryDoc.exists) {
        throw new HttpsError("not-found", "Brewery not found");
      }

      const breweryData = breweryDoc.data();
      const uid = request.auth?.uid;
      
      if (!uid) {
        throw new HttpsError("unauthenticated", "Unauthenticated");
      }

      const isOwner = breweryData?.ownerId === uid;
      const isMember = Array.isArray(breweryData?.members) && breweryData.members.includes(uid);

      if (!isOwner && !isMember) {
        throw new HttpsError("permission-denied", "Unauthorized access to this brewery");
      }

      // Списание инвентаря
      for (const ingredient of sessionIngredients) {
        if (!ingredient || !ingredient.globalIngredientId || typeof ingredient.quantity !== "number" || ingredient.quantity <= 0) continue;
        
        const inventoryRef = db.collection(`breweries/${breweryId}/inventory`).doc(ingredient.globalIngredientId);
        const inventoryDoc = await transaction.get(inventoryRef);
        
        // Вызываем корректную функцию списания (проверяет quantityOnHand)
        processIngredientTransaction(inventoryDoc, ingredient, transaction, inventoryRef);
      }

      const now = new Date().toISOString();
      const sessionData = {
        id: sessionRef.id,
        recipeId: recipeId,
        breweryId: breweryId,
        recipeName: recipeName,
        beverageType: beverageType, // Сохраняем тип напитка
        status: "planned",
        startDate: now,
        completedDate: null,
        batchSizeLiters: batchSizeLiters,
        targetOg: typeof targetOg === "number" ? targetOg : null,
        targetFg: typeof targetFg === "number" ? targetFg : null,
        sessionIngredients: sessionIngredients,
        sessionSteps: sessionSteps,
        logs: [],
        createdAt: now,
        updatedAt: now,
        createdBy: uid,
        isAggregated: false,
        isSplit: false
      };

      transaction.set(sessionRef, sessionData);
    });

    return { status: "success", sessionId: sessionRef.id };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "Start brew session failed");
  }
});