export interface StyleRange {
  minimum: { value: number };
  maximum: { value: number };
}

export interface BjcpStyle {
  name: string;
  category: string;
  style_id: string;
  beverage_type: string;
  original_gravity: StyleRange;
  international_bitterness_units: StyleRange;
  final_gravity: StyleRange;
  alcohol_by_volume: StyleRange;
  color: StyleRange;
  ingredients?: string;
}

export interface StyleValidationResult {
  isOgValid: boolean;
  isFgValid: boolean;
  isAbvValid: boolean;
  isIbuValid: boolean;
  isColorValid: boolean;
  isValidOverall: boolean;
}

/**
 * Validates given parameters against BJCP style boundaries.
 * @param style The selected BJCP style object.
 * @param og The original gravity.
 * @param fg The final gravity.
 * @param abv The alcohol by volume percentage.
 * @param ibu The international bitterness units.
 * @param ebc The color in EBC.
 * @returns An object containing validation booleans for each parameter.
 */
export const validateStyleBounds = (
  style: BjcpStyle | null | undefined,
  og: number,
  fg: number,
  abv: number,
  ibu: number,
  ebc: number
): StyleValidationResult => {
  const defaultResult = { isOgValid: true, isFgValid: true, isAbvValid: true, isIbuValid: true, isColorValid: true, isValidOverall: true };
  if (!style) return defaultResult;

  const srmColor = ebc / 1.97;

  const isOgValid = og >= (style.original_gravity?.minimum?.value || 0) && og <= (style.original_gravity?.maximum?.value || 2);
  const isFgValid = fg >= (style.final_gravity?.minimum?.value || 0) && fg <= (style.final_gravity?.maximum?.value || 2);
  const isAbvValid = abv >= (style.alcohol_by_volume?.minimum?.value || 0) && abv <= (style.alcohol_by_volume?.maximum?.value || 100);
  const isIbuValid = ibu >= (style.international_bitterness_units?.minimum?.value || 0) && ibu <= (style.international_bitterness_units?.maximum?.value || 1000);
  const isColorValid = srmColor >= (style.color?.minimum?.value || 0) && srmColor <= (style.color?.maximum?.value || 100);

  const isValidOverall = isOgValid && isFgValid && isAbvValid && isIbuValid && isColorValid;

  return { isOgValid, isFgValid, isAbvValid, isIbuValid, isColorValid, isValidOverall };
};

/**
 * Retrieves ingredient suggestions based on the selected BJCP style.
 * @param style The selected BJCP style object.
 * @param globalIngredients The array of global catalog ingredients.
 * @returns An object containing arrays of suggested hops and yeasts.
 */
export const getSuggestedIngredients = (
  style: BjcpStyle | null | undefined,
  globalIngredients: any[]
) => {
  if (!style || !globalIngredients?.length) return { hops: [], yeasts: [] };

  const styleNameLower = style.name.toLowerCase();
  const categoryLower = style.category.toLowerCase();

  const matchedHops = globalIngredients.filter(ing => {
    if (ing.category !== 'Hops') return false;
    const notes = (ing.notes || '').toLowerCase();
    return notes.includes(styleNameLower) || notes.includes(categoryLower);
  });

  const matchedYeasts = globalIngredients.filter(ing => {
    if (ing.category !== 'Yeast') return false;
    const bestFor = (ing.best_for || '').toLowerCase();
    const notes = (ing.notes || '').toLowerCase();
    return bestFor.includes(styleNameLower) || notes.includes(styleNameLower) || bestFor.includes(categoryLower);
  });

  return {
    hops: matchedHops.slice(0, 5),
    yeasts: matchedYeasts.slice(0, 3)
  };
};