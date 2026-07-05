// src/components/recipe-components/BrewingStepsEditor.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaChevronDown, FaChevronUp, FaMagic, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import type { StepPhase, TimeUnit } from '../../types/recipe';
import type { RecipeStepEntry } from './types';

const VALID_PHASES: StepPhase[] = ['Preparation', 'Mashing', 'Boiling', 'Fermentation', 'Aging', 'Packaging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

interface BrewingStepsEditorProps {
  recipeSteps: RecipeStepEntry[];
  aiProposedSteps: RecipeStepEntry[];
  isSaving: boolean;
  onAddStep: (phase?: StepPhase) => void;
  onRemoveStep: (id: string) => void;
  onUpdateStep: (id: string, updates: Partial<RecipeStepEntry>) => void;
  onAcceptAllAiSteps: () => void;
  onRejectAllAiSteps: () => void;
  setAiProposedSteps: React.Dispatch<React.SetStateAction<RecipeStepEntry[]>>;
}

export const BrewingStepsEditor: React.FC<BrewingStepsEditorProps> = ({
  recipeSteps,
  aiProposedSteps,
  isSaving,
  onAddStep,
  onRemoveStep,
  onUpdateStep,
  onAcceptAllAiSteps,
  onRejectAllAiSteps,
  setAiProposedSteps
}) => {
  const { t } = useTranslation();

  return (
    <>
      {aiProposedSteps.length > 0 && (
        <section className="builder-section ai-proposed-steps-container">
          <div className="ai-container-header">
            <h3><FaMagic /> {t('AI Generated Steps Review')}</h3>
            <div className="header-actions">
              <button type="button" className="btn-accept" onClick={onAcceptAllAiSteps}>
                <FaCheck /> {t('Accept All Steps')}
              </button>
              <button type="button" className="btn-reject" onClick={onRejectAllAiSteps}>
                <FaTimes /> {t('Reject AI Steps')}
              </button>
            </div>
          </div>
          <div className="step-list">
            {aiProposedSteps.map((step) => (
              <div key={step.id} className="step-item">
                <div className="step-item__header">
                  <div className="step-item__header-left">
                    <span className="step-item__number">{step.stepNumber}</span>
                    <span className="btn-badge">
                      {t(`constants.step_phases.${step.phase.toLowerCase()}`, step.phase)}
                    </span>
                  </div>
                  <div className='step-item__buttons'>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => setAiProposedSteps(prev => prev.map(s => s.id === step.id ? { ...s, isExpanded: !s.isExpanded } : s))}
                    >
                      {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                  </div>
                </div>
                {step.isExpanded && (
                  <div className="step-item__body">
                    <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{step.title}</div>
                    <p style={{margin: '0', color: 'var(--text-secondary)'}}>{step.description}</p>
                    <div className="builder-row text-sm text-muted">
                      <div>⏱ {step.durationValue} {t(`constants.units.${step.durationUnit.toLowerCase()}`, step.durationUnit)}</div>
                      {step.targetTempC && <div>🌡 {step.targetTempC} °C</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="builder-section">
        <div className="builder-section__header">
          <h2 className="builder-section__title">{t('Current Brewing Steps')}</h2>
        </div>
        <div className="builder-section__body">
          <div className="step-list">
            {recipeSteps.map((step) => (
              <div key={step.id} className="step-item">
                <div className="step-item__header">
                  <div className="step-item__header-left">
                    <span className="step-item__number">{step.stepNumber}</span>
                    <select
                      className="form-field__select form-field__select--small"
                      value={step.phase}
                      onChange={(e) => onUpdateStep(step.id, { phase: e.target.value as StepPhase })}
                      disabled={isSaving}
                    >
                      {VALID_PHASES.map(phase => (
                        <option key={phase} value={phase}>{t(`constants.step_phases.${phase.toLowerCase()}`, phase)}</option>
                      ))}
                    </select>
                  </div>
                  <div className='step-item__buttons'>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => onUpdateStep(step.id, { isExpanded: !step.isExpanded })}
                    >
                      {step.isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => onRemoveStep(step.id)}
                      disabled={isSaving}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                {step.isExpanded && (
                  <div className="step-item__body">
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => onUpdateStep(step.id, { title: e.target.value })}
                      placeholder={t('Step Title')}
                      className="form-field__input"
                      disabled={isSaving}
                    />
                    <textarea
                      value={step.description}
                      onChange={(e) => onUpdateStep(step.id, { description: e.target.value })}
                      placeholder={t('Detailed instructions...')}
                      className="form-field__textarea"
                      rows={3}
                      disabled={isSaving}
                    />

                    <div className="builder-row">
                      <div className="form-field builder-row__item">
                        <label className="form-field__label">{t('Duration')}</label>
                        <div className="builder-row" style={{gap: '4px'}}>
                          <input
                            className="form-field__input builder-row__item"
                            type="number"
                            min="0"
                            value={step.durationValue === 0 ? '' : step.durationValue}
                            onChange={(e) => onUpdateStep(step.id, { durationValue: parseFloat(e.target.value) || 0 })}
                            disabled={isSaving}
                          />
                          <select
                            className="form-field__select builder-row__item"
                            value={step.durationUnit}
                            onChange={(e) => onUpdateStep(step.id, { durationUnit: e.target.value as TimeUnit })}
                            disabled={isSaving}
                          >
                            {VALID_UNITS.map(unit => (
                              <option key={unit} value={unit}>{t(`constants.units.${unit.toLowerCase()}`, unit)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="form-field builder-row__item">
                        <label className="form-field__label">{t('Target Temp (°C)')}</label>
                        <input
                          className="form-field__input"
                          type="number"
                          value={step.targetTempC ?? ''}
                          onChange={(e) => onUpdateStep(step.id, { targetTempC: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          placeholder={t('Optional')}
                          disabled={isSaving}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{marginTop: '1rem'}}>
              <button type="button" className="btn-secondary btn-secondary--full" onClick={() => onAddStep('Preparation')} disabled={isSaving}>
                <FaPlus /> {t('Add Manual Step')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};