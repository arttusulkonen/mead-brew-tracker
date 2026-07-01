import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPen, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { EditedIngredientData, IngredientEditorModal } from '../components/IngredientEditorModal';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { PopulatedInventoryItem, UnitType } from '../types/ingredient';
import { UNIT_TYPES } from '../types/ingredient';

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
    updateItem,
    removeItem,
  } = useInventoryStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [editingStockItem, setEditingStockItem] = useState<PopulatedInventoryItem | null>(null);
  const [editStockQty, setEditStockQty] = useState<number | ''>('');
  const [editStockUnit, setEditStockUnit] = useState<UnitType>('g');
  const [isUpdating, setIsUpdating] = useState(false);

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
      } else if (data.category === 'Honey') {
        baseData.sugarContentBrix = data.sugarContentBrix ?? 80;
        baseData.moistureContentPct = data.moistureContentPct ?? 18;
      } else if (data.category === 'Yeast') {
        baseData.form = data.form || 'Dry';
        baseData.tempMinC = data.tempMinC ?? 15;
        baseData.tempMaxC = data.tempMaxC ?? 25;
        baseData.alcoholTolerancePct = data.alcoholTolerancePct ?? 14;
        baseData.alcoholTolerancePctMin = data.alcoholTolerancePctMin ?? 14;
        baseData.attenuationPct = data.attenuationPct ?? 75;
        baseData.attenuationPctMin = data.attenuationPctMin ?? 75;
        baseData.nitrogenDemand = data.nitrogenDemand ?? 'Medium';
      } else if (data.category === 'Hops') {
        baseData.form = data.form || 'Pellet';
        baseData.alphaAcidPct = data.alphaAcidPct ?? 5;
        baseData.alphaAcidPctMin = data.alphaAcidPctMin ?? 5;
      } else if (data.category === 'Additive') {
        baseData.additiveType = data.additiveType ?? 'Nutrient';
        if (data.additiveType === 'Nutrient' && data.nutrientRole) {
          baseData.nutrientRole = data.nutrientRole;
        }
        if (data.additionStage) baseData.additionStage = data.additionStage;
        if (data.yanValuePerGramPerLiter) baseData.yanValuePerGramPerLiter = data.yanValuePerGramPerLiter;
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

  const handleOpenEdit = (item: PopulatedInventoryItem) => {
    setEditingStockItem(item);
    setEditStockQty(item.quantityOnHand);
    setEditStockUnit(item.unit);
  };

  const handleSaveEdit = async () => {
    if (!activeBrewery?.id || !editingStockItem || editStockQty === '') return;
    setIsUpdating(true);
    try {
      await updateItem(activeBrewery.id, editingStockItem.id, {
        quantityOnHand: Number(editStockQty),
        unit: editStockUnit
      });
      setEditingStockItem(null);
    } catch (err) {
      console.error(err);
      alert(t('Failed to update stock.'));
    } finally {
      setIsUpdating(false);
    }
  };

  const renderIngredientMeta = (ing: any) => {
    if (!ing) return null;

    const formatRange = (min: number | undefined, max: number | undefined) => {
      return min && min !== max ? `${min}-${max}` : `${max}`;
    };

    switch (ing.category) {
      case 'Fermentable':
        return `${ing.yieldPpg ?? 36} PPG | ${ing.colorEbc ?? 5} EBC`;
      case 'Honey':
        return `${ing.sugarContentBrix ?? 80} Brix | ${ing.moistureContentPct ?? 18}% ${t('Moisture')}`;
      case 'Yeast':
        return `${formatRange(ing.attenuationPctMin, ing.attenuationPct)}% ${t('Attenuation')} | ${formatRange(ing.alcoholTolerancePctMin, ing.alcoholTolerancePct)}% ABV`;
      case 'Hops':
        return `${t('Alpha')}: ${formatRange(ing.alphaAcidPctMin, ing.alphaAcidPct)}% | ${t(`constants.hops_forms.${ing.form?.toLowerCase() || 'pellet'}`)}`;
      case 'Additive': {
        // Оборачиваем в блок, чтобы переменная была локальной для этого case
        const roleStr = ing.additiveType === 'Nutrient' && ing.nutrientRole
          ? ` | ${t(`constants.nutrient_roles.${ing.nutrientRole.toLowerCase()}`, ing.nutrientRole)}`
          : '';
        return ing.dosagePer10Liters 
          ? `${ing.dosagePer10Liters}g/10L${roleStr}` 
          : `${t(`constants.additive_types.${ing.additiveType?.toLowerCase().replace(' ', '_')}`)}${roleStr}`;
      }
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
      {isAddModalOpen && (
        <IngredientEditorModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleSaveFromModal}
          catalog={globalIngredients}
          category="Fermentable"
          mode="inventory"
        />
      )}

      {editingStockItem && (
        <div className="editor-modal-overlay" onMouseDown={() => setEditingStockItem(null)}>
          <div className="editor-modal" onMouseDown={e => e.stopPropagation()}>
            <div className="editor-modal__header">
              <h2>{t('Edit Stock')}</h2>
              <button type="button" className="editor-modal__close-btn" onClick={() => setEditingStockItem(null)} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <FaTimes />
              </button>
            </div>

            <div className="editor-modal__body">
              <p className="form-field__label">{editingStockItem.ingredient.name}</p>
              <div className="editor-modal__grid editor-modal__grid--stock">
                <div className="form-field">
                  <label className="form-field__label">{t('Quantity')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-field__input"
                    value={editStockQty}
                    onChange={e => setEditStockQty(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Unit')}</label>
                  <select
                    className="form-field__select"
                    value={editStockUnit}
                    onChange={e => setEditStockUnit(e.target.value as UnitType)}
                  >
                    {UNIT_TYPES.map(u => (
                      <option key={u} value={u}>{t(`constants.units.${u.toLowerCase()}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="editor-modal__footer">
              <button type="button" className="editor-modal__close-btn" onClick={() => setEditingStockItem(null)} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent' }}>{t('Cancel')}</button>
              <button type="button" style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }} onClick={handleSaveEdit} disabled={isUpdating || editStockQty === ''}>
                {isUpdating ? t('Saving...') : t('Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="inventory-page__header">
        <div className="inventory-page__title-block">
          <h1 className="inventory-page__title">{t('Workspace Inventory')}</h1>
          <span className="inventory-page__subtitle">{activeBrewery.name}</span>
        </div>
        <div className="inventory-page__actions">
          <button type="button" style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => setIsAddModalOpen(true)}>
            <FaPlus /> {t('Add Ingredient', 'Добавить ингредиент')}
          </button>
        </div>
      </header>

      {error && <div className="inventory-page__error">{error}</div>}

      <div className="inventory-page__layout">
        <main className="inventory-page__main">
          {isLoading && (!inventory || inventory.length === 0) ? (
            <div className="global-loader">
              <div className="spinner"></div>
            </div>
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
                        {t(`constants.categories.${item.ingredient.category.toLowerCase().replace(' ', '_')}`)}
                      </span>
                      <div className="form-field__group" style={{ gap: '4px' }}>
                        <button
                          className="btn-icon"
                          onClick={() => handleOpenEdit(item)}
                          title={t('Edit')}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                          <FaPen />
                        </button>
                        <button
                          className="btn-icon danger-outline"
                          onClick={() => handleDeleteItem(item.id)}
                          aria-label={t('Remove item')}
                          title={t('Remove from inventory')}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }}
                        >
                          <FaTrash />
                        </button>
                      </div>
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
                          <span className="stock-card__unit">{t(`constants.units.${item.unit.toLowerCase()}`)}</span>
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