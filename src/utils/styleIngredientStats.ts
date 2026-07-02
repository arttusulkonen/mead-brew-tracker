// src/utils/styleIngredientStats.ts
import { supabase } from '../supabase/client';

export interface StyleIngredientStatsResult {
  hopsIds: Set<string>;
  yeastIds: Set<string>;
}

/**
 * Тянет анонимную статистику популярности ингредиентов для конкретного стиля
 * из таблицы style_ingredient_stats. Таблица не содержит ни рецептов, ни
 * id пивоварен - только агрегированные счётчики.
 */
export const fetchStyleIngredientStats = async (
  styleName: string,
  beverageType: string
): Promise<StyleIngredientStatsResult> => {
  // Возвращаем свежие инстансы Set, чтобы избежать мутации глобального состояния
  if (!styleName) return { hopsIds: new Set(), yeastIds: new Set() };

  try {
    const { data, error } = await supabase
      .from('style_ingredient_stats')
      .select('global_ingredient_id, ingredient_category')
      .eq('style_name', styleName)
      .eq('beverage_type', beverageType)
      .gt('usage_count', 0)
      .order('usage_count', { ascending: false })
      .limit(20);

    if (error || !data) return { hopsIds: new Set(), yeastIds: new Set() };

    const hopsIds = new Set<string>();
    const yeastIds = new Set<string>();

    data.forEach(row => {
      if (row.ingredient_category === 'Hops') hopsIds.add(row.global_ingredient_id);
      if (row.ingredient_category === 'Yeast') yeastIds.add(row.global_ingredient_id);
    });

    return { hopsIds, yeastIds };
  } catch {
    return { hopsIds: new Set(), yeastIds: new Set() };
  }
};