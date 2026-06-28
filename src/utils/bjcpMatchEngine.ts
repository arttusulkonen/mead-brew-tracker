export interface StyleRange {
  minimum: { value: number };
  maximum: { value: number };
}

export interface BjcpStyle {
  name: string;
  category: string;
  style_id: string;
  beverage_type: string;
  ogMin: number | null;
  ogMax: number | null;
  fgMin: number | null;
  fgMax: number | null;
  abvMin: number | null;
  abvMax: number | null;
  ibuMin: number | null;
  ibuMax: number | null;
  ebcMin: number | null;
  ebcMax: number | null;
  notes?: string;
}

export interface StyleValidationResult {
  isOgValid: boolean;
  isFgValid: boolean;
  isAbvValid: boolean;
  isIbuValid: boolean;
  isColorValid: boolean;
  isValidOverall: boolean;
}

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

  const isOgValid = !style.ogMin || !style.ogMax || (og >= style.ogMin && og <= style.ogMax);
  const isFgValid = !style.fgMin || !style.fgMax || (fg >= style.fgMin && fg <= style.fgMax);
  const isAbvValid = !style.abvMin || !style.abvMax || (abv >= style.abvMin && abv <= style.abvMax);
  const isIbuValid = !style.ibuMin || !style.ibuMax || (ibu >= style.ibuMin && ibu <= style.ibuMax);
  const isColorValid = !style.ebcMin || !style.ebcMax || (ebc >= style.ebcMin && ebc <= style.ebcMax);

  const isValidOverall = isOgValid && isFgValid && isAbvValid && isIbuValid && isColorValid;

  return { isOgValid, isFgValid, isAbvValid, isIbuValid, isColorValid, isValidOverall };
};

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
    return notes.includes(styleNameLower) || notes.includes(categoryLower) || notes.includes('ale') || notes.includes('lager'); // Базовый фоллбек
  });

  const matchedYeasts = globalIngredients.filter(ing => {
    if (ing.category !== 'Yeast') return false;
    const notes = (ing.notes || '').toLowerCase();
    return notes.includes(styleNameLower) || notes.includes(categoryLower);
  });

  return {
    hops: matchedHops.slice(0, 5),
    yeasts: matchedYeasts.slice(0, 3)
  };
};