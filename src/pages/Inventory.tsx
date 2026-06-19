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

  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [unit, setUnit] = useState<UnitType>('g');

  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<IngredientCategory>('Honey');

  const [honeyBrix, setHoneyBrix] = useState<number | ''>(79);
  const [honeyMoisture, setHoneyMoisture] = useState<number | ''>(18);
  
  const [yeastTempMin, setYeastTempMin] = useState<number | ''>(15);
  const [yeastTempMax, setYeastTempMax] = useState<number | ''>(25);
  const [yeastTolerance, setYeastTolerance] = useState<number | ''>(14);
  const [yeastNitrogen, setYeastNitrogen] = useState<'Low' | 'Medium' | 'High' | 'Very High'>('Low');
  
  const [hopsAlpha, setHopsAlpha] = useState<number | ''>(5);

  const [additiveType, setAdditiveType] = useState<AdditiveType>('Nutrient');
  const [dosagePer10Liters, setDosagePer10Liters] = useState<number | ''>('');
  const [dosagePerGramYeast, setDosagePerGramYeast] = useState<number | ''>('');

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

    const wasCreatingCustom = isCreatingCustom;
    let targetIngredientId = selectedIngredientId;

    if (wasCreatingCustom) {
      if (!customName || !customName.trim()) return;

      const fullData = {
        name: customName.trim(),
        category: customCategory,
      } as any;

      if (customCategory === 'Honey') {
        fullData.sugarContentBrix = Number(honeyBrix) || 79;
        fullData.moistureContentPct = Number(honeyMoisture) || 18;
      } else if (customCategory === 'Yeast') {
        fullData.tempMinC = Number(yeastTempMin) || 15;
        fullData.tempMaxC = Number(yeastTempMax) || 25;
        fullData.alcoholTolerancePct = Number(yeastTolerance) || 14;
        fullData.nitrogenDemand = yeastNitrogen || 'Low';
      } else if (customCategory === 'Hops') {
        fullData.alphaAcidPct = Number(hopsAlpha) || 5;
      } else if (customCategory === 'Additive') {
        fullData.additiveType = additiveType;
        if (dosagePer10Liters !== '') fullData.dosagePer10Liters = Number(dosagePer10Liters);
        if (dosagePerGramYeast !== '') fullData.dosagePerGramYeast = Number(dosagePerGramYeast);
      } else if (customCategory === 'Water Profile') {
        fullData.calciumPpm = 0;
        fullData.magnesiumPpm = 0;
        fullData.sodiumPpm = 0;
        fullData.sulfatePpm = 0;
        fullData.chloridePpm = 0;
        fullData.bicarbonatePpm = 0;
      }

      const newIng = await addCustomIngredient(fullData);
      if (newIng && newIng.id) {
        targetIngredientId = newIng.id;
        setIsCreatingCustom(false);
        setCustomName('');
        setSelectedIngredientId(newIng.id);
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
      if (!wasCreatingCustom) {
        setSelectedIngredientId('');
      }
      setQuantity('');
    }
  };

  const handleDeleteItem = async (itemId: string | undefined) => {
    if (!activeBrewery?.id || !itemId) return;
    const confirmed = window.confirm(t('Are you sure you want to delete this item?'));
    if (confirmed) {
      await removeItem(activeBrewery.id, itemId);
    }
  };

  const renderIngredientMeta = (ing: any) => {
    if (!ing) return null;
    if (ing.category === 'Honey') return `${t('Brix')}: ${ing.sugarContentBrix}%`;
    if (ing.category === 'Yeast') return `${t('Tolerance')}: ${ing.alcoholTolerancePct}% | ${t('Temp')}: ${ing.tempMinC}-${ing.tempMaxC}°C`;
    if (ing.category === 'Hops') return `${t('Alpha')}: ${ing.alphaAcidPct}%`;
    if (ing.category === 'Additive') {
      const notes = [];
      if (ing.dosagePer10Liters) notes.push(`${ing.dosagePer10Liters}g/10L`);
      if (ing.dosagePerGramYeast) notes.push(`${ing.dosagePerGramYeast}g/1g Yeast`);
      return notes.length > 0 ? notes.join(' | ') : t(ing.additiveType || 'Additive');
    }
    return null;
  };

  const selectedIng = globalIngredients?.find((ing) => ing?.id === selectedIngredientId);

  if (!activeBrewery) {
    return (
      <div className="inventory-container">
        <div className="no-brewery-message">
          {t('Please select or create a brewery to manage inventory.')}
        </div>
      </div>
    );
  }

  return (
    <div className="inventory-container">
      <div className="inventory-header">
        <h1>{t('Workspace Inventory')}</h1>
        <p>{activeBrewery.name}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="inventory-content">
        <section className="add-item-section">
          <h2>{t('Add to Stock')}</h2>
          <form className="add-item-form" onSubmit={handleAddItem}>
            <div className="form-group">
              <label htmlFor="ingredient">{t('Ingredient')}</label>
              {!isCreatingCustom ? (
                <div className="ingredient-select-wrapper">
                  <div className="flex-row gap-sm">
                    <select
                      id="ingredient"
                      value={selectedIngredientId}
                      onChange={(e) => setSelectedIngredientId(e.target.value)}
                      required
                      className="flex-1"
                    >
                      <option value="" disabled>
                        {t('Select an ingredient...')}
                      </option>
                      {INGREDIENT_CATEGORIES.map((cat) => {
                        const catIngs = globalIngredients?.filter((i) => i?.category === cat);
                        if (!catIngs || catIngs.length === 0) return null;
                        return (
                          <optgroup key={cat} label={t(cat)}>
                            {catIngs.map((ing) => {
                              if (!ing || !ing.id) return null;
                              return (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name}
                                </option>
                              );
                            })}
                          </optgroup>
                        );
                      })}
                    </select>
                    <button type="button" onClick={() => setIsCreatingCustom(true)} className="btn-switch px-md">
                      + {t('New')}
                    </button>
                  </div>

                  {selectedIng && (
                    <div className="ingredient-preview-panel">
                      <h4>{t('Composition Details')}</h4>
                      <div className="preview-grid">
                        {selectedIng.category === 'Honey' && (
                          <>
                            <div className="preview-item"><span>{t('Brix')}:</span> {selectedIng.sugarContentBrix}%</div>
                            <div className="preview-item"><span>{t('Moisture')}:</span> {selectedIng.moistureContentPct}%</div>
                          </>
                        )}
                        {selectedIng.category === 'Yeast' && (
                          <>
                            <div className="preview-item"><span>{t('Tolerance')}:</span> {selectedIng.alcoholTolerancePct}%</div>
                            <div className="preview-item"><span>{t('Nitrogen')}:</span> {t(selectedIng.nitrogenDemand)}</div>
                            <div className="preview-item"><span>{t('Temp')}:</span> {selectedIng.tempMinC}-{selectedIng.tempMaxC}°C</div>
                          </>
                        )}
                        {selectedIng.category === 'Hops' && (
                          <div className="preview-item"><span>{t('Alpha Acid')}:</span> {selectedIng.alphaAcidPct}%</div>
                        )}
                        {selectedIng.category === 'Additive' && (
                          <>
                            <div className="preview-item"><span>{t('Type')}:</span> {t(selectedIng.additiveType || 'Unknown')}</div>
                            {selectedIng.dosagePer10Liters && <div className="preview-item"><span>{t('Dosage')}:</span> {selectedIng.dosagePer10Liters}g per 10L</div>}
                            {selectedIng.dosagePerGramYeast && <div className="preview-item"><span>{t('Dosage')}:</span> {selectedIng.dosagePerGramYeast}g per 1g Yeast</div>}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="custom-ingredient-wrapper">
                  <input
                    type="text"
                    placeholder={t('Ingredient Name')}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                  <div className="flex-row gap-sm">
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as IngredientCategory)}
                      className="flex-1"
                    >
                      {INGREDIENT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{t(cat)}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setIsCreatingCustom(false)} className="btn-switch px-md">
                      {t('Cancel')}
                    </button>
                  </div>

                  {customCategory === 'Honey' && (
                    <div className="custom-fields-panel">
                      <div className="form-row">
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Brix')}</label>
                            <span className="tooltip-icon" data-tooltip={t("Brix indicates the sugar content of the honey. Typically around 79-82%.")}>?</span>
                          </div>
                          <input type="number" step="0.1" value={honeyBrix} onChange={(e) => setHoneyBrix(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Moisture')} (%)</label>
                            <span className="tooltip-icon" data-tooltip={t("Moisture level in honey. Usually 17-18%. Crucial for calculating volume and stability.")}>?</span>
                          </div>
                          <input type="number" step="0.1" value={honeyMoisture} onChange={(e) => setHoneyMoisture(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                      </div>
                    </div>
                  )}

                  {customCategory === 'Yeast' && (
                    <div className="custom-fields-panel">
                      <div className="form-row">
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Tolerance')} (%)</label>
                            <span className="tooltip-icon" data-tooltip={t("The maximum alcohol percentage (ABV) this yeast can ferment before it stops.")}>?</span>
                          </div>
                          <input type="number" step="0.1" value={yeastTolerance} onChange={(e) => setYeastTolerance(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Nitrogen Demand')}</label>
                            <span className="tooltip-icon" data-tooltip={t("Yeast requirement for nutrients (YAN).")}>?</span>
                          </div>
                          <select value={yeastNitrogen} onChange={(e) => setYeastNitrogen(e.target.value as any)}>
                            <option value="Low">{t('Low')}</option>
                            <option value="Medium">{t('Medium')}</option>
                            <option value="High">{t('High')}</option>
                            <option value="Very High">{t('Very High')}</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Min Temp')} (°C)</label>
                            <span className="tooltip-icon" data-tooltip={t("The optimal temperature range for this yeast to ferment cleanly.")}>?</span>
                          </div>
                          <input type="number" step="0.1" value={yeastTempMin} onChange={(e) => setYeastTempMin(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Max Temp')} (°C)</label>
                            <span className="tooltip-icon" data-tooltip={t("The optimal temperature range for this yeast to ferment cleanly.")}>?</span>
                          </div>
                          <input type="number" step="0.1" value={yeastTempMax} onChange={(e) => setYeastTempMax(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                      </div>
                    </div>
                  )}

                  {customCategory === 'Hops' && (
                    <div className="custom-fields-panel">
                      <div className="form-group">
                        <div className="label-with-tooltip">
                          <label>{t('Alpha Acid')} (%)</label>
                          <span className="tooltip-icon" data-tooltip={t("Alpha acid percentage determines the bitterness potential.")}>?</span>
                        </div>
                        <input type="number" step="0.1" value={hopsAlpha} onChange={(e) => setHopsAlpha(e.target.value === '' ? '' : Number(e.target.value))} required />
                      </div>
                    </div>
                  )}

                  {customCategory === 'Additive' && (
                    <div className="custom-fields-panel">
                      <div className="form-group mb-md">
                         <div className="label-with-tooltip">
                            <label>{t('Additive Type')}</label>
                            <span className="tooltip-icon" data-tooltip={t("Select the sub-category of this additive.")}>?</span>
                         </div>
                         <select value={additiveType} onChange={(e) => setAdditiveType(e.target.value as AdditiveType)}>
                           {ADDITIVE_TYPES.map(type => (
                             <option key={type} value={type}>{t(type)}</option>
                           ))}
                         </select>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Dosage / 10 Liters')} (g)</label>
                            <span className="tooltip-icon" data-tooltip={t("e.g., Fermaid-O requires ~3-4g per 10 liters of must. Leave blank if not applicable.")}>?</span>
                          </div>
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            placeholder={t('Optional')}
                            value={dosagePer10Liters} 
                            onChange={(e) => setDosagePer10Liters(e.target.value === '' ? '' : Number(e.target.value))} 
                          />
                        </div>
                        <div className="form-group">
                          <div className="label-with-tooltip">
                            <label>{t('Dosage / 1g Yeast')} (g)</label>
                            <span className="tooltip-icon" data-tooltip={t("e.g., Go-Ferm requires 1.25g for every 1g of dry yeast. Leave blank if not applicable.")}>?</span>
                          </div>
                          <input 
                            type="number" 
                            step="0.01" 
                            min="0"
                            placeholder={t('Optional')}
                            value={dosagePerGramYeast} 
                            onChange={(e) => setDosagePerGramYeast(e.target.value === '' ? '' : Number(e.target.value))} 
                          />
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="quantity">{t('Quantity')}</label>
                <input
                  type="number"
                  id="quantity"
                  min="0"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="unit">{t('Unit')}</label>
                <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value as UnitType)}>
                  {UNIT_TYPES.map((u) => (
                    <option key={u} value={u}>
                      {t(u)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn-submit" disabled={isLoading || (!isCreatingCustom && !selectedIngredientId) || quantity === ''}>
              {isLoading ? t('Adding...') : t('Add Item')}
            </button>
          </form>
        </section>

        <section className="stock-list-section">
          <h2>{t('Current Stock')}</h2>
          {isLoading && (!inventory || inventory.length === 0) ? (
            <div className="loading-text">{t('Loading inventory...')}</div>
          ) : !inventory || inventory.length === 0 ? (
            <div className="empty-state">{t('Your inventory is empty.')}</div>
          ) : (
            <div className="inventory-grid">
              {inventory.map((item) => {
                if (!item || !item.id) return null;
                return (
                  <div key={item.id} className={`inventory-card ${item.quantityOnHand <= 0 ? 'out-of-stock' : ''}`}>
                    <div className="card-header">
                      <span className="category-badge" data-category={item?.ingredient?.category}>
                        {t(item?.ingredient?.category || 'Unknown')}
                      </span>
                      <button className="btn-remove" onClick={() => handleDeleteItem(item.id)} aria-label={t('Remove')}>
                        &times;
                      </button>
                    </div>
                    <h3 className="ingredient-name">{item?.ingredient?.name || 'Unknown'}</h3>
                    <div className="ingredient-meta">
                      {renderIngredientMeta(item?.ingredient)}
                    </div>
                    <div className="stock-amount">
                      {item.quantityOnHand <= 0 ? (
                        <span className="value out-of-stock-text">{t('Out of stock')}</span>
                      ) : (
                        <>
                          <span className="value">{item.quantityOnHand}</span>
                          <span className="unit">{t(item.unit)}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Inventory;