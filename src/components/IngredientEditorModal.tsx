import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { AdditiveType, BaseIngredient, IngredientCategory, UnitType } from '../types/ingredient';
import { ADDITIVE_TYPES, UNIT_TYPES } from '../types/ingredient';

export type NutrientRole = 'Rehydration' | 'Fermentation' | 'Other';

export interface EditedIngredientData {
  globalIngredientId: string | null;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string;
  form?: string;
  origin?: string;
  producer?: string;
  description?: string;
  yieldPpg?: number;
  colorEbc?: number;
  moistureContentPct?: number;
  diastaticPowerLintner?: number;
  sugarContentBrix?: number;
  alphaAcidPct?: number;
  alphaAcidPctMin?: number;
  boilTimeMinutes?: number;
  alcoholTolerancePct?: number;
  alcoholTolerancePctMin?: number;
  attenuationPct?: number;
  attenuationPctMin?: number;
  tempMinC?: number;
  tempMaxC?: number;
  nitrogenDemand?: 'Low' | 'Medium' | 'High' | 'Very High';
  additiveType?: AdditiveType;
  additionStage?: string;
  nutrientRole?: NutrientRole;
  yanValuePerGramPerLiter?: number;
  dosagePerGramYeast?: number;
  dosagePer10Liters?: number;
  calciumPpm?: number;
  magnesiumPpm?: number;
  sodiumPpm?: number;
  sulfatePpm?: number;
  chloridePpm?: number;
  bicarbonatePpm?: number;
  unit?: UnitType;
}

interface IngredientEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EditedIngredientData) => void;
  catalog: BaseIngredient[];
  category: IngredientCategory;
  initialQuery?: string;
  initialAdditiveType?: string;
  onIngredientCreated?: (ingredient: any) => void;
  mode?: 'recipe' | 'inventory';
}

const ALL_CATEGORIES: IngredientCategory[] = ['Fermentable', 'Honey', 'Hops', 'Yeast', 'Additive', 'Water Profile'];
const NITROGEN_LEVELS: Array<NonNullable<EditedIngredientData['nitrogenDemand']>> = ['Low', 'Medium', 'High', 'Very High'];
const HOPS_FORMS = ['Pellet', 'Whole', 'Extract'];
const YEAST_FORMS = ['Dry', 'Liquid'];
const FERMENTABLE_TYPES = ['Grain', 'Extract', 'Sugar', 'Honey', 'Fruit'];

const SUGGESTED_STAGE_BY_ADDITIVE_TYPE: Partial<Record<AdditiveType, string>> = {
  Fruit: 'Secondary',
  Spice: 'Aging',
  Acid: 'Bottling',
  Clarifier: 'Aging',
  Stabilizer: 'Bottling'
};

