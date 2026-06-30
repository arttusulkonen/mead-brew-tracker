//src/utils/bjcpMatchEngine.ts
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

// Семейства стилей: расширяем точное совпадение названия стиля до широкого
// набора синонимов/родственных терминов, которые реально встречаются в
// описаниях хмеля/дрожжей. Например "Hazy IPA" не совпадёт буквально с текстом
// "great for New England style IPAs", а через семейство 'ipa' - совпадёт.
const STYLE_FAMILY_KEYWORDS: Record<string, string[]> = {
  ipa: ['ipa', 'india pale ale', 'hazy', 'neipa', 'west coast'],
  pale_ale: ['pale ale', 'apa'],
  lager: ['lager', 'pilsner', 'pilsener', 'helles', 'bock'],
  stout: ['stout', 'porter'],
  wheat: ['wheat', 'weizen', 'witbier', 'hefeweizen'],
  sour: ['sour', 'gose', 'lambic', 'berliner'],
  belgian: ['belgian', 'saison', 'tripel', 'dubbel'],
  ale: ['ale']
};

const matchesAnyKeyword = (haystack: string, keywords: string[]) =>
  keywords.some(k => haystack.includes(k));

const getRelevantFamilyKeywords = (styleNameLower: string, categoryLower: string): string[] => {
  const combined = `${styleNameLower} ${categoryLower}`;
  return Object.values(STYLE_FAMILY_KEYWORDS)
    .filter(keywords => matchesAnyKeyword(combined, keywords))
    .flat();
};

// Раньше совпадение искалось только в ing.notes - но в реальных данных это
// поле у части ингредиентов (например, у хмеля) пустое, хотя описание есть в
// других полях (description, origin, producer) или даже в самом названии.
const ingredientSearchText = (ing: any): string =>
  [ing.notes, ing.description, ing.origin, ing.producer, ing.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const getSuggestedIngredients = (
  style: BjcpStyle | null | undefined,
  globalIngredients: any[],
  /**
   * Опционально: id ингредиентов, которые анонимная статистика сообщества
   * (таблица style_ingredient_stats) считает популярными для этого стиля.
   * Такие ингредиенты подмешиваются в выдачу, даже если текстового совпадения
   * нет, и выводятся первыми. См. src/utils/styleIngredientStats.ts.
   */
  popularIngredientIds: { hopsIds: Set<string>; yeastIds: Set<string> } = { hopsIds: new Set(), yeastIds: new Set() }
) => {
  if (!style || !globalIngredients?.length) return { hops: [], yeasts: [] };

  const styleNameLower = style.name.toLowerCase();
  const categoryLower = style.category.toLowerCase();
  const familyKeywords = getRelevantFamilyKeywords(styleNameLower, categoryLower);

  const matchesByText = (ing: any): boolean => {
    const text = ingredientSearchText(ing);
    if (!text) return false;
    if (text.includes(styleNameLower) || text.includes(categoryLower)) return true;
    return familyKeywords.length > 0 && matchesAnyKeyword(text, familyKeywords);
  };

  const matchedHops = globalIngredients.filter(
    ing => ing.category === 'Hops' && (matchesByText(ing) || popularIngredientIds.hopsIds.has(ing.id))
  );
  const matchedYeasts = globalIngredients.filter(
    ing => ing.category === 'Yeast' && (matchesByText(ing) || popularIngredientIds.yeastIds.has(ing.id))
  );

  // Популярные у сообщества ингредиенты поднимаем в начало списка.
  matchedHops.sort((a, b) => Number(popularIngredientIds.hopsIds.has(b.id)) - Number(popularIngredientIds.hopsIds.has(a.id)));
  matchedYeasts.sort((a, b) => Number(popularIngredientIds.yeastIds.has(b.id)) - Number(popularIngredientIds.yeastIds.has(a.id)));

  return {
    hops: matchedHops.slice(0, 5),
    yeasts: matchedYeasts.slice(0, 3)
  };
};
