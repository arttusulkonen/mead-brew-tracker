/**
 * Converts Specific Gravity (SG) to Brix.
 * @param sg - The Specific Gravity value.
 * @returns The calculated Brix value.
 */
export const sgToBrix = (sg: number | null | undefined): number => {
  if (typeof sg !== 'number' || sg < 1) return 0;
  const brix = 135.997 * Math.pow(sg, 3) - 630.272 * Math.pow(sg, 2) + 1111.14 * sg - 616.868;
  return Math.max(0, brix); 
};

/**
 * Converts Brix to Specific Gravity (SG).
 * @param brix - The Brix value.
 * @returns The calculated Specific Gravity value.
 */
export const brixToSg = (brix: number | null | undefined): number => {
  if (typeof brix !== 'number' || brix < 0) return 1.000;
  return 1.00001 + (brix / (258.6 - 0.89 * brix));
};

/**
 * Calculates Alcohol by Volume (ABV) using the Crouch equation.
 * @param og - Original Gravity.
 * @param fg - Final Gravity.
 * @returns The calculated ABV percentage.
 */
export const calculateAbvCrouch = (og: number | null | undefined, fg: number | null | undefined): number => {
  if (typeof og !== 'number' || typeof fg !== 'number') return 0;
  if (og <= fg || og >= 1.775 || fg <= 0) return 0;
  const abv = ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794);
  return Math.max(0, abv);
};

/**
 * Estimates Original Gravity (OG) based on batch volume and honey properties.
 * @param batchVolumeLiters - Expected batch volume in liters.
 * @param honeyGrams - Total mass of honey in grams.
 * @param honeyBrix - The Brix value of the honey.
 * @returns The estimated Original Gravity.
 */
export const estimateOG = (batchVolumeLiters: number | null | undefined, honeyGrams: number | null | undefined, honeyBrix: number | null | undefined): number => {
  if (typeof batchVolumeLiters !== 'number' || batchVolumeLiters <= 0) return 1.000;
  if (typeof honeyGrams !== 'number' || honeyGrams <= 0) return 1.000;
  if (typeof honeyBrix !== 'number' || honeyBrix <= 0) return 1.000;
  const honeyKg = honeyGrams / 1000;
  const pointsPerKg = honeyBrix * 3.84;
  const totalPoints = honeyKg * pointsPerKg;
  const calculatedOg = 1 + (totalPoints / batchVolumeLiters) / 1000;
  return Number(calculatedOg.toFixed(3));
};

export interface TosnaRequirements {
  totalYeastGrams: number;
  goFermGrams: number;
  totalFermaidOGrams: number;
  dosePerAdditionGrams: number;
}

/**
 * Calculates TOSNA 3.0 nutrient requirements.
 * @param batchSizeLiters - Target volume of the batch in liters.
 * @param og - Original Gravity.
 * @param nitrogenDemandFactor - Yeast nitrogen demand factor.
 * @returns An object containing the required amounts of yeast, Go-Ferm, and Fermaid O, or null if inputs are invalid.
 */
export const calculateTosna = (
  batchSizeLiters: number | null | undefined,
  og: number | null | undefined,
  nitrogenDemandFactor: number | null | undefined
): TosnaRequirements | null => {
  if (typeof batchSizeLiters !== 'number' || batchSizeLiters <= 0) return null;
  if (typeof og !== 'number' || og <= 1.000) return null;
  if (typeof nitrogenDemandFactor !== 'number' || nitrogenDemandFactor <= 0) return null;

  const brix = sgToBrix(og);
  const batchSizeGallons = batchSizeLiters * 0.264172;

  let pitchRate = 1.0;
  if (og >= 1.100 && og < 1.130) pitchRate = 2.0;
  else if (og >= 1.130 && og < 1.160) pitchRate = 3.0;
  else if (og >= 1.160) pitchRate = 4.0;

  const totalYeastGrams = pitchRate * batchSizeGallons;
  const goFermGrams = 1.25 * totalYeastGrams;
  const totalFermaidOGrams = ((brix * 10 * nitrogenDemandFactor) / 50) * batchSizeGallons;
  const dosePerAdditionGrams = totalFermaidOGrams / 4;

  return {
    totalYeastGrams: Number(totalYeastGrams.toFixed(1)),
    goFermGrams: Number(goFermGrams.toFixed(1)),
    totalFermaidOGrams: Number(totalFermaidOGrams.toFixed(1)),
    dosePerAdditionGrams: Number(dosePerAdditionGrams.toFixed(1))
  };
};

/**
 * Calculates the required amount of an additive based on the total batch volume.
 * @param batchSizeLiters - The total expected volume of the batch in liters.
 * @param dosagePer10L - The recommended dosage in grams per 10 liters.
 * @returns The total required grams of the additive.
 */
export const calculateVolumetricDosage = (batchSizeLiters: number | null | undefined, dosagePer10L: number | null | undefined): number => {
  if (typeof batchSizeLiters !== 'number' || typeof dosagePer10L !== 'number') return 0;
  if (batchSizeLiters <= 0 || dosagePer10L <= 0) return 0;
  return (batchSizeLiters / 10) * dosagePer10L;
};

/**
 * Calculates the required amount of a yeast rehydration nutrient.
 * @param yeastAmountGrams - The total grams of dry yeast being pitched.
 * @param dosagePerGramYeast - The recommended dosage in grams per 1 gram of yeast.
 * @returns The total required grams of the rehydration nutrient.
 */
export const calculateYeastDependentDosage = (yeastAmountGrams: number | null | undefined, dosagePerGramYeast: number | null | undefined): number => {
  if (typeof yeastAmountGrams !== 'number' || typeof dosagePerGramYeast !== 'number') return 0;
  if (yeastAmountGrams <= 0 || dosagePerGramYeast <= 0) return 0;
  return yeastAmountGrams * dosagePerGramYeast;
};