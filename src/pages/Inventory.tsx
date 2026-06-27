import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { AdditiveType, IngredientCategory, UnitType } from '../types/ingredient';
import { ADDITIVE_TYPES, INGREDIENT_CATEGORIES, UNIT_TYPES } from '../types/ingredient';

const Inventory: React.FC = () => {
  const { t } = useTranslation();
  const { activeBrewery } = useBreweryStore();
  const {
    globalIngredients,
    inventory,
    isLoading,
    error,
    fetchGlobalIngredients,
    fetchInventory,
    addInventoryItem,
    addCustomIngredient,
    removeItem,
  } = useInventoryStore();

  // Mode & Selection State
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState<UnitType>('kg');

  // Custom Ingredient State
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<IngredientCategory>('Fermentable');
  
  // Fermentable Specifics
  const [fermentableType, setFermentableType] = useState<'Grain' | 'Extract' | 'Sugar' | 'Honey' | 'Fruit'>('Grain');
  const [yieldPpg, setYieldPpg] = useState<number | ''>(36);
  const [colorEbc, setColorEbc] = useState<number | ''>(5);
  const [moistureContent, setMoistureContent] = useState<number | ''>(18);
  
  // Yeast Specifics
  const [yeastForm, setYeastForm] = useState<'Liquid' | 'Dry'>('Dry');
  const [yeastTempMin, setYeastTempMin] = useState<number | ''>(15);
  const [yeastTempMax, setYeastTempMax] = useState<number | ''>(25);
  const [yeastTolerance, setYeastTolerance] = useState<number | ''>(14);
  const [yeastAttenuation, setYeastAttenuation] = useState<number | ''>(75);
  const [yeastNitrogen, setYeastNitrogen] = useState<'Low' | 'Medium' | 'High' | 'Very High'>('Medium');
  
  // Hops Specifics
  const [hopsForm, setHopsForm] = useState<'Pellet' | 'Whole' | 'Extract'>('Pellet');
  const [hopsAlpha, setHopsAlpha] = useState<number | ''>(5);

  // Additive Specifics
  const [additiveType, setAdditiveType] = useState<AdditiveType>('Nutrient');
  const [dosagePer10Liters, setDosagePer10Liters] = useState<number | ''>('');

  useEffect(() => {
    fetchGlobalIngredients();
  }, [fetchGlobalIngredients]);

  useEffect(() => {
    if (activeBrewery?.id) {
      fetchInventory(activeBrewery.id);
    }
  }, [activeBrewery?.id, fetchInventory]);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBrewery?.id || quantity === '') return;

    let targetIngredientId = selectedIngredientId;

    if (isCreatingCustom) {
      if (!customName.trim()) return;

      const baseData = {
        name: customName.trim(),
        category: customCategory,
      } as any;

      if (customCategory === 'Fermentable') {
        baseData.type = fermentableType;
        baseData.yieldPpg = Number(yieldPpg) || 0;
        baseData.colorEbc = Number(colorEbc) || 0;
        baseData.isMashed = fermentableType === 'Grain';
        if (moistureContent !== '' && (fermentableType === 'Honey' || fermentableType === 'Fruit')) {
          baseData.moistureContentPct = Number(moistureContent);
        }
      } else if (customCategory === 'Yeast') {
        baseData.form = yeastForm;
        baseData.tempMinC = Number(yeastTempMin) || 15;
        baseData.tempMaxC = Number(yeastTempMax) || 25;
        baseData.alcoholTolerancePct = Number(yeastTolerance) || 14;
        baseData.attenuationPct = Number(yeastAttenuation) || 75;
        baseData.nitrogenDemand = yeastNitrogen;
      } else if (customCategory === 'Hops') {
        baseData.form = hopsForm;
        baseData.alphaAcidPct = Number(hopsAlpha) || 5;
      } else if (customCategory === 'Additive') {
        baseData.additiveType = additiveType;
        if (dosagePer10Liters !== '') baseData.dosagePer10Liters = Number(dosagePer10Liters);
      } else if (customCategory === 'Water Profile') {
        baseData.calciumPpm = 0; baseData.magnesiumPpm = 0; baseData.sodiumPpm = 0;
        baseData.sulfatePpm = 0; baseData.chloridePpm = 0; baseData.bicarbonatePpm = 0;
      }

      const newIng = await addCustomIngredient(baseData);
      if (newIng && newIng.id) {
        targetIngredientId = newIng.id;
        setIsCreatingCustom(false);
        setCustomName('');
      } else {
        return;
      }
    }

    if (!targetIngredientId) return;

    const success = await addInventoryItem(activeBrewery.id, {
      ingredientId: targetIngredientId,
      quantityOnHand: Number(quantity),
      unit,
    });

    if (success) {
      if (!isCreatingCustom) setSelectedIngredientId('');
      setQuantity('');
    }
  };

  const handleDeleteItem = async (itemId: string | undefined) => {
    if (!activeBrewery?.id || !itemId) return;
    if (window.confirm(t('Are you sure you want to delete this item?'))) {
      await removeItem(activeBrewery.id, itemId);
    }
  };

  const renderIngredientMeta = (ing: any) => {
    if (!ing) return null;
    switch (ing.category) {
      case 'Fermentable':
        return `${ing.yieldPpg} PPG | ${ing.colorEbc} EBC`;
      case 'Yeast':
        return `${ing.attenuationPct}% ${t('Atten.', 'Atten.')} | ${ing.alcoholTolerancePct}% ABV`;
      case 'Hops':
        return `Alpha: ${ing.alphaAcidPct}% | ${t(`constants.hops_forms.${ing.form?.toLowerCase()}`, ing.form)}`;
      case 'Additive':
        return ing.dosagePer10Liters ? `${ing.dosagePer10Liters}g/10L` : t(`constants.additive_types.${ing.additiveType?.toLowerCase()}`, ing.additiveType);
      default:
        return null;
    }
  };

  const getCategoryClassModifier = (category: string) => {
    return category.toLowerCase().replace(' ', '-');
  };

  if (!activeBrewery) {
    return (
      <div className="inventory-page">
        <div className="inventory-page__empty-state">
          <p className="inventory-page__empty-text">{t('Please select or create a brewery to manage inventory.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-page">
      <header className="inventory-page__header">
        <div className="inventory-page__title-block">
          <h1 className="inventory-page__title">{t('Workspace Inventory')}</h1>
          <span className="inventory-page__subtitle">{activeBrewery.name}</span>
        </div>
      </header>

      {error && <div className="inventory-page__error">{error}</div>}

      <div className="inventory-page__layout">
        
        {/* --- SIDEBAR: ADD ITEM FORM --- */}
        <aside className="inventory-page__sidebar">
          <form className="inventory-form" onSubmit={handleAddItem}>
            <div className="inventory-form__header">
              <h2 className="inventory-form__title">{t('Add to Stock')}</h2>
              
              <div className="inventory-form__toggle-group">
                <button 
                  type="button" 
                  className={`inventory-form__toggle-btn ${!isCreatingCustom ? 'inventory-form__toggle-btn--active' : ''}`}
                  onClick={() => setIsCreatingCustom(false)}
                >
                  {t('From Catalog')}
                </button>
                <button 
                  type="button" 
                  className={`inventory-form__toggle-btn ${isCreatingCustom ? 'inventory-form__toggle-btn--active' : ''}`}
                  onClick={() => setIsCreatingCustom(true)}
                >
                  {t('Custom Item')}
                </button>
              </div>
            </div>

            <div className="inventory-form__body">
              {!isCreatingCustom ? (
                <div className="form-field">
                  <label className="form-field__label">{t('Search Global Catalog')}</label>
                  <select
                    className="form-field__select"
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    required
                  >
                    <option value="" disabled>{t('Select an ingredient...')}</option>
                    {INGREDIENT_CATEGORIES.map((cat) => {
                      const catIngs = globalIngredients?.filter((i) => i?.category === cat);
                      if (!catIngs?.length) return null;
                      return (
                        <optgroup key={cat} label={t(`constants.categories.${cat.toLowerCase().replace(' ', '_')}`, cat)}>
                          {catIngs.map((ing) => (
                            <option key={ing.id} value={ing.id}>{ing.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>
              ) : (
                <div className="inventory-form__custom-fields">
                  <div className="form-field">
                    <label className="form-field__label">{t('Ingredient Name')}</label>
                    <input
                      className="form-field__input"
                      type="text"
                      placeholder={t('e.g., Local Wildflower Honey')}
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-field">
                    <label className="form-field__label">{t('Category')}</label>
                    <select
                      className="form-field__select"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as IngredientCategory)}
                    >
                      {INGREDIENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{t(`constants.categories.${cat.toLowerCase().replace(' ', '_')}`, cat)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Fields based on Category */}
                  {customCategory === 'Fermentable' && (
                    <div className="inventory-form__dynamic-group">
                       <div className="form-field">
                          <label className="form-field__label">{t('Type')}</label>
                          <select className="form-field__select" value={fermentableType} onChange={e => setFermentableType(e.target.value as any)}>
                            {['Grain', 'Extract', 'Sugar', 'Honey', 'Fruit'].map(type => (
                              <option key={type} value={type}>{t(`constants.fermentable_types.${type.toLowerCase()}`, type)}</option>
                            ))}
                          </select>
                       </div>
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Yield (PPG)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={yieldPpg} onChange={e => setYieldPpg(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Color (EBC)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={colorEbc} onChange={e => setColorEbc(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                       </div>
                       {(fermentableType === 'Honey' || fermentableType === 'Fruit') && (
                         <div className="form-field">
                            <label className="form-field__label">{t('Moisture (%)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={moistureContent} onChange={e => setMoistureContent(e.target.value === '' ? '' : Number(e.target.value))} />
                         </div>
                       )}
                    </div>
                  )}

                  {customCategory === 'Yeast' && (
                     <div className="inventory-form__dynamic-group">
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Form')}</label>
                            <select className="form-field__select" value={yeastForm} onChange={e => setYeastForm(e.target.value as any)}>
                              <option value="Dry">{t('constants.yeast_forms.dry', 'Dry')}</option>
                              <option value="Liquid">{t('constants.yeast_forms.liquid', 'Liquid')}</option>
                            </select>
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Tolerance (%)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={yeastTolerance} onChange={e => setYeastTolerance(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                       </div>
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Min Temp (°C)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={yeastTempMin} onChange={e => setYeastTempMin(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Max Temp (°C)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={yeastTempMax} onChange={e => setYeastTempMax(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                       </div>
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Attenuation (%)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={yeastAttenuation} onChange={e => setYeastAttenuation(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Nitrogen')}</label>
                            <select className="form-field__select" value={yeastNitrogen} onChange={e => setYeastNitrogen(e.target.value as any)}>
                              <option value="Low">{t('constants.nitrogen_demand.low', 'Low')}</option>
                              <option value="Medium">{t('constants.nitrogen_demand.medium', 'Medium')}</option>
                              <option value="High">{t('constants.nitrogen_demand.high', 'High')}</option>
                              <option value="Very High">{t('constants.nitrogen_demand.very_high', 'Very High')}</option>
                            </select>
                          </div>
                       </div>
                     </div>
                  )}

                  {customCategory === 'Hops' && (
                     <div className="inventory-form__dynamic-group">
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Alpha Acid (%)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={hopsAlpha} onChange={e => setHopsAlpha(e.target.value === '' ? '' : Number(e.target.value))} required />
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Form')}</label>
                            <select className="form-field__select" value={hopsForm} onChange={e => setHopsForm(e.target.value as any)}>
                              <option value="Pellet">{t('constants.hops_forms.pellet', 'Pellet')}</option>
                              <option value="Whole">{t('constants.hops_forms.whole', 'Whole')}</option>
                              <option value="Extract">{t('constants.hops_forms.extract', 'Extract')}</option>
                            </select>
                          </div>
                       </div>
                     </div>
                  )}

                  {customCategory === 'Additive' && (
                     <div className="inventory-form__dynamic-group">
                       <div className="inventory-form__row">
                          <div className="form-field">
                            <label className="form-field__label">{t('Additive Type')}</label>
                            <select className="form-field__select" value={additiveType} onChange={e => setAdditiveType(e.target.value as AdditiveType)}>
                              {ADDITIVE_TYPES.map(type => (
                                <option key={type} value={type}>{t(`constants.additive_types.${type.toLowerCase()}`, type)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-field">
                            <label className="form-field__label">{t('Dosage (g/10L)')}</label>
                            <input className="form-field__input" type="number" step="0.1" value={dosagePer10Liters} onChange={e => setDosagePer10Liters(e.target.value === '' ? '' : Number(e.target.value))} />
                          </div>
                       </div>
                     </div>
                  )}
                </div>
              )}

              {/* Quantity and Unit (Always visible) */}
              <div className="inventory-form__row inventory-form__row--margin-top">
                <div className="form-field form-field--grow">
                  <label className="form-field__label">{t('Quantity')}</label>
                  <input
                    className="form-field__input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Unit')}</label>
                  <select 
                    className="form-field__select" 
                    value={unit} 
                    onChange={(e) => setUnit(e.target.value as UnitType)}
                  >
                    {UNIT_TYPES.map((u) => (
                      <option key={u} value={u}>
                        {t(`constants.units.${u.toLowerCase()}`, u)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                className="inventory-form__submit-btn" 
                disabled={isLoading || (!isCreatingCustom && !selectedIngredientId) || quantity === ''}
              >
                {isLoading ? t('Saving...') : t('Add to Inventory')}
              </button>
            </div>
          </form>
        </aside>

        {/* --- MAIN: INVENTORY GRID --- */}
        <main className="inventory-page__main">
          {isLoading && (!inventory || inventory.length === 0) ? (
            <div className="inventory-page__loading">{t('Loading inventory...')}</div>
          ) : !inventory || inventory.length === 0 ? (
            <div className="inventory-page__empty-state">
              <p className="inventory-page__empty-text">{t('Your inventory is empty. Add ingredients to get started.')}</p>
            </div>
          ) : (
            <ul className="inventory-grid">
              {inventory.map((item) => {
                if (!item || !item.id) return null;
                const isOutOfStock = item.quantityOnHand <= 0;
                
                return (
                  <li key={item.id} className={`stock-card ${isOutOfStock ? 'stock-card--empty' : ''}`}>
                    <div className="stock-card__header">
                      <span className={`stock-card__badge stock-card__badge--${getCategoryClassModifier(item.ingredient.category)}`}>
                        {t(`constants.categories.${item.ingredient.category.toLowerCase().replace(' ', '_')}`, item.ingredient.category)}
                      </span>
                      <button 
                        className="stock-card__delete-btn" 
                        onClick={() => handleDeleteItem(item.id)} 
                        aria-label={t('Remove item')}
                        title={t('Remove from inventory')}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    
                    <div className="stock-card__body">
                      <h3 className="stock-card__title" title={item.ingredient.name}>
                        {item.ingredient.name}
                      </h3>
                      <p className="stock-card__meta">
                        {renderIngredientMeta(item.ingredient)}
                      </p>
                    </div>

                    <div className="stock-card__footer">
                      {isOutOfStock ? (
                        <span className="stock-card__amount stock-card__amount--empty">{t('Out of stock')}</span>
                      ) : (
                        <div className="stock-card__amount">
                          <span className="stock-card__value">{item.quantityOnHand}</span>
                          <span className="stock-card__unit">{t(`constants.units.${item.unit.toLowerCase()}`, item.unit)}</span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
        
      </div>
    </div>
  );
};

export default Inventory;