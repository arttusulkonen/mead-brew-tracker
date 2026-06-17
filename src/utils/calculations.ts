export const sgToBrix = (sg: number | null | undefined): number => {
  if (!sg || sg < 1) return 0;
  const brix = 135.997 * Math.pow(sg, 3) - 630.272 * Math.pow(sg, 2) + 1111.14 * sg - 616.868;
  return Math.max(0, brix); 
};

export const brixToSg = (brix: number | null | undefined): number => {
  if (!brix || brix < 0) return 1.000;
  return 1.00001 + (brix / (258.6 - 0.89 * brix));
};

export const calculateAbvCrouch = (og: number | null | undefined, fg: number | null | undefined): number => {
  if (!og || !fg || og <= fg) return 0;
  const abv = ((76.08 * (og - fg)) / (1.775 - og)) * (fg / 0.794);
  return Math.max(0, abv);
};

export const estimateOG = (batchVolumeLiters: number | null | undefined, honeyGrams: number | null | undefined, honeyBrix: number | null | undefined): number => {
  if (!batchVolumeLiters || batchVolumeLiters <= 0 || !honeyGrams || !honeyBrix) return 1.000;
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

export const calculateTosna = (
  batchSizeLiters: number | null | undefined,
  og: number | null | undefined,
  nitrogenDemandFactor: number | null | undefined
): TosnaRequirements | null => {
  if (!batchSizeLiters || !og || !nitrogenDemandFactor) return null;

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