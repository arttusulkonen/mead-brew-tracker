// src/components/recipe-components/MeadWizardSection.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle, FaMagic, FaShieldAlt, FaSnowflake } from 'react-icons/fa'; // ДОБАВИЛИ FaSnowflake
import type { AdditiveType, BaseIngredient, IngredientCategory } from '../../types/ingredient';
import { HONEY_TERROIR, MEAD_STYLES, SWEETNESS_LEVELS } from '../../utils/meadConstants';

interface MeadWizardSectionProps {
  wizardStyle: string;
  setWizardStyle: (v: string) => void;
  wizardSweetness: string;
  setWizardSweetness: (v: string) => void;
  setTargetFg: (v: number) => void;
  wizardHoney: string;
  setWizardHoney: (v: string) => void;
  isSafeBacksweetening: boolean; 
  setIsSafeBacksweetening: (v: boolean) => void;
  isColdCrashEnabled: boolean; // НОВЫЙ ПРОПС
  setIsColdCrashEnabled: (v: boolean) => void; // НОВЫЙ ПРОПС
  meadIngredientHint: { category: IngredientCategory; additiveType?: AdditiveType; label: string } | null;
  meadYeastSuggestions: BaseIngredient[];
  openIngredientModal: (category: IngredientCategory, search?: string, additiveType?: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const MeadWizardSection: React.FC<MeadWizardSectionProps> = ({
  wizardStyle, setWizardStyle,
  wizardSweetness, setWizardSweetness, setTargetFg,
  wizardHoney, setWizardHoney,
  isSafeBacksweetening, setIsSafeBacksweetening, 
  isColdCrashEnabled, setIsColdCrashEnabled, // ПРИНИМАЕМ
  meadIngredientHint,
  meadYeastSuggestions,
  openIngredientModal,
  isGenerating,
  onGenerate
}) => {
  const { t } = useTranslation();

  const handleSweetnessChange = (newSweetnessId: string) => {
    setWizardSweetness(newSweetnessId);
    
    if (isSafeBacksweetening) {
      setTargetFg(1.000);
    } else {
      const selected = (SWEETNESS_LEVELS || []).find(lvl => lvl.id === newSweetnessId);
      if (selected) {
        setTargetFg(selected.minFg);
      }
    }
  };

  const toggleSafeMode = () => {
    const newValue = !isSafeBacksweetening;
    setIsSafeBacksweetening(newValue);
    
    if (newValue) {
      setTargetFg(1.000);
    } else {
      const selected = (SWEETNESS_LEVELS || []).find(lvl => lvl.id === wizardSweetness);
      if (selected) {
        setTargetFg(selected.minFg);
      }
    }
  };

  return (
    <section className="builder-section">
      <div className="builder-section__header">
        <h2 className="builder-section__title"><FaMagic /> {t('Smart Recipe Wizard')}</h2>
      </div>
      <div className="builder-section__body">
        
        {/* Safe Backsweetening Toggle */}
        <div className="form-field builder-row__item" style={{ marginBottom: '12px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label className="form-field__label form-field__label--checkbox" style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
            <input 
              type="checkbox" 
              checked={isSafeBacksweetening} 
              onChange={toggleSafeMode} 
              style={{ width: '18px', height: '18px' }}
            />
            <FaShieldAlt style={{ color: isSafeBacksweetening ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
            {t('Homebrew Mode: Safe Backsweetening (Erythritol Hack)', 'Домашняя варка: Безопасное подслащивание (Эритрит)')}
          </label>
          <p className="form-field__hint" style={{ marginTop: '8px', marginLeft: '26px' }}>
            {isSafeBacksweetening 
              ? t('Ferments completely dry (FG 1.000) to prevent bottle bombs. AI will add Erythritol for sweetness.', 'Сбраживается насухо (FG 1.000) для защиты от взрыва бутылок. ИИ сам добавит Эритрит для сладости.')
              : t('Commercial mode. Fermentation will be stopped at target FG. Requires pasteurization or chemical stabilization.', 'Коммерческий режим. Остановка брожения на целевой FG. Требует пастеризации или химии.')}
          </p>
        </div>

        {/* НОВЫЙ БЛОК: Cold Crash Toggle */}
        <div className="form-field builder-row__item" style={{ marginBottom: '16px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <label className="form-field__label form-field__label--checkbox" style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
            <input 
              type="checkbox" 
              checked={isColdCrashEnabled} 
              onChange={() => setIsColdCrashEnabled(!isColdCrashEnabled)} 
              style={{ width: '18px', height: '18px' }}
            />
            <FaSnowflake style={{ color: isColdCrashEnabled ? 'var(--color-primary)' : 'var(--text-secondary)' }} />
            {t('Cold Crash (Fast Clarification)', 'Быстрое осветление (Cold Crash)')}
          </label>
          <p className="form-field__hint" style={{ marginTop: '8px', marginLeft: '26px' }}>
            {isColdCrashEnabled 
              ? t('AI will include a 3-day refrigeration step at 2-4°C to quickly drop the yeast out of suspension.', 'ИИ добавит шаг охлаждения (2-4°C на 3 дня), чтобы дрожжи быстро выпали в осадок.')
              : t('No refrigeration. Mead will clarify naturally at room temperature over several weeks.', 'Без принудительного охлаждения. Медовуха будет осветляться естественным путем при комнатной температуре.')}
          </p>
        </div>

        <div className="builder-row">
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Base Style')}</label>
            <select className="form-field__select" value={wizardStyle || ''} onChange={e => setWizardStyle(e.target.value)}>
              {(MEAD_STYLES || []).map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
          <div className="form-field builder-row__item">
            <label className="form-field__label">
              {t('Perceived Sweetness', 'Желаемая сладость')}
            </label>
            <select className="form-field__select" value={wizardSweetness || ''} onChange={e => handleSweetnessChange(e.target.value)}>
              {(SWEETNESS_LEVELS || []).map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
          <div className="form-field builder-row__item">
            <label className="form-field__label">{t('Honey Terroir')}</label>
            <select className="form-field__select" value={wizardHoney || ''} onChange={e => setWizardHoney(e.target.value)}>
              {(HONEY_TERROIR || []).map(s => <option key={s.id} value={s.id}>{t(s.name, s.name)}</option>)}
            </select>
          </div>
        </div>

        {(meadIngredientHint || (meadYeastSuggestions || []).length > 0) && (
          <div className="suggestions-box mt-md">
            {meadIngredientHint && (
              <div className="suggestions-box__group">
                <h4><FaInfoCircle /> {t('Typically used for this mead style', 'Обычно используют для этого стиля мёда')}</h4>
                <button
                  type="button"
                  className="suggestion-tag"
                  onClick={() => openIngredientModal(meadIngredientHint.category, '', meadIngredientHint.additiveType || '')}
                >
                  {meadIngredientHint.label}
                </button>
              </div>
            )}
            {(meadYeastSuggestions || []).length > 0 && (
              <div className="suggestions-box__group">
                <h4>{t('Suggested Yeasts for this ABV tier', 'Подходящие дрожжи для этого уровня ABV')}</h4>
                {(meadYeastSuggestions || []).map(y => (
                  <button type="button" key={y.id} className="suggestion-tag" onClick={() => openIngredientModal('Yeast', y.name)}>{y.name}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className="btn-secondary btn-secondary--full mt-md"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          <FaMagic /> {isGenerating ? t('AI is thinking...') : t('Generate / Review Steps with AI')}
        </button>
      </div>
    </section>
  );
};