// src/utils/styleIngredientStats.ts
import { supabase } from '../supabase/client';

export interface StyleIngredientStatsResult {
  hopsIds: Set<string>;
  yeastIds: Set<string>;
}

const EMPTY_RESULT: StyleIngredientStatsResult = { hopsIds: new Set(), yeastIds: new Set() };

/**
 * Тянет анонимную статистику популярности ингредиентов для конкретного стиля
 * из таблицы style_ingredient_stats (см. миграцию
 * 20260630_style_ingredient_stats.sql). Таблица не содержит ни рецептов, ни
 * id пивоварен - только агрегированные счётчики "ингредиент X использован со
 * стилем Y N раз", поэтому её безопасно читать с фронтенда без авторизации.
 */
export const fetchStyleIngredientStats = async (
  styleName: string,
  beverageType: string
): Promise<StyleIngredientStatsResult> => {
  if (!styleName) return EMPTY_RESULT;

  try {
    const { data, error } = await supabase
      .from('style_ingredient_stats')
      .select('global_ingredient_id, ingredient_category')
      .eq('style_name', styleName)
      .eq('beverage_type', beverageType)
      .gt('usage_count', 0)
      .order('usage_count', { ascending: false })
      .limit(20);

    if (error || !data) return EMPTY_RESULT;

    const hopsIds = new Set<string>();
    const yeastIds = new Set<string>();

    data.forEach(row => {
      if (row.ingredient_category === 'Hops') hopsIds.add(row.global_ingredient_id);
      if (row.ingredient_category === 'Yeast') yeastIds.add(row.global_ingredient_id);
    });

    return { hopsIds, yeastIds };
  } catch {
    return EMPTY_RESULT;
  }
};
