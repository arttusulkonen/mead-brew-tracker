/*
 * File: packages/math/src/index.ts
 * Description: Core mathematical engine for brewing and meadmaking calculations.
 * Contains functions for density, ABV, TOSNA, IBU, and Color estimation.
 */

/**
 * Converts Specific Gravity (SG) to Brix.
 * @param sg The specific gravity value.
 * @returns The corresponding Brix value.
 */
export const sgToBrix = (sg: number | null | undefined): number => {
  if (typeof sg !== 'number' || sg < 1) return 0;
  const brix = 135.997 * Math.pow(sg, 3) - 630.272 * Math.pow(sg, 2) + 1111.14 * sg - 616.868;
  return Math.max(0, brix); 
};

/**
 * Converts Brix to Specific Gravity (SG).
 * @param brix The Brix value.
 * @returns The corresponding Specific Gravity value.
 */
export const brixToSg = (brix: number | null | undefined): number => {
  if (typeof brix !== 'number' || brix < 0) return 1.000;
  return 1.00001 + (brix / (258.6 - 0.89 * brix));
};

/**
 * Calculates Alcohol By Volume (ABV) using the Crouch non-linear model.
 * @param og Original Gravity.
 * @param fg Final Gravity.
 * @returns The calculated ABV percentage.
 */
export const calculateAbvCrouch = (og: number | null | undefined, fg: number | null | undefined): number => {
  if (typeof og !== 'number' || typeof fg !== 'number') return 0;
  if (og <= fg || og >= 1.775 || fg <= 0) return 0;
  const abv = ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794);
  return Math.max(0, abv);
};

/**
 * Estimates the Original Gravity based on fermentable weight and volume.
 * @param batchVolumeLiters Total batch volume in liters.
 * @param honeyGrams Total weight of the fermentable in grams.
 * @param honeyBrix The Brix percentage of the fermentable.
 * @returns The estimated Original Gravity.
 */
export const estimateOG = (
  batchVolumeLiters: number | null | undefined, 
  honeyGrams: number | null | undefined, 
  honeyBrix: number | null | undefined
): number => {
  if (typeof batchVolumeLiters !== 'number' || batchVolumeLiters <= 0) return 1.000;
  if (typeof honeyGrams !== 'number' || honeyGrams <= 0) return 1.000;
  if (typeof honeyBrix !== 'number' || honeyBrix <= 0) return 1.000;
  
  const honeyKg = honeyGrams / 1000;
  const gpPerKg = (honeyBrix / 100) * 386; 
  const totalPoints = honeyKg * gpPerKg;
  const calculatedOg = 1.000 + (totalPoints / batchVolumeLiters) / 1000;
  
  return Number(calculatedOg.toFixed(3));
};

export interface TosnaRequirements {
  totalYeastGrams: number;
  goFermGrams: number;
  totalFermaidOGrams: number;
  dosePerAdditionGrams: number;
  numberOfAdditions: number; // dynamically adjusted for session meads
}

/**
 * Calculates TOSNA 3.0 nutrient requirements for mead fermentation.
 * @param batchSizeLiters The batch size in liters.
 * @param og The Original Gravity.
 * @param nitrogenDemandFactor The nitrogen demand multiplier for the yeast strain.
 * @returns An object containing yeast and nutrient requirements in grams, or null if inputs are invalid.
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
  
  // Dynamic schedule adjustment: 2 steps for session/hydromel, 4 steps for standard/sack
  const numberOfAdditions = og < 1.050 ? 2 : 4;
  const dosePerAdditionGrams = totalFermaidOGrams / numberOfAdditions;

  return {
    totalYeastGrams: Number(totalYeastGrams.toFixed(1)),
    goFermGrams: Number(goFermGrams.toFixed(1)),
    totalFermaidOGrams: Number(totalFermaidOGrams.toFixed(1)),
    dosePerAdditionGrams: Number(dosePerAdditionGrams.toFixed(1)),
    numberOfAdditions
  };
};

/**
 * Calculates dosage for additives based on batch volume.
 * @param batchSizeLiters The batch size in liters.
 * @param dosagePer10L The recommended dosage per 10 liters.
 * @returns The required dosage amount.
 */
export const calculateVolumetricDosage = (batchSizeLiters: number | null | undefined, dosagePer10L: number | null | undefined): number => {
  if (typeof batchSizeLiters !== 'number' || typeof dosagePer10L !== 'number') return 0;
  if (batchSizeLiters <= 0 || dosagePer10L <= 0) return 0;
  return (batchSizeLiters / 10) * dosagePer10L;
};

