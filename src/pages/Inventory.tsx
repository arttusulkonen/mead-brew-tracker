import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPlus } from 'react-icons/fa';
import { EditedIngredientData, IngredientEditorModal } from '../components/IngredientEditorModal';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { IngredientCategory } from '../types/ingredient';

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

  const [activeModalCategory, setActiveModalCategory] = useState<IngredientCategory | null>(null);

  useEffect(() => {
    fetchGlobalIngredients();
  }, [fetchGlobalIngredients]);

  useEffect(() => {
    if (activeBrewery?.id) {
      fetchInventory(activeBrewery.id);
    }
  }, [activeBrewery?.id, fetchInventory]);

  const handleSaveFromModal = async (data: EditedIngredientData) => {
    if (!activeBrewery?.id) return;

    let targetId = data.globalIngredientId;
    const original = globalIngredients.find(i => i.id === targetId);

    if (!targetId || (original && original.name !== data.name)) {
      const baseData: any = {
        name: data.name,
        category: data.category,
        origin: data.origin,
        producer: data.producer,
        notes: data.description,
      };

      if (data.category === 'Fermentable') {
        baseData.type = data.form || 'Grain';
        baseData.yieldPpg = data.yieldPpg || 0;
        baseData.colorEbc = data.colorEbc || 0;
        baseData.isMashed = data.form === 'Grain';
        if (data.moistureContentPct) baseData.moistureContentPct = data.moistureContentPct;
      } else if (data.category === 'Yeast') {
        baseData.form = data.form || 'Dry';
        baseData.tempMinC = data.tempMinC ?? 15;
        baseData.tempMaxC = data.tempMaxC ?? 25;
        baseData.alcoholTolerancePct = data.alcoholTolerancePct ?? 14;
        baseData.attenuationPct = data.attenuationPct ?? 75;
        baseData.nitrogenDemand = data.nitrogenDemand ?? 'Medium';
      } else if (data.category === 'Hops') {
        baseData.form = data.form || 'Pellet';
        baseData.alphaAcidPct = data.alphaAcidPct ?? 5;
      } else if (data.category === 'Additive') {
        baseData.additiveType = data.additiveType ?? 'Nutrient';
        if (data.dosagePerGramYeast) baseData.dosagePerGramYeast = data.dosagePerGramYeast;
        if (data.dosagePer10Liters) baseData.dosagePer10Liters = data.dosagePer10Liters;
      } else if (data.category === 'Water Profile') {
        baseData.calciumPpm = data.calciumPpm || 0;
        baseData.magnesiumPpm = data.magnesiumPpm || 0;
        baseData.sodiumPpm = data.sodiumPpm || 0;
        baseData.sulfatePpm = data.sulfatePpm || 0;
        baseData.chloridePpm = data.chloridePpm || 0;
        baseData.bicarbonatePpm = data.bicarbonatePpm || 0;
      }

      const newIng = await addCustomIngredient(baseData);
      if (newIng?.id) targetId = newIng.id;
    }

    if (targetId) {
      await addInventoryItem(activeBrewery.id, {
        ingredientId: targetId,
        quantityOnHand: data.quantity,
        unit: data.unit || 'g',
      });
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
        return `${ing.yieldPpg ?? 36} PPG | ${ing.colorEbc ?? 5} EBC`;
      case 'Yeast':
        return `${ing.attenuationPct ?? 75}% ${t('Atten.')} | ${ing.alcoholTolerancePct ?? 12}% ABV`;
      case 'Hops':
        return `Alpha: ${ing.alphaAcidPct ?? 5}% | ${t(`constants.hops_forms.${ing.form?.toLowerCase() || 'pellet'}`, ing.form)}`;
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
      {activeModalCategory && (
        <IngredientEditorModal
          isOpen={!!activeModalCategory}
          onClose={() => setActiveModalCategory(null)}
          onSave={handleSaveFromModal}
          catalog={globalIngredients}
          category={activeModalCategory}
          mode="inventory"
        />
      )}

      <header className="inventory-page__header">
        <div className="inventory-page__title-block">
          <h1 className="inventory-page__title">{t('Workspace Inventory')}</h1>
          <span className="inventory-page__subtitle">{activeBrewery.name}</span>
        </div>
        <div className="inventory-page__actions" style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="recipe-lab__btn-secondary" onClick={() => setActiveModalCategory('Fermentable')}><FaPlus /> {t('Fermentable')}</button>
          <button type="button" className="recipe-lab__btn-secondary" onClick={() => setActiveModalCategory('Hops')}><FaPlus /> {t('Hops')}</button>
          <button type="button" className="recipe-lab__btn-secondary" onClick={() => setActiveModalCategory('Yeast')}><FaPlus /> {t('Yeast')}</button>
          <button type="button" className="recipe-lab__btn-secondary" onClick={() => setActiveModalCategory('Additive')}><FaPlus /> {t('Additive')}</button>
        </div>
      </header>

      {error && <div className="inventory-page__error">{error}</div>}

      <div className="inventory-page__layout" style={{ display: 'block' }}>
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