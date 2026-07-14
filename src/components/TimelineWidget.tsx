import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCommentDots, FaEdit, FaGripLines, FaPause, FaPlay, FaPlus, FaSave, FaTrash } from 'react-icons/fa';
import { useSessionStore } from '../store/useSessionStore';
import type { StepPhase, TimeUnit } from '../types/recipe';
import type { BrewLog } from '../types/session';
import { ActiveTimer } from './ActiveTimer';

interface TimelineWidgetProps {
  breweryId: string | null | undefined;
  sessionId: string;
  steps: any[];
  startDate: string;
}

const VALID_PHASES: StepPhase[] = ['Preparation', 'Mashing', 'Boiling', 'Fermentation', 'Conditioning', 'Packaging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

export const TimelineWidget: React.FC<TimelineWidgetProps> = ({ breweryId, sessionId, steps, startDate }) => {
  const { t } = useTranslation();
  const { updateSteps, addLogToSession } = useSessionStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepData, setEditStepData] = useState<any | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [quickNoteInputs, setQuickNoteInputs] = useState<Record<string, string>>({});

  const saveSteps = async (newSteps: any[]) => {
    await updateSteps(breweryId, sessionId, newSteps);
  };

  const handleDragStart = (index: number) => {
    if (editingStepId) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index || editingStepId) return;
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, movedStep);
    
    const reorderedSteps = newSteps.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    await saveSteps(reorderedSteps);
    setDraggedIndex(null);
  };

  const toggleStepTimer = async (stepId: string) => {
    const now = new Date().toISOString();
    const updatedSteps = steps.map(s => {
      if (s.id === stepId) {
        if (s.isActive) {
          const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
          return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
        } else {
          return { ...s, isActive: true, startedAt: now };
        }
      } else if (s.isActive) {
        const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
        return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
      }
      return s;
    });
    await saveSteps(updatedSteps);
  };

  const completeStep = async (stepId: string) => {
    const now = new Date().toISOString();
    const updatedSteps = steps.map(s => {
      if (s.id === stepId) {
        let finalSeconds = s.accumulatedSeconds || 0;
        if (s.isActive && s.startedAt) {
          finalSeconds += Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
        }
        return { 
          ...s, 
          isCompleted: true, 
          isActive: false,
          startedAt: null,
          accumulatedSeconds: finalSeconds,
          actualDurationSeconds: finalSeconds 
        };
      }
      return s;
    });
    await saveSteps(updatedSteps);
  };

  const addManualStep = () => {
    const newId = crypto.randomUUID();
    const newStep = {
      id: newId,
      stepNumber: steps.length + 1,
      phase: 'Preparation' as StepPhase,
      title: '',
      description: '',
      durationValue: 0,
      durationUnit: 'minutes' as TimeUnit,
      targetTempC: null,
      isCompleted: false,
      isActive: false,
      startedAt: null,
      accumulatedSeconds: 0
    };
    
    setEditStepData(newStep);
    setEditingStepId(newId);
    setIsNewStep(true);
  };

  const startEditStep = (step: any) => {
    setEditStepData({ ...step });
    setEditingStepId(step.id);
    setIsNewStep(false);
  };

  const cancelEditStep = () => {
    setEditingStepId(null);
    setEditStepData(null);
    setIsNewStep(false);
  };

  const saveEditedStep = async () => {
    if (!editStepData) return;
    let updatedSteps;
    if (isNewStep) {
      updatedSteps = [...steps, editStepData];
    } else {
      updatedSteps = steps.map(s => s.id === editingStepId ? editStepData : s);
    }
    await saveSteps(updatedSteps);
    setEditingStepId(null);
    setEditStepData(null);
    setIsNewStep(false);
  };

  const deleteStep = async (stepId: string) => {
    if (!window.confirm(t('Are you sure you want to delete this step?'))) return;
    const updatedSteps = steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    await saveSteps(updatedSteps);
  };

  const handleQuickNoteSubmit = async (stepId: string) => {
    const note = quickNoteInputs[stepId];
    if (!note || !note.trim()) return;

    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const dayNumber = Math.max(1, Math.floor(diffTime / 86400000) + 1);

    const newLog: BrewLog = {
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      dayNumber,
      sg: null,
      ph: null,
      tempC: null,
      notes: note.trim(),
      actionTaken: '',
      stepId: stepId
    };

    await addLogToSession(breweryId, sessionId, newLog);
    setQuickNoteInputs(prev => ({ ...prev, [stepId]: '' }));
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return (
    <div className="timeline-widget">
      <div className="timeline-widget__header">
        <h3 className="timeline-widget__title">{t('Brewing Timeline')}</h3>
        <button type="button" className="timeline-widget__btn-add" onClick={addManualStep} disabled={!!editingStepId}>
          <FaPlus /> {t('Add Step')}
        </button>
      </div>
      
      <div className="timeline-widget__list">
        {isNewStep && editStepData && editingStepId === editStepData.id && (
          <div className="timeline-item timeline-item--editing">
             <div className="timeline-edit-form">
                <input 
                  className="timeline-edit-form__input timeline-edit-form__input--title" 
                  type="text" 
                  value={editStepData.title} 
                  onChange={e => setEditStepData({...editStepData, title: e.target.value})} 
                  placeholder={t('Step Title')} 
                />
                <select 
                  className="timeline-edit-form__select" 
                  value={editStepData.phase} 
                  onChange={e => setEditStepData({...editStepData, phase: e.target.value})}
                >
                  {VALID_PHASES.map(phase => (
                    <option key={phase} value={phase}>
                      {t(`constants.step_phases.${phase.toLowerCase()}`, phase)}
                    </option>
                  ))}
                </select>
                <textarea 
                  className="timeline-edit-form__textarea" 
                  value={editStepData.description} 
                  onChange={e => setEditStepData({...editStepData, description: e.target.value})} 
                  placeholder={t('Detailed instructions...')} 
                  rows={3} 
                />
                <div className="timeline-edit-form__row">
                  <div className="timeline-edit-form__group">
                    <label className="timeline-edit-form__label">{t('Duration')}</label>
                    <div className="timeline-edit-form__duration">
                      <input 
                        className="timeline-edit-form__input"
                        type="number" 
                        min="0" 
                        value={editStepData.durationValue} 
                        onChange={e => setEditStepData({...editStepData, durationValue: parseFloat(e.target.value) || 0})} 
                      />
                      <select 
                        className="timeline-edit-form__select" 
                        value={editStepData.durationUnit} 
                        onChange={e => setEditStepData({...editStepData, durationUnit: e.target.value})}
                      >
                        {VALID_UNITS.map(unit => (
                           <option key={unit} value={unit}>
                             {t(`constants.units.${unit.toLowerCase()}`, unit)}
                           </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="timeline-edit-form__group">
                    <label className="timeline-edit-form__label">{t('Target Temp (°C)')}</label>
                    <input 
                      className="timeline-edit-form__input"
                      type="number" 
                      value={editStepData.targetTempC ?? ''} 
                      onChange={e => setEditStepData({...editStepData, targetTempC: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                      placeholder={t('Optional')} 
                    />
                  </div>
                </div>
                <div className="timeline-edit-form__actions">
                  <button type="button" className="timeline-edit-form__btn-save" onClick={saveEditedStep} disabled={!editStepData.title}>
                    <FaSave /> {t('Save')}
                  </button>
                  <button type="button" className="timeline-edit-form__btn-cancel" onClick={cancelEditStep}>
                    {t('Cancel')}
                  </button>
                </div>
              </div>
          </div>
        )}

        {steps.map((step, index) => {
          const isActive = step.isActive;
          const isCompleted = step.isCompleted;
          const isEditing = editingStepId === step.id && !isNewStep;
          
          let targetText = '';
          if (step.durationValue > 0) {
            targetText = `${step.durationValue} ${t(`constants.units.${step.durationUnit.toLowerCase()}`, step.durationUnit)}`;
          }

          let progressText = '';
          if (isActive && step.durationUnit === 'minutes') {
            progressText = t('Active');
          } else if (isActive && step.durationUnit === 'days') {
            const endDate = new Date(step.startedAt || new Date());
            endDate.setDate(endDate.getDate() + step.durationValue);
            progressText = `${t('Target End')}: ${endDate.toLocaleDateString()}`;
          } else if (isCompleted && step.durationUnit === 'minutes' && step.actualDurationSeconds) {
            progressText = `${t('Done in')} ${formatTime(step.actualDurationSeconds)}`;
          }

          if (isEditing && editStepData) {
            return (
              <div key={step.id} className="timeline-item timeline-item--editing">
                <div className="timeline-edit-form">
                  <input 
                    className="timeline-edit-form__input timeline-edit-form__input--title" 
                    type="text" 
                    value={editStepData.title} 
                    onChange={e => setEditStepData({...editStepData, title: e.target.value})} 
                    placeholder={t('Step Title')} 
                  />
                  <select 
                    className="timeline-edit-form__select" 
                    value={editStepData.phase} 
                    onChange={e => setEditStepData({...editStepData, phase: e.target.value})}
                  >
                    {VALID_PHASES.map(phase => (
                      <option key={phase} value={phase}>
                        {t(`constants.step_phases.${phase.toLowerCase()}`, phase)}
                      </option>
                    ))}
                  </select>
                  <textarea 
                    className="timeline-edit-form__textarea" 
                    value={editStepData.description} 
                    onChange={e => setEditStepData({...editStepData, description: e.target.value})} 
                    placeholder={t('Detailed instructions...')} 
                    rows={3} 
                  />
                  <div className="timeline-edit-form__row">
                    <div className="timeline-edit-form__group">
                      <label className="timeline-edit-form__label">{t('Duration')}</label>
                      <div className="timeline-edit-form__duration">
                        <input 
                          className="timeline-edit-form__input"
                          type="number" 
                          min="0" 
                          value={editStepData.durationValue} 
                          onChange={e => setEditStepData({...editStepData, durationValue: parseFloat(e.target.value) || 0})} 
                        />
                        <select 
                          className="timeline-edit-form__select" 
                          value={editStepData.durationUnit} 
                          onChange={e => setEditStepData({...editStepData, durationUnit: e.target.value})}
                        >
                          {VALID_UNITS.map(unit => (
                            <option key={unit} value={unit}>
                              {t(`constants.units.${unit.toLowerCase()}`, unit)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="timeline-edit-form__group">
                      <label className="timeline-edit-form__label">{t('Target Temp (°C)')}</label>
                      <input 
                        className="timeline-edit-form__input"
                        type="number" 
                        value={editStepData.targetTempC ?? ''} 
                        onChange={e => setEditStepData({...editStepData, targetTempC: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                        placeholder={t('Optional')} 
                      />
                    </div>
                  </div>
                  <div className="timeline-edit-form__actions">
                    <button type="button" className="timeline-edit-form__btn-save" onClick={saveEditedStep} disabled={!editStepData.title}>
                      <FaSave /> {t('Save')}
                    </button>
                    <button type="button" className="timeline-edit-form__btn-cancel" onClick={cancelEditStep}>
                      {t('Cancel')}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div 
              key={step.id} 
              className={`timeline-item ${isActive ? 'timeline-item--active' : ''} ${isCompleted ? 'timeline-item--completed' : ''}`}
              draggable={!editingStepId}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={() => handleDrop(index)}
            >
              <div className="timeline-item__drag-handle">
                <FaGripLines />
              </div>
              <div className="timeline-item__indicator">
                <div className="timeline-item__circle">{isCompleted ? <FaCheck size={10} /> : step.stepNumber}</div>
                {index < steps.length - 1 && <div className="timeline-item__line"></div>}
              </div>
              <div className="timeline-item__content">
                <div className="timeline-item__header">
                  <div className="timeline-item__title-group">
                    <span className="timeline-item__phase">{String(t(`constants.step_phases.${step.phase.toLowerCase()}`, step.phase))}</span>
                    <strong className="timeline-item__title">{step.title}</strong>
                  </div>
                  <div className="timeline-item__target">
                    {step.targetTempC !== null && step.targetTempC !== undefined && <span className="timeline-item__temp">🌡 {step.targetTempC}°C</span>}
                    {targetText && <span className="timeline-item__duration">⏱ {targetText}</span>}
                    <div className="timeline-item__context-actions">
                      <button type="button" className="timeline-item__btn-icon" onClick={() => startEditStep(step)} title={t('Edit Step')}><FaEdit /></button>
                      <button type="button" className="timeline-item__btn-icon timeline-item__btn-icon--danger" onClick={() => deleteStep(step.id)} title={t('Delete Step')}><FaTrash /></button>
                    </div>
                  </div>
                </div>
                <p className="timeline-item__desc">{step.description}</p>
                
                <div className="timeline-item__actions">
                  {!isCompleted && (
                    <>
                      <button type="button" className={`timeline-item__btn-timer ${isActive ? 'timeline-item__btn-timer--active' : ''}`} onClick={() => toggleStepTimer(step.id)}>
                        {isActive ? <><FaPause /> {t('Pause')}</> : <><FaPlay /> {t('Start')}</>}
                      </button>
                      {isActive && (
                        <button type="button" className="timeline-item__btn-complete" onClick={() => completeStep(step.id)}>
                          <FaCheck /> {t('Complete')}
                        </button>
                      )}
                    </>
                  )}
                  {(isActive || isCompleted) && (
                    <span className={`timeline-item__progress ${isCompleted ? 'timeline-item__progress--success' : 'timeline-item__progress--primary'}`}>
                      {isActive && step.durationUnit === 'minutes' ? <ActiveTimer startedAt={step.startedAt} accumulatedSeconds={step.accumulatedSeconds} isActive={true} /> : progressText}
                    </span>
                  )}
                </div>

                {isActive && (
                  <div className="timeline-item__quick-log">
                    <input 
                      type="text" 
                      className="timeline-item__quick-input"
                      placeholder={t('Add a quick note...')} 
                      value={quickNoteInputs[step.id] || ''}
                      onChange={(e) => setQuickNoteInputs(prev => ({ ...prev, [step.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickNoteSubmit(step.id)}
                    />
                    <button type="button" className="timeline-item__quick-btn" onClick={() => handleQuickNoteSubmit(step.id)} disabled={!quickNoteInputs[step.id]?.trim()}>
                      <FaCommentDots />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {steps.length === 0 && !isNewStep && <div className="timeline-widget__empty">{t('No steps available.')}</div>}
      </div>
    </div>
  );
};