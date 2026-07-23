// src/pages/Inventory.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaPen, FaPlus, FaTrash } from 'react-icons/fa';
import { EditedIngredientData, IngredientEditorModal } from '../components/IngredientEditorModal';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { IngredientUnion, PopulatedInventoryItem } from '../types/ingredient';

const getBaseUnit = (u: string) => {
  if (['g', 'kg', 'oz', 'lb'].includes(u)) return 'kg';
  if (['ml', 'L', 'gal'].includes(u)) return 'l';
  return 'unit';
};

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
  const [editingInventoryItem, setEditingInventoryItem] = useState<PopulatedInventoryItem | null>(null);

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

    let isModified = false;
    if (original) {
      if (original.name !== data.name) isModified = true;
      if (original.origin !== data.origin) isModified = true;
      if (original.producer !== data.producer) isModified = true;
      if ((original.notes || original.description) !== data.description) isModified = true;
      if ((original as any).form !== data.form && (original as any).type !== data.form) isModified = true;

      if (data.category === 'Additive') {
        if ((original as any).additiveType !== data.additiveType) isModified = true;
        if ((original as any).nutrientRole !== data.nutrientRole) isModified = true;
        if ((original as any).additionStage !== data.additionStage) isModified = true;
        if ((original as any).yanValuePerGramPerLiter !== data.yanValuePerGramPerLiter) isModified = true;
        if ((original as any).dosagePerGramYeast !== data.dosagePerGramYeast) isModified = true;
        if ((original as any).dosagePer10Liters !== data.dosagePer10Liters) isModified = true;
      } else if (data.category === 'Fermentable') {
        if ((original as any).yieldPpg !== data.yieldPpg) isModified = true;
        if ((original as any).colorEbc !== data.colorEbc) isModified = true;
        if ((original as any).diastaticPowerLintner !== data.diastaticPowerLintner) isModified = true;
        if ((original as any).moistureContentPct !== data.moistureContentPct) isModified = true;
      } else if (data.category === 'Honey') {
        if ((original as any).sugarContentBrix !== data.sugarContentBrix) isModified = true;
        if ((original as any).moistureContentPct !== data.moistureContentPct) isModified = true;
      } else if (data.category === 'Yeast') {
        if ((original as any).alcoholTolerancePct !== data.alcoholTolerancePct) isModified = true;
        if ((original as any).alcoholTolerancePctMin !== data.alcoholTolerancePctMin) isModified = true;
        if ((original as any).attenuationPct !== data.attenuationPct) isModified = true;
        if ((original as any).attenuationPctMin !== data.attenuationPctMin) isModified = true;
        if ((original as any).tempMinC !== data.tempMinC) isModified = true;
        if ((original as any).tempMaxC !== data.tempMaxC) isModified = true;
        if ((original as any).nitrogenDemand !== data.nitrogenDemand) isModified = true;
      } else if (data.category === 'Hops') {
        if ((original as any).alphaAcidPct !== data.alphaAcidPct) isModified = true;
        if ((original as any).alphaAcidPctMin !== data.alphaAcidPctMin) isModified = true;
      } else if (data.category === 'Water Profile') {
        if ((original as any).calciumPpm !== data.calciumPpm) isModified = true;
        if ((original as any).magnesiumPpm !== data.magnesiumPpm) isModified = true;
        if ((original as any).sodiumPpm !== data.sodiumPpm) isModified = true;
        if ((original as any).sulfatePpm !== data.sulfatePpm) isModified = true;
        if ((original as any).chloridePpm !== data.chloridePpm) isModified = true;
        if ((original as any).bicarbonatePpm !== data.bicarbonatePpm) isModified = true;
      }
    }

    if (!targetId || isModified) {
      const baseData: Record<string, unknown> = {
        name: data.name,
        category: data.category,
        origin: data.origin || '',
        producer: data.producer || '',
        notes: data.description || '',
      };

      if (data.category === 'Fermentable') {
        baseData.type = data.form || 'Grain';
        baseData.yieldPpg = data.yieldPpg || 0;
        baseData.colorEbc = data.colorEbc || 0;
        baseData.isMashed = data.form === 'Grain';
        if (data.moistureContentPct != null) baseData.moistureContentPct = data.moistureContentPct;
        if (data.diastaticPowerLintner != null) baseData.diastaticPowerLintner = data.diastaticPowerLintner;
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
        baseData.form = data.form;
        if (data.additiveType === 'Sweetener' && !baseData.form) {
          baseData.form = 'Other';
        }
        if (data.additiveType === 'Nutrient' && data.nutrientRole) {
          baseData.nutrientRole = data.nutrientRole;
        }
        if (data.additionStage) baseData.additionStage = data.additionStage;
        if (data.yanValuePerGramPerLiter != null) baseData.yanValuePerGramPerLiter = data.yanValuePerGramPerLiter;
        if (data.dosagePerGramYeast != null) baseData.dosagePerGramYeast = data.dosagePerGramYeast;
        if (data.dosagePer10Liters != null) baseData.dosagePer10Liters = data.dosagePer10Liters;
      } else if (data.category === 'Water Profile') {
        baseData.calciumPpm = data.calciumPpm || 0;
        baseData.magnesiumPpm = data.magnesiumPpm || 0;
        baseData.sodiumPpm = data.sodiumPpm || 0;
        baseData.sulfatePpm = data.sulfatePpm || 0;
        baseData.chloridePpm = data.chloridePpm || 0;
        baseData.bicarbonatePpm = data.bicarbonatePpm || 0;
      }

      const newIng = await addCustomIngredient(baseData as unknown as Omit<IngredientUnion, 'id' | 'updatedAt'>);
      if (newIng?.id) targetId = newIng.id;
    }

    if (targetId) {
      const payload: Record<string, any> = {
        ingredientId: targetId,
        quantityOnHand: data.quantity,
        unit: data.unit || 'g',
        costPerBaseUnit: data.costPerBaseUnit || 0,
        currency: data.currency || '€'
      };

      if (data.inventoryItemId) {
        await updateItem(activeBrewery.id, data.inventoryItemId, payload);
      } else {
        await addInventoryItem(activeBrewery.id, payload);
      }
    }
    
    setIsAddModalOpen(false);
    setEditingInventoryItem(null);
  };

  const handleDeleteItem = async (itemId: string | undefined) => {
    if (!activeBrewery?.id || !itemId) return;
    if (window.confirm(t('Are you sure you want to delete this item?'))) {
      await removeItem(activeBrewery.id, itemId);
    }
  };

  const handleOpenEdit = (item: PopulatedInventoryItem) => {
    setEditingInventoryItem(item);
    setIsAddModalOpen(true);
  };

  const renderIngredientMeta = (ing: IngredientUnion) => {
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
        const roleStr = ing.additiveType === 'Nutrient' && (ing as any).nutrientRole
          ? ` | ${t(`constants.nutrient_roles.${(ing as any).nutrientRole.toLowerCase()}`)}`
          : '';
        const stageStr = (ing as any).additionStage ? ` (${(ing as any).additionStage})` : '';
        return ing.dosagePer10Liters 
          ? `${ing.dosagePer10Liters}g/10L${roleStr}${stageStr}` 
          : `${t(`constants.additive_types.${ing.additiveType?.toLowerCase().replace(' ', '_')}`)}${roleStr}${stageStr}`;
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
      <div className="inventory">
        <div className="inventory__empty-state">
          <p className="inventory__empty-text">{t('Please select or create a brewery to manage inventory.')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inventory">
      {isAddModalOpen && (
        <IngredientEditorModal
          isOpen={isAddModalOpen}
          onClose={() => { setIsAddModalOpen(false); setEditingInventoryItem(null); }}
          onSave={handleSaveFromModal}
          catalog={globalIngredients}
          category={editingInventoryItem ? editingInventoryItem.ingredient.category : "Fermentable"}
          mode="inventory"
          initialData={editingInventoryItem ? {
            inventoryItemId: editingInventoryItem.id,
            globalIngredientId: editingInventoryItem.ingredientId,
            name: editingInventoryItem.ingredient.name,
            category: editingInventoryItem.ingredient.category,
            quantity: editingInventoryItem.quantityOnHand,
            unit: editingInventoryItem.unit,
            costPerBaseUnit: editingInventoryItem.costPerBaseUnit,
            currency: editingInventoryItem.currency,
            form: (editingInventoryItem.ingredient as any).form || (editingInventoryItem.ingredient as any).type,
            origin: editingInventoryItem.ingredient.origin,
            producer: editingInventoryItem.ingredient.producer,
            description: editingInventoryItem.ingredient.notes,
            yieldPpg: (editingInventoryItem.ingredient as any).yieldPpg,
            colorEbc: (editingInventoryItem.ingredient as any).colorEbc,
            moistureContentPct: (editingInventoryItem.ingredient as any).moistureContentPct,
            diastaticPowerLintner: (editingInventoryItem.ingredient as any).diastaticPowerLintner,
            sugarContentBrix: (editingInventoryItem.ingredient as any).sugarContentBrix,
            alphaAcidPct: (editingInventoryItem.ingredient as any).alphaAcidPct,
            alphaAcidPctMin: (editingInventoryItem.ingredient as any).alphaAcidPctMin,
            alcoholTolerancePct: (editingInventoryItem.ingredient as any).alcoholTolerancePct,
            alcoholTolerancePctMin: (editingInventoryItem.ingredient as any).alcoholTolerancePctMin,
            attenuationPct: (editingInventoryItem.ingredient as any).attenuationPct,
            attenuationPctMin: (editingInventoryItem.ingredient as any).attenuationPctMin,
            tempMinC: (editingInventoryItem.ingredient as any).tempMinC,
            tempMaxC: (editingInventoryItem.ingredient as any).tempMaxC,
            nitrogenDemand: (editingInventoryItem.ingredient as any).nitrogenDemand,
            additiveType: (editingInventoryItem.ingredient as any).additiveType,
            additionStage: (editingInventoryItem.ingredient as any).additionStage,
            nutrientRole: (editingInventoryItem.ingredient as any).nutrientRole,
            yanValuePerGramPerLiter: (editingInventoryItem.ingredient as any).yanValuePerGramPerLiter,
            dosagePerGramYeast: (editingInventoryItem.ingredient as any).dosagePerGramYeast,
            dosagePer10Liters: (editingInventoryItem.ingredient as any).dosagePer10Liters,
            calciumPpm: (editingInventoryItem.ingredient as any).calciumPpm,
            magnesiumPpm: (editingInventoryItem.ingredient as any).magnesiumPpm,
            sodiumPpm: (editingInventoryItem.ingredient as any).sodiumPpm,
            sulfatePpm: (editingInventoryItem.ingredient as any).sulfatePpm,
            chloridePpm: (editingInventoryItem.ingredient as any).chloridePpm,
            bicarbonatePpm: (editingInventoryItem.ingredient as any).bicarbonatePpm,
          } : undefined}
        />
      )}

      <header className="inventory__header">
        <div className="inventory__title-block">
          <h1 className="inventory__title">{t('Workspace Inventory')}</h1>
          <span className="inventory__subtitle">{activeBrewery.name}</span>
        </div>
        <div className="inventory__actions">
          <button type="button" className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <FaPlus /> {t('Add Ingredient')}
          </button>
        </div>
      </header>

      {error && <div className="session-alert session-alert--warning inventory__error">{error}</div>}

      <div className="inventory__layout">
        {isLoading && (!inventory || inventory.length === 0) ? (
          <div className="global-loader">
            <div className="spinner"></div>
          </div>
        ) : !inventory || inventory.length === 0 ? (
          <div className="inventory__empty-state">
            <p className="inventory__empty-text">{t('Your inventory is empty. Add ingredients to get started.')}</p>
          </div>
        ) : (
          <ul className="inventory__grid">
            {inventory.map((item) => {
              if (!item || !item.id) return null;
              const isOutOfStock = item.quantityOnHand <= 0;

              return (
                <li key={item.id} className={`stock-card ${isOutOfStock ? 'stock-card--empty' : ''}`}>
                  <div className="stock-card__header">
                    <span className={`stock-card__badge stock-card__badge--${getCategoryClassModifier(item.ingredient.category)}`}>
                      {t(`constants.categories.${item.ingredient.category.toLowerCase().replace(' ', '_')}`)}
                    </span>
                    <div className="stock-card__actions">
                      <button className="stock-card__btn-action" onClick={() => handleOpenEdit(item)} title={t('Edit')} aria-label={t('Edit')}>
                        <FaPen />
                      </button>
                      <button className="stock-card__btn-action stock-card__btn-action--danger" onClick={() => handleDeleteItem(item.id)} title={t('Remove from inventory')} aria-label={t('Remove from inventory')}>
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
                    <div className="stock-card__cost">
                      {item.costPerBaseUnit && item.costPerBaseUnit > 0 ? (
                        <span className="stock-card__cost-val">
                          {item.costPerBaseUnit.toFixed(2)}{item.currency} / {t(`constants.units.${getBaseUnit(item.unit)}`)}
                        </span>
                      ) : null}
                    </div>
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
      </div>
    </div>
  );
};

export default Inventory;