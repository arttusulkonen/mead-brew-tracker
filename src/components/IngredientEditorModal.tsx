// src/components/IngredientEditorModal.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import type { AdditiveType, BaseIngredient, IngredientCategory, UnitType } from '../types/ingredient';
import { ADDITIVE_TYPES, UNIT_TYPES } from '../types/ingredient';

export interface EditedIngredientData {
  globalIngredientId: string | null;
  name: string;
  category: IngredientCategory;
  quantity: number;
  note: string; // заметка к ЭТОМУ рецепту (не путать с описанием самого ингредиента)

  // --- Универсальные поля каталога (есть у любой категории) ---
  form?: string;
  origin?: string;
  producer?: string;
  description?: string; // общее описание ингредиента (то, что в каталоге называется "notes")

  // --- Fermentable ---
  yieldPpg?: number;
  colorEbc?: number;
  moistureContentPct?: number; // только для Honey/Fruit
  diastaticPowerLintner?: number; // ферментативная сила солода (°Lintner), справочное поле

  // --- Honey (отдельная категория верхнего уровня, не Fermentable) ---
  sugarContentBrix?: number;
  // moistureContentPct у мёда обязателен по типу HoneyIngredient — используем то же поле, что у Fermentable

  // --- Hops ---
  alphaAcidPct?: number;
  boilTimeMinutes?: number; // чисто рецептурное поле, в каталог/инвентарь не уходит

  // --- Yeast ---
  alcoholTolerancePct?: number;
  attenuationPct?: number;
  tempMinC?: number;
  tempMaxC?: number;
  nitrogenDemand?: 'Low' | 'Medium' | 'High' | 'Very High';

  // --- Additive ---
  additiveType?: AdditiveType; // Nutrient | Spice | Fruit | Clarifier | Stabilizer | Acid
  additionStage?: string; // когда вносится: Boil/Whirlpool, Secondary, Aging, Bottling... (решение для ЭТОГО рецепта, не свойство вещества)
  yanValuePerGramPerLiter?: number; // научный показатель YAN, если он известен для конкретного нутриента
  dosagePerGramYeast?: number;
  dosagePer10Liters?: number;

  // --- Water Profile (ppm) ---
  calciumPpm?: number;
  magnesiumPpm?: number;
  sodiumPpm?: number;
  sulfatePpm?: number;
  chloridePpm?: number;
  bicarbonatePpm?: number;
}

interface IngredientEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EditedIngredientData) => void;
  catalog: BaseIngredient[];
  category: IngredientCategory;
  /** Префилл поля "Название", когда модалка открывается из блока подсказок (Suggested for style) */
  initialQuery?: string;
  /**
   * Префилл типа добавки (значение из ADDITIVE_TYPES, например 'Fruit'/'Spice'),
   * когда модалка открывается из подсказки Smart Recipe Wizard для мёда.
   */
  initialAdditiveType?: string;
  /**
   * Вызывается после успешного создания нового кастомного ингредиента через
   * кнопку "Сохранить на склад". Recipes.tsx может подписаться на это, чтобы
   * добавить ингредиент в свой локальный globalCatalog без перезагрузки страницы
   * (он хранится отдельно от useInventoryStore().globalIngredients).
   */
  onIngredientCreated?: (ingredient: any) => void;
}

const NITROGEN_LEVELS: Array<NonNullable<EditedIngredientData['nitrogenDemand']>> = ['Low', 'Medium', 'High', 'Very High'];
const HOPS_FORMS = ['Pellet', 'Whole', 'Extract'];
const YEAST_FORMS = ['Dry', 'Liquid'];
const FERMENTABLE_TYPES = ['Grain', 'Extract', 'Sugar', 'Honey', 'Fruit'];