export const IngredientEditorModal: React.FC<IngredientEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  catalog,
  category,
  initialQuery = '',
  initialAdditiveType = '',
  onIngredientCreated,
  mode = 'recipe'
}) => {
  const { t } = useTranslation();
  const { activeBrewery } = useBreweryStore();
  const { addCustomIngredient, addInventoryItem, inventory } = useInventoryStore();

  const validInitialAdditiveType = (ADDITIVE_TYPES as readonly string[]).includes(initialAdditiveType)
    ? (initialAdditiveType as AdditiveType)
    : undefined;

  const buildDefaults = (targetCategory: IngredientCategory): EditedIngredientData => ({
    globalIngredientId: null,
    name: initialQuery,
    category: targetCategory,
    quantity: 0,
    note: '',
    origin: '',
    producer: '',
    description: '',
    unit: 'g',
    ...(targetCategory === 'Hops' ? { form: 'Pellet', alphaAcidPct: 5, alphaAcidPctMin: 5, boilTimeMinutes: 60 } : {}),
    ...(targetCategory === 'Fermentable' ? { form: 'Grain', yieldPpg: 36, colorEbc: 5 } : {}),
    ...(targetCategory === 'Honey' ? { sugarContentBrix: 80, moistureContentPct: 18, yieldPpg: 36 } : {}),
    ...(targetCategory === 'Yeast' ? { form: 'Dry', alcoholTolerancePct: 12, alcoholTolerancePctMin: 12, attenuationPct: 75, attenuationPctMin: 75, tempMinC: 15, tempMaxC: 25, nitrogenDemand: 'Medium' as const } : {}),
    ...(targetCategory === 'Additive' ? { additiveType: validInitialAdditiveType || 'Nutrient', nutrientRole: 'Fermentation', additionStage: validInitialAdditiveType ? SUGGESTED_STAGE_BY_ADDITIVE_TYPE[validInitialAdditiveType] || '' : '' } : {}),
    ...(targetCategory === 'Water Profile' ? { calciumPpm: 0, magnesiumPpm: 0, sodiumPpm: 0, sulfatePpm: 0, chloridePpm: 0, bicarbonatePpm: 0 } : {})
  });

  const [formData, setFormData] = useState<EditedIngredientData>(buildDefaults(category));
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [saveToStock, setSaveToStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [stockUnit, setStockUnit] = useState<UnitType>('kg');
  const [isPersistingToStock, setIsPersistingToStock] = useState(false);
  const [stockError, setStockError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setFormData(buildDefaults(category));
      setShowSuggestions(!!initialQuery);
      setSaveToStock(false);
      setStockQuantity('');
      setStockUnit('kg');
      setStockError('');
    }
  }, [isOpen, category, initialQuery, initialAdditiveType]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const filteredSuggestions = useMemo(() => {
    const categoryMatches = catalog.filter(ing => ing.category === formData.category);
    
    let filtered = categoryMatches;
    if (formData.name) {
      filtered = categoryMatches.filter(ing => ing.name.toLowerCase().includes(formData.name.toLowerCase()));
    }

    const enhanced = filtered.map(ing => {
      const stockItem = inventory?.find(inv => inv.ingredientId === ing.id);
      return {
        ...ing,
        inStockQty: stockItem ? stockItem.quantityOnHand : 0,
        inStockUnit: stockItem ? stockItem.unit : 'g'
      };
    });

    enhanced.sort((a, b) => {
      if (a.inStockQty > 0 && b.inStockQty <= 0) return -1;
      if (a.inStockQty <= 0 && b.inStockQty > 0) return 1;
      return a.name.localeCompare(b.name);
    });

    return enhanced.slice(0, 100);
  }, [catalog, formData.category, formData.name, inventory]);

  const handleSelectSuggestion = (ing: any) => {
    setFormData(prev => ({
      ...prev,
      globalIngredientId: ing.id,
      name: ing.name,
      form: ing.form ?? prev.form,
      origin: ing.origin ?? prev.origin,
      producer: ing.producer ?? prev.producer,
      description: ing.notes ?? prev.description,
      yieldPpg: ing.yieldPpg ?? prev.yieldPpg,
      colorEbc: ing.colorEbc ?? prev.colorEbc,
      alphaAcidPct: ing.alphaAcidPct ?? prev.alphaAcidPct,
      alphaAcidPctMin: ing.alphaAcidPctMin ?? prev.alphaAcidPctMin,
      alcoholTolerancePct: ing.alcoholTolerancePct ?? prev.alcoholTolerancePct,
      alcoholTolerancePctMin: ing.alcoholTolerancePctMin ?? prev.alcoholTolerancePctMin,
      attenuationPct: ing.attenuationPct ?? prev.attenuationPct,
      attenuationPctMin: ing.attenuationPctMin ?? prev.attenuationPctMin,
      tempMinC: ing.tempMinC ?? prev.tempMinC,
      tempMaxC: ing.tempMaxC ?? prev.tempMaxC,
      nitrogenDemand: ing.nitrogenDemand ?? prev.nitrogenDemand,
      additiveType: ing.additiveType ?? prev.additiveType,
      nutrientRole: ing.nutrientRole ?? prev.nutrientRole,
      additionStage: ing.additionStage ?? prev.additionStage,
      yanValuePerGramPerLiter: ing.yanValuePerGramPerLiter ?? prev.yanValuePerGramPerLiter,
      dosagePerGramYeast: ing.dosagePerGramYeast ?? prev.dosagePerGramYeast,
      dosagePer10Liters: ing.dosagePer10Liters ?? prev.dosagePer10Liters,
      moistureContentPct: ing.moistureContentPct ?? prev.moistureContentPct,
      diastaticPowerLintner: ing.diastaticPowerLintner ?? prev.diastaticPowerLintner,
      sugarContentBrix: ing.sugarContentBrix ?? prev.sugarContentBrix,
      calciumPpm: ing.calciumPpm ?? prev.calciumPpm,
      magnesiumPpm: ing.magnesiumPpm ?? prev.magnesiumPpm,
      sodiumPpm: ing.sodiumPpm ?? prev.sodiumPpm,
      sulfatePpm: ing.sulfatePpm ?? prev.sulfatePpm,
      chloridePpm: ing.chloridePpm ?? prev.chloridePpm,
      bicarbonatePpm: ing.bicarbonatePpm ?? prev.bicarbonatePpm
    }));
    setShowSuggestions(false);
  };

  const handleChange = (field: keyof EditedIngredientData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange('name', e.target.value);
    handleChange('globalIngredientId', null);
    setShowSuggestions(true);
  };

  const handleCategoryChange = (newCategory: IngredientCategory) => {
    setFormData(prev => ({
      ...buildDefaults(newCategory),
      name: prev.name,
      quantity: prev.quantity,
      unit: prev.unit,
      globalIngredientId: null 
    }));
    setShowSuggestions(false);
  };

  const persistToInventory = async () => {
    if (!activeBrewery?.id || stockQuantity === '') return;

    let ingredientId = formData.globalIngredientId;

    if (!ingredientId) {
      const baseData: any = {
        name: formData.name,
        category: formData.category
      };

      if (formData.origin) baseData.origin = formData.origin;
      if (formData.producer) baseData.producer = formData.producer;
      if (formData.description) baseData.notes = formData.description;

      if (formData.category === 'Fermentable') {
        baseData.type = formData.form || 'Grain';
        baseData.yieldPpg = formData.yieldPpg || 0;
        baseData.colorEbc = formData.colorEbc || 0;
        baseData.isMashed = formData.form === 'Grain';
        if ((formData.form === 'Honey' || formData.form === 'Fruit') && formData.moistureContentPct) {
          baseData.moistureContentPct = formData.moistureContentPct;
        }
      } else if (formData.category === 'Honey') {
        baseData.sugarContentBrix = formData.sugarContentBrix ?? 80;
        baseData.moistureContentPct = formData.moistureContentPct ?? 18;
      } else if (formData.category === 'Yeast') {
        baseData.form = formData.form || 'Dry';
        baseData.tempMinC = formData.tempMinC ?? 15;
        baseData.tempMaxC = formData.tempMaxC ?? 25;
        baseData.alcoholTolerancePct = formData.alcoholTolerancePct ?? 14;
        baseData.alcoholTolerancePctMin = formData.alcoholTolerancePctMin ?? 14;
        baseData.attenuationPct = formData.attenuationPct ?? 75;
        baseData.attenuationPctMin = formData.attenuationPctMin ?? 75;
        baseData.nitrogenDemand = formData.nitrogenDemand ?? 'Medium';
      } else if (formData.category === 'Hops') {
        baseData.form = formData.form || 'Pellet';
        baseData.alphaAcidPct = formData.alphaAcidPct ?? 5;
        baseData.alphaAcidPctMin = formData.alphaAcidPctMin ?? 5;
      } else if (formData.category === 'Additive') {
        baseData.additiveType = formData.additiveType ?? 'Nutrient';
        if (formData.additiveType === 'Nutrient' && formData.nutrientRole) {
          baseData.nutrientRole = formData.nutrientRole;
        }
        if (formData.additionStage) baseData.additionStage = formData.additionStage;
        if (formData.yanValuePerGramPerLiter) baseData.yanValuePerGramPerLiter = formData.yanValuePerGramPerLiter;
        if (formData.dosagePerGramYeast) baseData.dosagePerGramYeast = formData.dosagePerGramYeast;
        if (formData.dosagePer10Liters) baseData.dosagePer10Liters = formData.dosagePer10Liters;
      } else if (formData.category === 'Water Profile') {
        baseData.calciumPpm = formData.calciumPpm || 0;
        baseData.magnesiumPpm = formData.magnesiumPpm || 0;
        baseData.sodiumPpm = formData.sodiumPpm || 0;
        baseData.sulfatePpm = formData.sulfatePpm || 0;
        baseData.chloridePpm = formData.chloridePpm || 0;
        baseData.bicarbonatePpm = formData.bicarbonatePpm || 0;
      }

      const newIng = await addCustomIngredient(baseData);
      if (!newIng?.id) {
        throw new Error('addCustomIngredient did not return a new ingredient id');
      }
      ingredientId = newIng.id;
      setFormData(prev => ({ ...prev, globalIngredientId: newIng.id }));
      onIngredientCreated?.(newIng);
    }

    await addInventoryItem(activeBrewery.id, {
      ingredientId,
      quantityOnHand: Number(stockQuantity),
      unit: stockUnit
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (saveToStock && mode === 'recipe') {
      setIsPersistingToStock(true);
      setStockError('');
      try {
        await persistToInventory();
      } catch (err) {
        console.error('Error persisting to inventory:', err);
        setIsPersistingToStock(false);
        setStockError(t('Could not save to inventory. The ingredient was still added to the recipe.'));
      }
      setIsPersistingToStock(false);
    }

    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="editor-modal-overlay" onMouseDown={onClose}>
      <div className="editor-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="editor-modal__header">
          <h2>{mode === 'inventory' ? t('Add to Inventory', 'Добавить на склад') : t('Add Ingredient', 'Добавить ингредиент')}</h2>
          <button type="button" className="editor-modal__close-btn" onClick={onClose} aria-label={t('Close')}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="editor-modal__body">
          
          <div className="form-field" style={{ marginBottom: '16px' }}>
            <label className="form-field__label">{t('Category')}</label>
            <select 
              className="form-field__select" 
              value={formData.category} 
              onChange={e => handleCategoryChange(e.target.value as IngredientCategory)}
            >
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{t(`constants.categories.${cat.toLowerCase().replace(' ', '_')}`)}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-field__label">{t('Name')}</label>
            <div className="autocomplete" ref={wrapperRef}>
              <div className="autocomplete__input-wrapper">
                <FaSearch className="autocomplete__icon" />
                <input
                  type="text"
                  className="autocomplete__input"
                  placeholder={t('Search or type custom name...')}
                  value={formData.name}
                  onChange={handleNameChange}
                  onFocus={() => setShowSuggestions(true)}
                  onClick={() => setShowSuggestions(true)}
                  required
                  autoFocus
                />
              </div>
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="autocomplete__dropdown">
                  {filteredSuggestions.map(ing => (
                    <li key={ing.id} className="autocomplete__item" onClick={() => handleSelectSuggestion(ing)}>
                      <span className="autocomplete__item-title">
                        {ing.name}
                        {ing.inStockQty > 0 && ` (${ing.inStockQty} ${t(`constants.units.${ing.inStockUnit.toLowerCase()}`)})`}
                      </span>
                      <span className="autocomplete__item-meta">
                        {formData.category === 'Hops' && `Alpha: ${(ing as any).alphaAcidPct ?? 0}% | ${(ing as any).form || ''}`}
                        {formData.category === 'Fermentable' && `Yield: ${(ing as any).yieldPpg ?? 0} PPG | Color: ${(ing as any).colorEbc ?? 0} EBC`}
                        {formData.category === 'Honey' && `Brix: ${(ing as any).sugarContentBrix ?? 0} | Moisture: ${(ing as any).moistureContentPct ?? 0}%`}
                        {formData.category === 'Yeast' && `Tolerance: ${(ing as any).alcoholTolerancePct ?? 0}% | ${(ing as any).form || ''}`}
                        {formData.category === 'Additive' && `${(ing as any).producer || ''}`}
                        {formData.category === 'Water Profile' && `${(ing as any).producer || ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="editor-modal__grid">
            <div className="form-field">
              <label className="form-field__label">{mode === 'inventory' ? t('Quantity on hand') : t('Quantity')}</label>
              <div className="form-field__group">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  className="form-field__input"
                  value={formData.quantity || ''}
                  onChange={e => handleChange('quantity', parseFloat(e.target.value) || 0)}
                  required
                />
                {mode === 'inventory' && (
                  <select className="form-field__select" value={formData.unit} onChange={e => handleChange('unit', e.target.value as UnitType)}>
                    {UNIT_TYPES.map(u => (
                      <option key={u} value={u}>{t(`constants.units.${u.toLowerCase()}`)}</option>
                    ))}
                  </select>
                )}
                {mode === 'recipe' && (
                  <span className="form-field__unit-label">{t('constants.units.g')}</span>
                )}
              </div>
            </div>

            {formData.category === 'Hops' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Form')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Pellet'} onChange={e => handleChange('form', e.target.value)}>
                    {HOPS_FORMS.map(form => (
                      <option key={form} value={form}>{t(`constants.hops_forms.${form.toLowerCase().replace(' ', '_')}`)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-field">
                    <label className="form-field__label">{t('Alpha Acid Min')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.alphaAcidPctMin ?? ''} onChange={e => handleChange('alphaAcidPctMin', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">{t('Alpha Acid Max')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.alphaAcidPct ?? ''} onChange={e => handleChange('alphaAcidPct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                {mode === 'recipe' && (
                  <div className="form-field">
                    <label className="form-field__label">{t('Boil Time')} ({t('min')})</label>
                    <input
                      type="number"
                      min="0"
                      className="form-field__input"
                      value={formData.boilTimeMinutes ?? ''}
                      onChange={e => handleChange('boilTimeMinutes', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </>
            )}

            {formData.category === 'Fermentable' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Type')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Grain'} onChange={e => handleChange('form', e.target.value)}>
                    {FERMENTABLE_TYPES.map(type => (
                      <option key={type} value={type}>{t(`constants.fermentable_types.${type.toLowerCase()}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Yield')} (PPG)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.yieldPpg ?? ''}
                    onChange={e => handleChange('yieldPpg', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Color')} (EBC)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.colorEbc ?? ''}
                    onChange={e => handleChange('colorEbc', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Diastatic Power')} (°L)</label>
                  <input
                    type="number"
                    step="1"
                    className="form-field__input"
                    value={formData.diastaticPowerLintner ?? ''}
                    onChange={e => handleChange('diastaticPowerLintner', parseFloat(e.target.value) || 0)}
                    placeholder={t('Optional')}
                  />
                </div>
                {(formData.form === 'Honey' || formData.form === 'Fruit') && (
                  <div className="form-field">
                    <label className="form-field__label">{t('Moisture')} (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-field__input"
                      value={formData.moistureContentPct ?? ''}
                      onChange={e => handleChange('moistureContentPct', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </>
            )}

            {formData.category === 'Honey' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Sugar Content')} (Brix)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.sugarContentBrix ?? ''}
                    onChange={e => handleChange('sugarContentBrix', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Moisture')} (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.moistureContentPct ?? ''}
                    onChange={e => handleChange('moistureContentPct', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Approx. Yield for OG calc')} (PPG)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.yieldPpg ?? ''}
                    onChange={e => handleChange('yieldPpg', parseFloat(e.target.value) || 0)}
                  />
                  <span className="form-field__hint">
                    {t('Approximation used only for gravity estimate; the math library has no Brix-to-gravity formula.')}
                  </span>
                </div>
              </>
            )}

            {formData.category === 'Yeast' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Form')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Dry'} onChange={e => handleChange('form', e.target.value)}>
                    {YEAST_FORMS.map(form => (
                      <option key={form} value={form}>{t(`constants.yeast_forms.${form.toLowerCase()}`)}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-field">
                    <label className="form-field__label">{t('Tolerance Min')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.alcoholTolerancePctMin ?? ''} onChange={e => handleChange('alcoholTolerancePctMin', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">{t('Tolerance Max')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.alcoholTolerancePct ?? ''} onChange={e => handleChange('alcoholTolerancePct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-field">
                    <label className="form-field__label">{t('Attenuation Min')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.attenuationPctMin ?? ''} onChange={e => handleChange('attenuationPctMin', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">{t('Attenuation Max')} (%)</label>
                    <input type="number" step="0.1" className="form-field__input" value={formData.attenuationPct ?? ''} onChange={e => handleChange('attenuationPct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Min Temp')} (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.tempMinC ?? ''}
                    onChange={e => handleChange('tempMinC', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Max Temp')} (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.tempMaxC ?? ''}
                    onChange={e => handleChange('tempMaxC', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Nitrogen Demand')}</label>
                  <select
                    className="form-field__select"
                    value={formData.nitrogenDemand ?? 'Medium'}
                    onChange={e => handleChange('nitrogenDemand', e.target.value)}
                  >
                    {NITROGEN_LEVELS.map(level => (
                      <option key={level} value={level}>{t(`constants.nitrogen_demand.${level.toLowerCase().replace(' ', '_')}`)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {formData.category === 'Additive' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Additive Type')}</label>
                  <select
                    className="form-field__select"
                    value={formData.additiveType ?? 'Nutrient'}
                    onChange={e => {
                      const val = e.target.value as AdditiveType;
                      handleChange('additiveType', val);
                      handleChange('additionStage', SUGGESTED_STAGE_BY_ADDITIVE_TYPE[val] ?? '');
                      if (val !== 'Nutrient') {
                        handleChange('nutrientRole', undefined);
                      } else {
                        handleChange('nutrientRole', 'Fermentation');
                      }
                    }}
                  >
                    {ADDITIVE_TYPES.map(type => (
                      <option key={type} value={type}>{t(`constants.additive_types.${type.toLowerCase()}`)}</option>
                    ))}
                  </select>
                </div>
                
                {formData.additiveType === 'Nutrient' && (
                  <div className="form-field">
                    <label className="form-field__label">{t('Nutrient Role', 'Назначение нутриента')}</label>
                    <select
                      className="form-field__select"
                      value={formData.nutrientRole ?? 'Fermentation'}
                      onChange={e => handleChange('nutrientRole', e.target.value as NutrientRole)}
                    >
                      <option value="Rehydration">{t('constants.nutrient_roles.rehydration', 'Для регидратации (напр. Go-Ferm)')}</option>
                      <option value="Fermentation">{t('constants.nutrient_roles.fermentation', 'Для активного брожения (напр. Fermaid, DAP)')}</option>
                      <option value="Other">{t('constants.nutrient_roles.other', 'Другое')}</option>
                    </select>
                  </div>
                )}

                {mode === 'recipe' && (
                  <div className="form-field">
                    <label className="form-field__label">{t('Addition Stage')}</label>
                    <input
                      type="text"
                      className="form-field__input"
                      value={formData.additionStage ?? ''}
                      onChange={e => handleChange('additionStage', e.target.value)}
                      placeholder={t('e.g. Boil, Secondary, Aging, Bottling')}
                    />
                  </div>
                )}
                <div className="form-field">
                  <label className="form-field__label">{t('YAN Value')} (mg N / g / L)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-field__input"
                    value={formData.yanValuePerGramPerLiter ?? ''}
                    onChange={e => handleChange('yanValuePerGramPerLiter', parseFloat(e.target.value) || 0)}
                    placeholder={t('Optional')}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Dosage per 1g Yeast')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-field__input"
                    value={formData.dosagePerGramYeast ?? ''}
                    onChange={e => handleChange('dosagePerGramYeast', parseFloat(e.target.value) || 0)}
                    placeholder={t('Optional')}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Dosage per 10L')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-field__input"
                    value={formData.dosagePer10Liters ?? ''}
                    onChange={e => handleChange('dosagePer10Liters', parseFloat(e.target.value) || 0)}
                    placeholder={t('Optional')}
                  />
                </div>
              </>
            )}

            {formData.category === 'Water Profile' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Calcium')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.calciumPpm ?? ''} onChange={e => handleChange('calciumPpm', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Magnesium')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.magnesiumPpm ?? ''} onChange={e => handleChange('magnesiumPpm', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Sodium')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.sodiumPpm ?? ''} onChange={e => handleChange('sodiumPpm', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Sulfate')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.sulfatePpm ?? ''} onChange={e => handleChange('sulfatePpm', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Chloride')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.chloridePpm ?? ''} onChange={e => handleChange('chloridePpm', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Bicarbonate')} (ppm)</label>
                  <input type="number" step="1" className="form-field__input" value={formData.bicarbonatePpm ?? ''} onChange={e => handleChange('bicarbonatePpm', parseFloat(e.target.value) || 0)} />
                </div>
              </>
            )}

            <div className="form-field">
              <label className="form-field__label">{t('Origin')}</label>
              <input
                type="text"
                className="form-field__input"
                value={formData.origin ?? ''}
                onChange={e => handleChange('origin', e.target.value)}
                placeholder={t('Optional')}
              />
            </div>
            <div className="form-field">
              <label className="form-field__label">{t('Producer')}</label>
              <input
                type="text"
                className="form-field__input"
                value={formData.producer ?? ''}
                onChange={e => handleChange('producer', e.target.value)}
                placeholder={t('Optional')}
              />
            </div>
          </div>

          <div className="form-field editor-modal__section">
            <label className="form-field__label">{t('Ingredient Description')}</label>
            <textarea
              className="form-field__textarea"
              rows={2}
              value={formData.description ?? ''}
              onChange={e => handleChange('description', e.target.value)}
              placeholder={t('General info about this ingredient...')}
            />
          </div>

          {mode === 'recipe' && (
            <div className="form-field editor-modal__section">
              <label className="form-field__label">{t('Notes / Details')}</label>
              <textarea
                className="form-field__textarea"
                rows={2}
                value={formData.note}
                onChange={e => handleChange('note', e.target.value)}
                placeholder={t('Optional notes for this recipe...')}
              />
            </div>
          )}

          {activeBrewery?.id && mode === 'recipe' && (
            <div className="form-field editor-modal__section editor-modal__section--bordered">
              <label className="form-field__label form-field__label--checkbox">
                <input type="checkbox" checked={saveToStock} onChange={e => setSaveToStock(e.target.checked)} />
                {t('Also add to inventory stock')}
              </label>

              {saveToStock && (
                <div className="editor-modal__grid editor-modal__grid--stock">
                  <div className="form-field">
                    <label className="form-field__label">{t('Quantity on hand')}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-field__input"
                      value={stockQuantity}
                      onChange={e => setStockQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      required={saveToStock}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label">{t('Unit')}</label>
                    <select className="form-field__select" value={stockUnit} onChange={e => setStockUnit(e.target.value as UnitType)}>
                      {UNIT_TYPES.map(u => (
                        <option key={u} value={u}>{t(`constants.units.${u.toLowerCase()}`)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {stockError && (
                <p className="form-field__error">{stockError}</p>
              )}
            </div>
          )}

          <div className="editor-modal__footer">
            <button type="button" className="editor-modal__close-btn" onClick={onClose} style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent' }}>{t('Cancel')}</button>
            <button type="submit" style={{ padding: '8px 16px', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }} disabled={isPersistingToStock}>
              {isPersistingToStock
                ? t('Saving...')
                : mode === 'inventory'
                  ? t('Add to Inventory', 'Добавить на склад')
                  : saveToStock
                    ? t('Save to Recipe & Stock')
                    : t('Save to Recipe')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};