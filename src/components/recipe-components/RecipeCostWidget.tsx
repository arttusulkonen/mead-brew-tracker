// src/components/recipe-components/RecipeCostWidget.tsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCoins, FaInfoCircle } from 'react-icons/fa';
import { useInventoryStore } from '../../store/useInventoryStore';
import type { RecipeIngredientReference } from '../../types/recipe';

interface RecipeCostWidgetProps {
  ingredients: RecipeIngredientReference[];
  batchSizeLiters: number;
}

export const RecipeCostWidget: React.FC<RecipeCostWidgetProps> = ({ ingredients, batchSizeLiters }) => {
  const { t } = useTranslation();
  const { inventory } = useInventoryStore();

  const costData = useMemo(() => {
    let totalCost = 0;
    let mainCurrency = '€';
    let matchedCount = 0;

    const breakdown = (ingredients || []).map(ing => {
      // Ищем ингредиент на складе по ID складской записи или глобальному ID
      const invItem = inventory.find(inv => 
        (ing.inventoryItemId && inv.id === ing.inventoryItemId) || 
        (ing.globalIngredientId && inv.ingredientId === ing.globalIngredientId)
      );

      if (!invItem || !invItem.costPerBaseUnit) {
        return { ...ing, cost: 0, isMatched: false };
      }

      if (matchedCount === 0 && invItem.currency) {
        mainCurrency = invItem.currency; // Берем валюту первого найденного товара
      }

      // Приводим граммы из рецепта в базовые единицы (кг/Л) для расчета стоимости
      let qtyInBase = ing.quantity;
      const unit = ing.unit || 'g';
      
      if (['g', 'ml'].includes(unit)) qtyInBase = ing.quantity / 1000;
      else if (unit === 'oz') qtyInBase = ing.quantity * 0.0283495;
      else if (unit === 'lb') qtyInBase = ing.quantity * 0.453592;
      else if (unit === 'gal') qtyInBase = ing.quantity * 3.78541;

      const itemCost = qtyInBase * invItem.costPerBaseUnit;
      totalCost += itemCost;
      matchedCount += 1;

      return { ...ing, cost: itemCost, isMatched: true };
    });

    const costPerLiter = batchSizeLiters > 0 ? totalCost / batchSizeLiters : 0;

    return { totalCost, costPerLiter, mainCurrency, matchedCount, totalIngredients: ingredients.length, breakdown };
  }, [ingredients, inventory, batchSizeLiters]);

  if (!costData || costData.totalCost === 0) return null;

  return (
    <div className="stat-panel stat-panel--finance">
      <h3 className="stat-panel__title stat-panel__title--flex">
        <FaCoins className="stat-panel__icon-money" /> {t('Brew Cost', 'Стоимость варки')}
      </h3>
      
      <ul className="stat-panel__list stat-panel__list--stacked">
        <li className="stat-panel__item stat-panel__item--row">
          <span className="stat-panel__label">{t('Total Cost', 'Итоговая стоимость')}</span>
          <span className="stat-panel__value stat-panel__value--success">
            {costData.totalCost.toFixed(2)} {costData.mainCurrency}
          </span>
        </li>
        <li className="stat-panel__item stat-panel__item--row">
          <span className="stat-panel__label">{t('Cost per Liter', 'Себестоимость литра')}</span>
          <span className="stat-panel__value">
            {costData.costPerLiter.toFixed(2)} {costData.mainCurrency} / {t('L')}
          </span>
        </li>
        
        {batchSizeLiters > 0 && (
          <li className="stat-panel__item stat-panel__item--row">
            <span className="stat-panel__label">{t('Cost per 0.5L Bottle', 'Бутылка 0.5Л')}</span>
            <span className="stat-panel__value">
              {(costData.costPerLiter * 0.5).toFixed(2)} {costData.mainCurrency}
            </span>
          </li>
        )}
      </ul>

      <div className="stat-panel__footer">
        <span className="stat-panel__subtext stat-panel__subtext--flex">
          <FaInfoCircle /> 
          {costData.matchedCount === costData.totalIngredients 
            ? t('All ingredients accounted for.') 
            : t('Based on {{matched}} of {{total}} ingredients priced in inventory.', { matched: costData.matchedCount, total: costData.totalIngredients, defaultValue: `Based on ${costData.matchedCount} of ${costData.totalIngredients} ingredients priced in inventory.` })
          }
        </span>
      </div>
    </div>
  );
};