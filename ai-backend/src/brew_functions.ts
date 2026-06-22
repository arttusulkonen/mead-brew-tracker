import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "genkit";

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
          updatedAt: FieldValue.serverTimestamp()
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
    namePostfix: z.string()
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

  const parentSessionRef = db.collection(`breweries/${breweryId}/brew_sessions`).doc(parentSessionId);

  try {
    await db.runTransaction(async (transaction) => {
      const parentDoc = await transaction.get(parentSessionRef);
      if (!parentDoc || !parentDoc.exists) {
        throw new HttpsError("not-found", "Parent session not found");
      }

      const parentData = parentDoc.data();
      if (!parentData) {
        throw new HttpsError("internal", "Parent data is empty");
      }

      if (parentData.status === "split") {
        throw new HttpsError("failed-precondition", "Session is already split");
      }

      const splitTimestamp = new Date().toISOString();

      transaction.update(parentSessionRef, {
        status: "split",
        batchSizeLiters: 0,
        updatedAt: FieldValue.serverTimestamp()
      });

      for (const split of splits) {
        if (!split || !split.namePostfix || typeof split.volumeLiters !== "number") continue;

        const childRef = db.collection(`breweries/${breweryId}/brew_sessions`).doc();
        const childData = {
          ...parentData,
          id: childRef.id,
          recipeName: `${parentData.recipeName} - ${split.namePostfix}`,
          batchSizeLiters: split.volumeLiters,
          parentSessionId: parentSessionId,
          splitTimestamp: splitTimestamp,
          logs: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          isAggregated: false
        };

        transaction.set(childRef, childData);
      }
    });

    return { status: "success" };
  } catch (error) {
    throw new HttpsError("internal", "Split batch failed");
  }
});