// src/components/inventory/CostCalculatorWidget.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCalculator } from 'react-icons/fa';

interface CostCalculatorWidgetProps {
  initialPrice?: number;
  initialQty?: number;
  initialUnit?: string;
  initialCurrency?: string;
  onCostCalculated: (costPerBaseUnit: number, currency: string) => void;
}

export const CostCalculatorWidget: React.FC<CostCalculatorWidgetProps> = ({
  initialPrice = 0,
  initialQty = 0,
  initialUnit = 'g',
  initialCurrency = '€',
  onCostCalculated
}) => {
  const { t } = useTranslation();
  const [totalPrice, setTotalPrice] = useState<number | string>(initialPrice || '');
  const [purchasedQty, setPurchasedQty] = useState<number | string>(initialQty || '');
  const [unit, setUnit] = useState<string>(initialUnit);
  const [currency, setCurrency] = useState<string>(initialCurrency);

  // Определение базовой единицы (кг для веса, Л для объема)
  const getBaseUnit = (u: string) => {
    if (['g', 'kg', 'oz', 'lb'].includes(u)) return 'kg';
    if (['ml', 'L', 'gal'].includes(u)) return 'L';
    return 'unit';
  };

  // Пересчет в базовую стоимость
  const calculatedCost = React.useMemo(() => {
    const price = Number(totalPrice);
    const qty = Number(purchasedQty);
    
    if (!price || !qty || qty <= 0) return 0;

    let qtyInBase = qty;
    switch (unit) {
      case 'g': qtyInBase = qty / 1000; break;
      case 'oz': qtyInBase = qty * 0.0283495; break;
      case 'lb': qtyInBase = qty * 0.453592; break;
      case 'ml': qtyInBase = qty / 1000; break;
      case 'gal': qtyInBase = qty * 3.78541; break;
      // kg, L и unit остаются 1:1
    }

    return price / qtyInBase;
  }, [totalPrice, purchasedQty, unit]);

  // Передаем результат наверх только при изменении
  useEffect(() => {
    onCostCalculated(calculatedCost, currency);
  }, [calculatedCost, currency, onCostCalculated]);

  const baseUnitLabel = getBaseUnit(unit);

  return (
    <div className="cost-calculator">
      <div className="cost-calculator__header">
        <FaCalculator className="cost-calculator__icon" />
        <span className="cost-calculator__title">{t('Purchase Details')}</span>
      </div>

      <div className="cost-calculator__grid">
        <div className="cost-calculator__group">
          <label className="cost-calculator__label">{t('Total Price Paid')}</label>
          <div className="cost-calculator__input-wrapper">
            <input 
              type="number" 
              step="0.01" 
              min="0"
              className="cost-calculator__input" 
              placeholder="0.00"
              value={totalPrice}
              onChange={e => setTotalPrice(e.target.value)}
            />
            <select 
              className="cost-calculator__currency-select"
              value={currency}
              onChange={e => setCurrency(e.target.value)}
            >
              <option value="€">€</option>
              <option value="$">$</option>
              <option value="£">£</option>
              <option value="₽">₽</option>
            </select>
          </div>
        </div>

        <div className="cost-calculator__group">
          <label className="cost-calculator__label">{t('For Quantity')}</label>
          <div className="cost-calculator__input-wrapper">
            <input 
              type="number" 
              step="0.01" 
              min="0"
              className="cost-calculator__input" 
              placeholder="100"
              value={purchasedQty}
              onChange={e => setPurchasedQty(e.target.value)}
            />
            <select 
              className="cost-calculator__unit-select"
              value={unit}
              onChange={e => setUnit(e.target.value)}
            >
              <optgroup label={t('Weight')}>
                <option value="g">{t('g')}</option>
                <option value="kg">{t('kg')}</option>
                <option value="oz">{t('oz')}</option>
                <option value="lb">{t('lb')}</option>
              </optgroup>
              <optgroup label={t('Volume')}>
                <option value="ml">{t('ml')}</option>
                <option value="L">{t('L')}</option>
                <option value="gal">{t('gal')}</option>
              </optgroup>
            </select>
          </div>
        </div>
      </div>

      {calculatedCost > 0 && (
        <div className="cost-calculator__result">
          <span className="cost-calculator__result-label">{t('Normalized Cost')}:</span>
          <strong className="cost-calculator__result-value">
            {calculatedCost.toFixed(2)} {currency} / {t(baseUnitLabel)}
          </strong>
        </div>
      )}
    </div>
  );
};