// Типичный этап внесения для каждого типа добавки - просто подсказка по
// умолчанию, которую можно поправить вручную в поле "Этап внесения".
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
  onIngredientCreated
}) => {
  const { t } = useTranslation();
  const { activeBrewery } = useBreweryStore();
  const { addCustomIngredient, addInventoryItem } = useInventoryStore();

  const validInitialAdditiveType = (ADDITIVE_TYPES as readonly string[]).includes(initialAdditiveType)
    ? (initialAdditiveType as AdditiveType)
    : undefined;

  const buildDefaults = (): EditedIngredientData => ({
    globalIngredientId: null,
    name: initialQuery,
    category,
    quantity: 0,
    note: '',
    origin: '',
    producer: '',
    description: '',
    ...(category === 'Hops' ? { form: 'Pellet', alphaAcidPct: 5, boilTimeMinutes: 60 } : {}),
    ...(category === 'Fermentable' ? { form: 'Grain', yieldPpg: 36, colorEbc: 5 } : {}),
    // У мёда нет yieldPpg/colorEbc в каталоге (там Brix), но estimateOG() в
    // Recipes.tsx считает гравитацию через yieldPpg для ЛЮБОЙ категории, не
    // только Fermentable - поэтому держим тут и "официальные" поля HoneyIngredient,
    // и yieldPpg как приблизительный эквивалент для расчёта OG (по умолчанию
    // ~36 PPG - стандартная домашняя оценка для мёда).
    ...(category === 'Honey' ? { sugarContentBrix: 80, moistureContentPct: 18, yieldPpg: 36 } : {}),
    ...(category === 'Yeast'
      ? { form: 'Dry', alcoholTolerancePct: 12, attenuationPct: 75, tempMinC: 15, tempMaxC: 25, nitrogenDemand: 'Medium' as const }
      : {}),
    ...(category === 'Additive'
      ? {
          additiveType: validInitialAdditiveType || 'Nutrient',
          additionStage: validInitialAdditiveType ? SUGGESTED_STAGE_BY_ADDITIVE_TYPE[validInitialAdditiveType] || '' : ''
        }
      : {}),
    ...(category === 'Water Profile'
      ? { calciumPpm: 0, magnesiumPpm: 0, sodiumPpm: 0, sulfatePpm: 0, chloridePpm: 0, bicarbonatePpm: 0 }
      : {})
  });

  const [formData, setFormData] = useState<EditedIngredientData>(buildDefaults());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Доп. сохранение остатка на склад
  const [saveToStock, setSaveToStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [stockUnit, setStockUnit] = useState<UnitType>('kg');
  const [isPersistingToStock, setIsPersistingToStock] = useState(false);
  const [stockError, setStockError] = useState<string>('');

  // Сброс формы при открытии / смене категории / смене префилла
  useEffect(() => {
    if (isOpen) {
      setFormData(buildDefaults());
      setShowSuggestions(!!initialQuery);
      setSaveToStock(false);
      setStockQuantity('');
      setStockUnit('kg');
      setStockError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, category, initialQuery, initialAdditiveType]);

  // Закрытие автокомплита по клику вне
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // Список вариантов для автокомплита: если поле пустое - показываем ВЕСЬ
  // каталог этой категории (чтобы можно было просто пролистать и выбрать),
  // если что-то введено - фильтруем по названию.
  const filteredSuggestions = useMemo(() => {
    const categoryMatches = catalog.filter(ing => ing.category === category);
    if (!formData.name) return categoryMatches.slice(0, 100);
    return categoryMatches
      .filter(ing => ing.name.toLowerCase().includes(formData.name.toLowerCase()))
      .slice(0, 100);
  }, [catalog, category, formData.name]);

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
      alcoholTolerancePct: ing.alcoholTolerancePct ?? prev.alcoholTolerancePct,
      attenuationPct: ing.attenuationPct ?? prev.attenuationPct,
      tempMinC: ing.tempMinC ?? prev.tempMinC,
      tempMaxC: ing.tempMaxC ?? prev.tempMaxC,
      nitrogenDemand: ing.nitrogenDemand ?? prev.nitrogenDemand,
      additiveType: ing.additiveType ?? prev.additiveType,
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
    handleChange('globalIngredientId', null); // ручной ввод названия -> отвязываем от каталога
    setShowSuggestions(true);
  };

  // Создаёт (если нужно) кастомный ингредиент в общем каталоге и добавляет
  // остаток на склад активной пивоварни. Зеркалит логику из Inventory.tsx.
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
        baseData.attenuationPct = formData.attenuationPct ?? 75;
        baseData.nitrogenDemand = formData.nitrogenDemand ?? 'Medium';
      } else if (formData.category === 'Hops') {
        baseData.form = formData.form || 'Pellet';
        baseData.alphaAcidPct = formData.alphaAcidPct ?? 5;
      } else if (formData.category === 'Additive') {
        baseData.additiveType = formData.additiveType ?? 'Nutrient';
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

    if (saveToStock) {
      setIsPersistingToStock(true);
      setStockError('');
      try {
        await persistToInventory();
      } catch (err) {
        console.error('Failed to save ingredient to inventory', err);
        setIsPersistingToStock(false);
        setStockError(t('Could not save to inventory. The ingredient was still added to the recipe.', 'Не удалось сохранить на склад. Ингредиент всё равно добавлен в рецепт.'));
        // Не блокируем добавление в рецепт из-за сбоя сохранения на склад
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
          <h2>{t('Add')} {t(`constants.categories.${category.toLowerCase().replace(' ', '_')}`, category)}</h2>
          <button type="button" className="editor-modal__close-btn" onClick={onClose} aria-label={t('Close')}>
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="editor-modal__body">
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
                      <span className="autocomplete__item-title">{ing.name}</span>
                      <span className="autocomplete__item-meta">
                        {category === 'Hops' && `Alpha: ${(ing as any).alphaAcidPct ?? 0}% | ${(ing as any).form || ''}`}
                        {category === 'Fermentable' && `Yield: ${(ing as any).yieldPpg ?? 0} PPG | Color: ${(ing as any).colorEbc ?? 0} EBC`}
                        {category === 'Honey' && `Brix: ${(ing as any).sugarContentBrix ?? 0} | Moisture: ${(ing as any).moistureContentPct ?? 0}%`}
                        {category === 'Yeast' && `Tolerance: ${(ing as any).alcoholTolerancePct ?? 0}% | ${(ing as any).form || ''}`}
                        {category === 'Additive' && `${(ing as any).producer || ''}`}
                        {category === 'Water Profile' && `${(ing as any).producer || ''}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="editor-modal__grid">
            <div className="form-field">
              <label className="form-field__label">{t('Quantity')} ({t('g')})</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="form-field__input"
                value={formData.quantity || ''}
                onChange={e => handleChange('quantity', parseFloat(e.target.value) || 0)}
                required
              />
            </div>

            {category === 'Hops' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Form')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Pellet'} onChange={e => handleChange('form', e.target.value)}>
                    {HOPS_FORMS.map(form => (
                      <option key={form} value={form}>{t(`constants.hops_forms.${form.toLowerCase()}`, form)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Alpha Acid')} (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.alphaAcidPct ?? ''}
                    onChange={e => handleChange('alphaAcidPct', parseFloat(e.target.value) || 0)}
                  />
                </div>
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
              </>
            )}

            {category === 'Fermentable' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Type')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Grain'} onChange={e => handleChange('form', e.target.value)}>
                    {FERMENTABLE_TYPES.map(type => (
                      <option key={type} value={type}>{t(`constants.fermentable_types.${type.toLowerCase()}`, type)}</option>
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
                  <label className="form-field__label">{t('Diastatic Power', 'Диастатическая сила')} (°L)</label>
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

            {category === 'Honey' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Sugar Content', 'Сахаристость')} (Brix)</label>
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
                  <label className="form-field__label">{t('Approx. Yield for OG calc', 'Прибл. Yield для расчёта OG')} (PPG)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.yieldPpg ?? ''}
                    onChange={e => handleChange('yieldPpg', parseFloat(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {t(
                      'Approximation used only for gravity estimate; the math library has no Brix-to-gravity formula.',
                      'Приближение только для расчёта плотности — в библиотеке расчётов нет формулы Brix→плотность.'
                    )}
                  </span>
                </div>
              </>
            )}

            {category === 'Yeast' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Form')}</label>
                  <select className="form-field__select" value={formData.form ?? 'Dry'} onChange={e => handleChange('form', e.target.value)}>
                    {YEAST_FORMS.map(form => (
                      <option key={form} value={form}>{t(`constants.yeast_forms.${form.toLowerCase()}`, form)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Tolerance')} (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.alcoholTolerancePct ?? ''}
                    onChange={e => handleChange('alcoholTolerancePct', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Attenuation')} (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="form-field__input"
                    value={formData.attenuationPct ?? ''}
                    onChange={e => handleChange('attenuationPct', parseFloat(e.target.value) || 0)}
                  />
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
                      <option key={level} value={level}>{t(`constants.nitrogen_demand.${level.toLowerCase().replace(' ', '_')}`, level)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {category === 'Additive' && (
              <>
                <div className="form-field">
                  <label className="form-field__label">{t('Additive Type')}</label>
                  <select
                    className="form-field__select"
                    value={formData.additiveType ?? 'Nutrient'}
                    onChange={e => {
                      const val = e.target.value as AdditiveType;
                      handleChange('additiveType', val);
                      // Подставляем типичный этап внесения для выбранного типа,
                      // его можно поправить вручную.
                      handleChange('additionStage', SUGGESTED_STAGE_BY_ADDITIVE_TYPE[val] ?? '');
                    }}
                  >
                    {ADDITIVE_TYPES.map(type => (
                      <option key={type} value={type}>{t(`constants.additive_types.${type.toLowerCase()}`, type)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('Addition Stage', 'Этап внесения')}</label>
                  <input
                    type="text"
                    className="form-field__input"
                    value={formData.additionStage ?? ''}
                    onChange={e => handleChange('additionStage', e.target.value)}
                    placeholder={t('e.g. Boil, Secondary, Aging, Bottling', 'напр. Варка, Вторичная, Созревание, Розлив')}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label">{t('YAN Value', 'Значение YAN')} (мг N / г / л)</label>
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

            {category === 'Water Profile' && (
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

          <div className="form-field" style={{ marginTop: '1rem' }}>
            <label className="form-field__label">{t('Ingredient Description', 'Описание ингредиента')}</label>
            <textarea
              className="form-field__textarea"
              rows={2}
              value={formData.description ?? ''}
              onChange={e => handleChange('description', e.target.value)}
              placeholder={t('General info about this ingredient...', 'Общая информация об этом ингредиенте...')}
            />
          </div>

          <div className="form-field" style={{ marginTop: '0.75rem' }}>
            <label className="form-field__label">{t('Notes / Details')}</label>
            <textarea
              className="form-field__textarea"
              rows={2}
              value={formData.note}
              onChange={e => handleChange('note', e.target.value)}
              placeholder={t('Optional notes for this recipe...')}
            />
          </div>

          {activeBrewery?.id && (
            <div className="form-field" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <label className="form-field__label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={saveToStock} onChange={e => setSaveToStock(e.target.checked)} />
                {t('Also add to inventory stock', 'Также сохранить на склад')}
              </label>

              {saveToStock && (
                <div className="editor-modal__grid" style={{ marginTop: '0.75rem' }}>
                  <div className="form-field">
                    <label className="form-field__label">{t('Quantity on hand', 'Количество на складе')}</label>
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
                        <option key={u} value={u}>{t(`constants.units.${u.toLowerCase()}`, u)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {stockError && (
                <p style={{ color: 'var(--color-danger, #d9534f)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{stockError}</p>
              )}
            </div>
          )}

          <div className="editor-modal__footer">
            <button type="button" className="recipe-lab__btn-secondary" onClick={onClose}>{t('Cancel')}</button>
            <button type="submit" className="recipe-lab__btn-primary" disabled={isPersistingToStock}>
              {isPersistingToStock
                ? t('Saving...')
                : saveToStock
                  ? t('Save to Recipe & Stock', 'Сохранить в рецепт и на склад')
                  : t('Save to Recipe')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};