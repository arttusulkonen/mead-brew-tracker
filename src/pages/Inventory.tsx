import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../assets/scss/pages/_inventory.scss';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { IngredientCategory, UnitType } from '../types/ingredient';

const UNITS: UnitType[] = ['g', 'kg', 'L', 'ml', 'oz', 'lb', 'gal', 'unit'];

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
      let fullData: any = { name: customName.trim(), category: customCategory };
      
      if (customCategory === 'Honey') fullData = { ...fullData, sugarContentBrix: 79, moistureContentPct: 18 };
      if (customCategory === 'Yeast') fullData = { ...fullData, tempMinC: 15, tempMaxC: 25, alcoholTolerancePct: 14, nitrogenDemand: 'Low' };
      if (customCategory === 'Hops') fullData = { ...fullData, alphaAcidPct: 5 };
      if (customCategory === 'Water Profile') fullData = { ...fullData, calciumPpm: 0, magnesiumPpm: 0, sodiumPpm: 0, sulfatePpm: 0, chloridePpm: 0, bicarbonatePpm: 0 };
      if (customCategory === 'Additive') fullData = { ...fullData, additiveType: 'Nutrient', yanValuePerGramPerLiter: 0 };
      
      const newIng = await addCustomIngredient(fullData);
      if (newIng) {
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
      if (!isCreatingCustom) {
        setSelectedIngredientId('');
      }
      setQuantity('');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!activeBrewery?.id) return;
    const confirmed = window.confirm(t('Are you sure you want to delete this item?'));
    if (confirmed) {
      await removeItem(activeBrewery.id, itemId);
    }
  };

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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    id="ingredient"
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  >
                    <option value="" disabled>
                      {t('Select an ingredient...')}
                    </option>
                    {globalIngredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.category})
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setIsCreatingCustom(true)} className="btn-switch" style={{ padding: '0 12px' }}>
                    + {t('New')}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={t('Ingredient Name')}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value as IngredientCategory)}
                      style={{ flex: 1 }}
                    >
                      <option value="Honey">Honey</option>
                      <option value="Yeast">Yeast</option>
                      <option value="Hops">Hops</option>
                      <option value="Additive">Additive</option>
                      <option value="Water Profile">Water Profile</option>
                    </select>
                    <button type="button" onClick={() => setIsCreatingCustom(false)} className="btn-switch" style={{ padding: '0 12px' }}>
                      {t('Cancel')}
                    </button>
                  </div>
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
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
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
          {isLoading && inventory.length === 0 ? (
            <div className="loading-text">{t('Loading inventory...')}</div>
          ) : inventory.length === 0 ? (
            <div className="empty-state">{t('Your inventory is empty.')}</div>
          ) : (
            <div className="inventory-grid">
              {inventory.map((item) => (
                <div key={item.id} className="inventory-card">
                  <div className="card-header">
                    <span className="category-badge" data-category={item.ingredient.category}>
                      {item.ingredient.category}
                    </span>
                    <button className="btn-remove" onClick={() => handleDeleteItem(item.id)} aria-label={t('Remove')}>
                      &times;
                    </button>
                  </div>
                  <h3 className="ingredient-name">{item.ingredient.name}</h3>
                  <div className="stock-amount">
                    <span className="value">{item.quantityOnHand}</span>
                    <span className="unit">{item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Inventory;