/**
 * Calculates dosage for additives that scale with yeast amount.
 * @param yeastAmountGrams The total amount of yeast in grams.
 * @param dosagePerGramYeast The recommended dosage per gram of yeast.
 * @returns The required dosage amount.
 */
export const calculateYeastDependentDosage = (yeastAmountGrams: number | null | undefined, dosagePerGramYeast: number | null | undefined): number => {
  if (typeof yeastAmountGrams !== 'number' || typeof dosagePerGramYeast !== 'number') return 0;
  if (yeastAmountGrams <= 0 || dosagePerGramYeast <= 0) return 0;
  return yeastAmountGrams * dosagePerGramYeast;
};

/**
 * Calculates the 1/3 Sugar Break specific gravity point.
 * @param og Original Gravity.
 * @param targetFg Expected Final Gravity.
 * @returns The Specific Gravity representing the 1/3 sugar break.
 */
export const calculateOneThirdSugarBreak = (
  og: number | null | undefined, 
  targetFg: number | null | undefined = 1.000
): number => {
  const safeTargetFg = (typeof targetFg === 'number' && targetFg > 0) ? targetFg : 1.000;
  if (typeof og !== 'number' || og <= safeTargetFg) return safeTargetFg;
  return Number((og - ((og - safeTargetFg) / 3)).toFixed(3));
};

/**
 * Calculates International Bitterness Units (IBU) using the Tinseth formula.
 * @param alphaAcidsPct The alpha acid percentage of the hops.
 * @param weightGrams The weight of the hops in grams.
 * @param boilTimeMinutes The duration the hops are boiled in minutes.
 * @param batchVolumeLiters The total volume of the batch in liters.
 * @param boilGravity The specific gravity of the boil.
 * @returns The calculated IBU.
 */
export const calculateIbuTinseth = (
  alphaAcidsPct: number | null | undefined,
  weightGrams: number | null | undefined,
  boilTimeMinutes: number | null | undefined,
  batchVolumeLiters: number | null | undefined,
  boilGravity: number | null | undefined
): number => {
  if (
    typeof alphaAcidsPct !== 'number' ||
    typeof weightGrams !== 'number' ||
    typeof boilTimeMinutes !== 'number' ||
    typeof batchVolumeLiters !== 'number' ||
    typeof boilGravity !== 'number'
  ) return 0;

  if (batchVolumeLiters <= 0 || weightGrams <= 0 || boilTimeMinutes <= 0 || boilGravity < 1) return 0;

  const bignessFactor = 1.65 * Math.pow(0.000125, boilGravity - 1);
  const boilTimeFactor = (1 - Math.exp(-0.04 * boilTimeMinutes)) / 4.15;
  const utilization = bignessFactor * boilTimeFactor;

  const mgPerLiterAlphaAcids = (alphaAcidsPct / 100) * (weightGrams * 1000) / batchVolumeLiters;
  const ibu = utilization * mgPerLiterAlphaAcids;

  return Number(Math.max(0, ibu).toFixed(1));
};

/**
 * Calculates Malt Color Units (MCU) for a specific fermentable addition.
 * @param weightKg The weight of the fermentable in kilograms.
 * @param colorEbc The color rating of the fermentable in EBC.
 * @param volumeLiters The total batch volume in liters.
 * @returns The MCU value.
 */
export const calculateMcu = (weightKg: number | null | undefined, colorEbc: number | null | undefined, volumeLiters: number | null | undefined): number => {
  if (typeof weightKg !== 'number' || typeof colorEbc !== 'number' || typeof volumeLiters !== 'number') return 0;
  if (weightKg <= 0 || colorEbc <= 0 || volumeLiters <= 0) return 0;
    
  const weightLbs = weightKg * 2.20462;
  const colorLovibond = colorEbc / 1.97;
  const volumeGallons = volumeLiters * 0.264172;
    
  return (weightLbs * colorLovibond) / volumeGallons;
};

/**
 * Estimates total batch SRM using Morey's equation based on total MCU.
 * @param totalMcu The sum of Malt Color Units for all fermentables.
 * @returns The estimated color in SRM.
 */
export const estimateSrmMorey = (totalMcu: number | null | undefined): number => {
  if (typeof totalMcu !== 'number' || totalMcu <= 0) return 0;
  return Number((1.4922 * Math.pow(totalMcu, 0.6859)).toFixed(1));
};

/**
 * Converts SRM color value to EBC.
 * @param colorSrm The color contribution in SRM.
 * @returns The calculated EBC value.
 */
export const srmToEbc = (colorSrm: number | null | undefined): number => {
   if (typeof colorSrm !== 'number' || colorSrm <= 0) return 0;
   return Number((colorSrm * 1.97).toFixed(1));
};