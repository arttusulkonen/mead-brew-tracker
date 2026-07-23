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
  onPhaseAction?: (phase: string) => void;
}

const VALID_PHASES: StepPhase[] = ['Preparation', 'Mashing', 'Boiling', 'Fermentation', 'Conditioning', 'Packaging'];
const VALID_UNITS: TimeUnit[] = ['minutes', 'days'];

const mapPhaseToTranslationKey = (phase: string): string => {
  const p = phase?.toLowerCase() || 'preparation';
  if (p === 'conditioning') return 'constants.step_phases.aging';
  return `constants.step_phases.${p}`;
};

export const TimelineWidget: React.FC<TimelineWidgetProps> = ({ breweryId, sessionId, steps, startDate, onPhaseAction }) => {
  const { t } = useTranslation();
  const { updateSteps, addLogToSession, currentSession } = useSessionStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepData, setEditStepData] = useState<any | null>(null);
  const [isNewStep, setIsNewStep] = useState(false);
  const [quickNoteInputs, setQuickNoteInputs] = useState<Record<string, string>>({});

  const safeSteps = steps || [];

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
    const newSteps = [...safeSteps];
    const [movedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, movedStep);
    
    const reorderedSteps = newSteps.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    await saveSteps(reorderedSteps);
    setDraggedIndex(null);
  };

  const toggleStepTimer = async (stepId: string, phase: string) => {
    const isCurrentlyActive = safeSteps.find(s => s?.id === stepId)?.isActive;

    if (!isCurrentlyActive && onPhaseAction && currentSession) {
      if (phase === 'Fermentation' && currentSession.status === 'Brew Day') {
        onPhaseAction(phase);
        return; 
      } else if (phase === 'Conditioning' && currentSession.status === 'Fermentation') {
        onPhaseAction(phase);
        return; 
      } else if (phase === 'Packaging' && currentSession.status === 'Conditioning') {
        onPhaseAction(phase);
        return; 
      }
    }

    const now = new Date().toISOString();
    const updatedSteps = safeSteps.map(s => {
      if (s?.id === stepId) {
        if (s.isActive) {
          const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
          return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
        } else {
          return { ...s, isActive: true, startedAt: now };
        }
      } else if (s?.isActive) {
        const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
        return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
      }
      return s;
    });
    
    await saveSteps(updatedSteps);
  };

  const completeStep = async (stepId: string) => {
    const now = new Date().toISOString();
    const updatedSteps = safeSteps.map(s => {
      if (s?.id === stepId) {
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
      stepNumber: safeSteps.length + 1,
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
    if (!step) return;
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
      updatedSteps = [...safeSteps, editStepData];
    } else {
      updatedSteps = safeSteps.map(s => s?.id === editingStepId ? editStepData : s);
    }
    await saveSteps(updatedSteps);
    setEditingStepId(null);
    setEditStepData(null);
    setIsNewStep(false);
  };

  const deleteStep = async (stepId: string) => {
    if (!window.confirm(t('Are you sure you want to delete this step?'))) return;
    const updatedSteps = safeSteps.filter(s => s?.id !== stepId).map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    await saveSteps(updatedSteps);
  };

  const handleQuickNoteSubmit = async (stepId: string) => {
    const note = quickNoteInputs[stepId];
    if (!note || !note.trim()) return;

    const start = startDate ? new Date(startDate) : new Date();
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
    if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  return (
    <div className="timeline">
      <div className="timeline__header">
        <h3 className="timeline__title">{t('Brewing Timeline')}</h3>
        <button type="button" className="btn-secondary timeline__btn-add" onClick={addManualStep} disabled={!!editingStepId}>
          <FaPlus /> {t('Add Step')}
        </button>
      </div>
      
      <div className="timeline__list">
        {isNewStep && editStepData && editingStepId === editStepData.id && (
          <div className="timeline__item timeline__item--editing">
             <div className="timeline__edit-form">
                <input 
                  className="timeline__edit-input timeline__edit-input--title" 
                  type="text" 
                  value={editStepData.title || ''} 
                  onChange={e => setEditStepData({...editStepData, title: e.target.value})} 
                  placeholder={t('Step Title')} 
                />
                <select 
                  className="timeline__edit-select" 
                  value={editStepData.phase || 'Preparation'} 
                  onChange={e => setEditStepData({...editStepData, phase: e.target.value})}
                >
                  {VALID_PHASES.map(phase => (
                    <option key={phase} value={phase}>
                      {t(mapPhaseToTranslationKey(phase), phase) as string}
                    </option>
                  ))}
                </select>
                <textarea 
                  className="timeline__edit-textarea" 
                  value={editStepData.description || ''} 
                  onChange={e => setEditStepData({...editStepData, description: e.target.value})} 
                  placeholder={t('Detailed instructions...')} 
                  rows={3} 
                />
                <div className="timeline__edit-row">
                  <div className="timeline__edit-group">
                    <label>{t('Duration')}</label>
                    <div className="timeline__edit-duration">
                      <input 
                        type="number" 
                        min="0" 
                        value={editStepData.durationValue || ''} 
                        onChange={e => setEditStepData({...editStepData, durationValue: parseFloat(e.target.value) || 0})} 
                      />
                      <select 
                        value={editStepData.durationUnit || 'minutes'} 
                        onChange={e => setEditStepData({...editStepData, durationUnit: e.target.value})}
                      >
                        {VALID_UNITS.map(unit => (
                           <option key={unit} value={unit}>
                             {t(`constants.units.${unit.toLowerCase()}`, unit) as string}
                           </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="timeline__edit-group">
                    <label>{t('Target Temp (°C)')}</label>
                    <input 
                      className="timeline__edit-input"
                      type="number" 
                      value={editStepData.targetTempC ?? ''} 
                      onChange={e => setEditStepData({...editStepData, targetTempC: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                      placeholder={t('Optional')} 
                    />
                  </div>
                </div>
                <div className="timeline__edit-actions">
                  <button type="button" className="btn-primary" onClick={saveEditedStep} disabled={!editStepData.title}>
                    <FaSave /> {t('Save')}
                  </button>
                  <button type="button" className="btn-secondary" onClick={cancelEditStep}>
                    {t('Cancel')}
                  </button>
                </div>
              </div>
          </div>
        )}

        {safeSteps.map((step, index) => {
          if (!step) return null;
          const isActive = step.isActive;
          const isCompleted = step.isCompleted;
          const isEditing = editingStepId === step.id && !isNewStep;
          
          let targetText = '';
          if (step.durationValue > 0) {
            targetText = `${step.durationValue} ${t(`constants.units.${step.durationUnit?.toLowerCase() || 'minutes'}`, step.durationUnit) as string}`;
          }

          let progressText = '';
          if (isActive && step.durationUnit === 'minutes') {
            progressText = t('Active');
          } else if (isActive && step.durationUnit === 'days') {
            const endDate = new Date(step.startedAt || new Date());
            endDate.setDate(endDate.getDate() + (step.durationValue || 0));
            progressText = `${t('Target End')}: ${endDate.toLocaleDateString()}`;
          } else if (isCompleted && step.durationUnit === 'minutes' && step.actualDurationSeconds) {
            progressText = `${t('Done in')} ${formatTime(step.actualDurationSeconds)}`;
          }

          if (isEditing && editStepData) {
            return (
              <div key={step.id} className="timeline__item timeline__item--editing">
                <div className="timeline__edit-form">
                  <input 
                    className="timeline__edit-input timeline__edit-input--title" 
                    type="text" 
                    value={editStepData.title || ''} 
                    onChange={e => setEditStepData({...editStepData, title: e.target.value})} 
                    placeholder={t('Step Title')} 
                  />
                  <select 
                    className="timeline__edit-select" 
                    value={editStepData.phase || 'Preparation'} 
                    onChange={e => setEditStepData({...editStepData, phase: e.target.value})}
                  >
                    {VALID_PHASES.map(phase => (
                      <option key={phase} value={phase}>
                        {t(mapPhaseToTranslationKey(phase), phase) as string}
                      </option>
                    ))}
                  </select>
                  <textarea 
                    className="timeline__edit-textarea" 
                    value={editStepData.description || ''} 
                    onChange={e => setEditStepData({...editStepData, description: e.target.value})} 
                    placeholder={t('Detailed instructions...')} 
                    rows={3} 
                  />
                  <div className="timeline__edit-row">
                    <div className="timeline__edit-group">
                      <label>{t('Duration')}</label>
                      <div className="timeline__edit-duration">
                        <input 
                          type="number" 
                          min="0" 
                          value={editStepData.durationValue || ''} 
                          onChange={e => setEditStepData({...editStepData, durationValue: parseFloat(e.target.value) || 0})} 
                        />
                        <select 
                          value={editStepData.durationUnit || 'minutes'} 
                          onChange={e => setEditStepData({...editStepData, durationUnit: e.target.value})}
                        >
                          {VALID_UNITS.map(unit => (
                            <option key={unit} value={unit}>
                              {t(`constants.units.${unit.toLowerCase()}`, unit) as string}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="timeline__edit-group">
                      <label>{t('Target Temp (°C)')}</label>
                      <input 
                        className="timeline__edit-input"
                        type="number" 
                        value={editStepData.targetTempC ?? ''} 
                        onChange={e => setEditStepData({...editStepData, targetTempC: e.target.value === '' ? null : parseFloat(e.target.value)})} 
                        placeholder={t('Optional')} 
                      />
                    </div>
                  </div>
                  <div className="timeline__edit-actions">
                    <button type="button" className="btn-primary" onClick={saveEditedStep} disabled={!editStepData.title}>
                      <FaSave /> {t('Save')}
                    </button>
                    <button type="button" className="btn-secondary" onClick={cancelEditStep}>
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
              className={`timeline__item ${isActive ? 'timeline__item--active' : ''} ${isCompleted ? 'timeline__item--completed' : ''}`}
              draggable={!editingStepId}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={() => handleDrop(index)}
            >
              <div className="timeline__drag-handle">
                <FaGripLines />
              </div>
              <div className="timeline__indicator">
                <div className="timeline__circle">{isCompleted ? <FaCheck size={10} /> : step.stepNumber || index + 1}</div>
                {index < safeSteps.length - 1 && <div className="timeline__line"></div>}
              </div>
              <div className="timeline__content">
                <div className="timeline__item-header">
                  <div className="timeline__title-group">
                    <span className="timeline__phase">
                      {t(mapPhaseToTranslationKey(step.phase || 'Preparation'), step.phase || 'Preparation') as string}
                    </span>
                    <strong className="timeline__item-title">{step.title || t('Unknown Step')}</strong>
                  </div>
                  <div className="timeline__target">
                    {step.targetTempC !== null && step.targetTempC !== undefined && <span className="timeline__temp">🌡 {step.targetTempC}°C</span>}
                    {targetText && <span className="timeline__duration">⏱ {targetText}</span>}
                    <div className="timeline__context-actions">
                      <button type="button" className="timeline__btn-icon" onClick={() => startEditStep(step)} title={t('Edit Step')} aria-label={t('Edit Step')}><FaEdit /></button>
                      <button type="button" className="timeline__btn-icon timeline__btn-icon--danger" onClick={() => deleteStep(step.id)} title={t('Delete Step')} aria-label={t('Delete Step')}><FaTrash /></button>
                    </div>
                  </div>
                </div>
                <p className="timeline__desc">{step.description || ''}</p>
                
                <div className="timeline__actions">
                  {!isCompleted && (
                    <>
                      <button 
                        type="button" 
                        className={`timeline__btn-timer ${isActive ? 'timeline__btn-timer--active' : ''}`} 
                        onClick={() => toggleStepTimer(step.id, step.phase || 'Preparation')}
                      >
                        {isActive ? <><FaPause /> {t('Pause')}</> : <><FaPlay /> {t('Start')}</>}
                      </button>
                      {isActive && (
                        <button type="button" className="timeline__btn-complete" onClick={() => completeStep(step.id)}>
                          <FaCheck /> {t('Complete')}
                        </button>
                      )}
                    </>
                  )}
                  {(isActive || isCompleted) && (
                    <span className={`timeline__progress ${isCompleted ? 'timeline__progress--success' : 'timeline__progress--primary'}`}>
                      {isActive && step.durationUnit === 'minutes' ? <ActiveTimer startedAt={step.startedAt} accumulatedSeconds={step.accumulatedSeconds || 0} isActive={true} /> : progressText}
                    </span>
                  )}
                </div>

                {isActive && (
                  <div className="timeline__quick-log">
                    <input 
                      type="text" 
                      className="timeline__quick-input"
                      placeholder={t('Add a quick note...', 'Добавить быструю заметку...')} 
                      value={quickNoteInputs[step.id] || ''}
                      onChange={(e) => setQuickNoteInputs(prev => ({ ...prev, [step.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickNoteSubmit(step.id)}
                    />
                    <button type="button" className="timeline__quick-btn" onClick={() => handleQuickNoteSubmit(step.id)} disabled={!quickNoteInputs[step.id]?.trim()} aria-label={t('Save Note')}>
                      <FaCommentDots />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {safeSteps.length === 0 && !isNewStep && <div className="timeline__empty">{t('No steps available.')}</div>}
      </div>
    </div>
  );
};