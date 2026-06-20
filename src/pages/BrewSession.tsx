import { doc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCommentDots, FaEdit, FaExclamationTriangle, FaGripLines, FaPause, FaPlay, FaPlus, FaSave, FaTrash } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { db } from '../firebase/config';
import { useBreweryStore } from '../store/useBreweryStore';
import { useSessionStore } from '../store/useSessionStore';
import type { BrewLog } from '../types/session';

const BrewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus } = useSessionStore();

  const [sgInput, setSgInput] = useState<string>('');
  const [phInput, setPhInput] = useState<string>('');
  const [tempInput, setTempInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [actionInput, setActionInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [steps, setSteps] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepData, setEditStepData] = useState<any | null>(null);

  const [quickNoteInputs, setQuickNoteInputs] = useState<Record<string, string>>({});
  
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchSessionById(activeBreweryId, id);
    return () => clearCurrentSession();
  }, [id, activeBreweryId, fetchSessionById, clearCurrentSession]);

  useEffect(() => {
    if (currentSession?.sessionSteps) {
      setSteps(currentSession.sessionSteps);
    }
  }, [currentSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const saveStepsToDb = async (newSteps: any[]) => {
    if (!activeBreweryId || !currentSession?.id || !db) return;
    try {
      const sessionRef = doc(db, `breweries/${activeBreweryId}/brew_sessions`, currentSession.id);
      await updateDoc(sessionRef, { 
        sessionSteps: newSteps, 
        updatedAt: new Date().toISOString() 
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleDragStart = (index: number) => {
    if (editingStepId) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index || editingStepId) return;
    const newSteps = [...steps];
    const [movedStep] = newSteps.splice(draggedIndex, 1);
    newSteps.splice(index, 0, movedStep);
    
    const reorderedSteps = newSteps.map((step, idx) => ({ ...step, stepNumber: idx + 1 }));
    setSteps(reorderedSteps);
    setDraggedIndex(null);
    await saveStepsToDb(reorderedSteps);
  };

  const toggleStepTimer = async (stepId: string) => {
    const now = new Date().toISOString();
    let isStartingNew = false;
    
    const updatedSteps = steps.map(s => {
      if (s.id === stepId) {
        if (s.isActive) {
          const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
          return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
        } else {
          isStartingNew = true;
          return { ...s, isActive: true, startedAt: now };
        }
      } else if (s.isActive) {
        const elapsed = Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
        return { ...s, isActive: false, startedAt: null, accumulatedSeconds: (s.accumulatedSeconds || 0) + elapsed };
      }
      return s;
    });
    
    setSteps(updatedSteps);
    await saveStepsToDb(updatedSteps);

    if (isStartingNew && currentSession?.status === 'planned' && activeBreweryId && currentSession?.id) {
      try {
        await updateSessionStatus(activeBreweryId, currentSession.id, 'fermenting');
        await fetchSessionById(activeBreweryId, currentSession.id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const completeStep = async (stepId: string) => {
    const now = new Date().toISOString();
    let isStartingNew = false;
    
    const updatedSteps = steps.map(s => {
      if (s.id === stepId) {
        let finalSeconds = s.accumulatedSeconds || 0;
        if (s.isActive && s.startedAt) {
          finalSeconds += Math.floor((new Date(now).getTime() - new Date(s.startedAt).getTime()) / 1000);
        }
        isStartingNew = true;
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
    
    setSteps(updatedSteps);
    await saveStepsToDb(updatedSteps);

    if (isStartingNew && currentSession?.status === 'planned' && activeBreweryId && currentSession?.id) {
      try {
        await updateSessionStatus(activeBreweryId, currentSession.id, 'fermenting');
        await fetchSessionById(activeBreweryId, currentSession.id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const addManualStep = async () => {
    const newId = crypto.randomUUID();
    const newStep = {
      id: newId,
      stepNumber: steps.length + 1,
      phase: 'Preparation',
      title: '',
      description: '',
      durationValue: 0,
      durationUnit: 'minutes',
      targetTempC: null,
      isCompleted: false,
      isActive: false,
      startedAt: null,
      accumulatedSeconds: 0
    };
    const updatedSteps = [...steps, newStep];
    setSteps(updatedSteps);
    
    setEditStepData(newStep);
    setEditingStepId(newId);
  };

  const startEditStep = (step: any) => {
    setEditStepData({ ...step });
    setEditingStepId(step.id);
  };

  const cancelEditStep = () => {
    if (editStepData && !editStepData.title) {
      const filteredSteps = steps.filter(s => s.id !== editingStepId);
      setSteps(filteredSteps);
    }
    setEditingStepId(null);
    setEditStepData(null);
  };

  const saveEditedStep = async () => {
    if (!editStepData) return;
    const updatedSteps = steps.map(s => s.id === editingStepId ? editStepData : s);
    setSteps(updatedSteps);
    setEditingStepId(null);
    setEditStepData(null);
    await saveStepsToDb(updatedSteps);
  };

  const deleteStep = async (stepId: string) => {
    if (!window.confirm(t('Are you sure you want to delete this step?'))) return;
    const updatedSteps = steps.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, stepNumber: idx + 1 }));
    setSteps(updatedSteps);
    await saveStepsToDb(updatedSteps);
  };

  const handleQuickNoteSubmit = async (stepId: string) => {
    const note = quickNoteInputs[stepId];
    if (!note || !note.trim() || !currentSession || !currentSession.id || !activeBreweryId) return;

    const startDate = new Date(currentSession.startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
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
      stepId: stepId || null
    };

    try {
      await addLogToSession(activeBreweryId, currentSession.id, newLog);
      setQuickNoteInputs(prev => ({ ...prev, [stepId]: '' }));
    } catch {
      alert(t('Failed to add log.'));
    }
  };

  const getStepDuration = (step: any) => {
    let total = step.accumulatedSeconds || 0;
    if (step.isActive && step.startedAt) {
      total += Math.floor((Date.now() - new Date(step.startedAt).getTime()) / 1000);
    }
    return total;
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const activeStep = steps.find(s => s.isActive);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !currentSession.id || !activeBreweryId) return;

    setIsSubmitting(true);
    try {
      const startDate = new Date(currentSession.startDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      const dayNumber = Math.max(1, Math.floor(diffTime / 86400000) + 1);

      const newLog: BrewLog = {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        dayNumber,
        sg: sgInput ? parseFloat(sgInput) : null,
        ph: phInput ? parseFloat(phInput) : null,
        tempC: tempInput ? parseFloat(tempInput) : null,
        notes: notesInput || '',
        actionTaken: actionInput || '',
        stepId: activeStep?.id || null
      };

      await addLogToSession(activeBreweryId, currentSession.id, newLog);
      
      setSgInput('');
      setPhInput('');
      setTempInput('');
      setNotesInput('');
      setActionInput('');
    } catch {
      alert(t('Failed to add log.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTosna = async (additionId: number, typeLabel: string) => {
    if (!currentSession || !currentSession.id || !activeBreweryId || !currentSession.tosnaSchedule) return;
    
    setIsSubmitting(true);
    try {
      const updatedAdditions = currentSession.tosnaSchedule.additions.map(a =>
        a.id === additionId ? { ...a, isCompleted: true, actualDate: new Date().toISOString() } : a
      );

      const sessionRef = doc(db, `breweries/${activeBreweryId}/brew_sessions`, currentSession.id);
      await updateDoc(sessionRef, { 
        'tosnaSchedule.additions': updatedAdditions,
        updatedAt: new Date().toISOString()
      });

      const startDate = new Date(currentSession.startDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      const dayNumber = Math.max(1, Math.floor(diffTime / 86400000) + 1);

      const autoLog: BrewLog = {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        dayNumber,
        sg: null, ph: null, tempC: null,
        notes: `${t('Automated Log: Nutrient added')} (${typeLabel})`,
        actionTaken: `TOSNA: ${typeLabel}`,
      };

      await addLogToSession(activeBreweryId, currentSession.id, autoLog);
      await fetchSessionById(activeBreweryId, currentSession.id);
    } catch (error) {
      console.error(error);
      alert(t('Failed to update TOSNA schedule.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePhase = async (newStatus: 'fermenting' | 'aging' | 'completed') => {
    if (!currentSession || !currentSession.id || !activeBreweryId) return;
    if (window.confirm(t('Are you sure you want to advance to the next phase?'))) {
      try {
        await updateSessionStatus(activeBreweryId, currentSession.id, newStatus);
        await fetchSessionById(activeBreweryId, currentSession.id);
      } catch {
        alert(t('Failed to update status.'));
      }
    }
  };

  const getCountdownText = (targetDateStr?: string) => {
    if (!targetDateStr) return '';
    const diffMs = new Date(targetDateStr).getTime() - Date.now();
    const diffHrs = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
    const diffMins = Math.floor(Math.abs(diffMs) / (1000 * 60)) % 60;
    
    if (diffMs > 0) {
      return `${t('Due in')} ${diffHrs}h ${diffMins}m`;
    } else {
      return `${t('Overdue by')} ${diffHrs}h ${diffMins}m`;
    }
  };

  if (isLoading) return <div className="brew-session__loader">{t('Loading session...')}</div>;
  if (!currentSession) return <div className="brew-session brew-session--empty"><h2 className="brew-session__title">{t('Session not found')}</h2></div>;

  const chartData = (currentSession.logs || [])
    .filter(log => log.sg !== null || log.ph !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({
      day: `Day ${log.dayNumber}`,
      sg: log.sg,
      ph: log.ph,
      timestamp: new Date(log.timestamp).toLocaleDateString()
    }));

  const latestLog = currentSession.logs?.length > 0 ? [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
  const isPhDanger = latestLog?.ph !== null && latestLog?.ph !== undefined && latestLog.ph < 3.2;

  const statusLabels: Record<string, string> = {
    planned: t('Planned'),
    fermenting: t('Fermenting'),
    aging: t('Aging'),
    completed: t('Completed')
  };

  return (
    <div className="brew-session">
      <header className="brew-session__header">
        <div className="brew-session__info">
          <h1 className="brew-session__title">{currentSession.recipeName}</h1>
          <div className="brew-session__tags">
            <span className="brew-session__badge">{statusLabels[currentSession.status] || currentSession.status}</span>
            <span className="brew-session__date">{t('Started')}: {new Date(currentSession.startDate).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="brew-session__actions">
          {currentSession.status === 'planned' && <button type="button" className="btn-primary" onClick={() => handleCompletePhase('fermenting')}>{t('Start Fermentation')}</button>}
          {currentSession.status === 'fermenting' && <button type="button" className="btn-primary" onClick={() => handleCompletePhase('aging')}>{t('Move to Aging (Cold Crash)')}</button>}
          {currentSession.status === 'aging' && <button type="button" className="btn-primary" onClick={() => handleCompletePhase('completed')}><FaCheck /> {t('Complete Brew')}</button>}
        </div>
      </header>

      <div className="brew-session__grid">
        <div className="brew-session__col-main">
          
          <div className="brew-session__card timeline">
            <div className="timeline__header">
              <h3 className="timeline__title">{t('Brewing Timeline')}</h3>
              <button type="button" className="btn-secondary timeline__btn-add" onClick={addManualStep} disabled={!!editingStepId}>
                <FaPlus /> {t('Add Step')}
              </button>
            </div>
            
            <div className="timeline__list">
              {steps.map((step, index) => {
                const isActive = step.isActive;
                const isCompleted = step.isCompleted;
                const isEditing = editingStepId === step.id;
                const secondsElapsed = getStepDuration(step);
                
                let targetText = '';
                if (step.durationValue > 0) {
                  targetText = `${step.durationValue} ${t(step.durationUnit)}`;
                }

                let progressText = '';
                if (isActive && step.durationUnit === 'minutes') {
                  progressText = formatTime(secondsElapsed);
                } else if (isActive && step.durationUnit === 'days') {
                  const endDate = new Date(step.startedAt || new Date());
                  endDate.setDate(endDate.getDate() + step.durationValue);
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
                          value={editStepData.title} 
                          onChange={e => setEditStepData({...editStepData, title: e.target.value})} 
                          placeholder={t('Step Title')} 
                        />
                        <select 
                          className="timeline__edit-select"
                          value={editStepData.phase} 
                          onChange={e => setEditStepData({...editStepData, phase: e.target.value})}
                        >
                          <option value="Preparation">{t('Preparation')}</option>
                          <option value="Fermentation">{t('Fermentation')}</option>
                          <option value="Aging">{t('Aging')}</option>
                        </select>
                        <textarea 
                          className="timeline__edit-textarea"
                          value={editStepData.description} 
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
                                value={editStepData.durationValue} 
                                onChange={e => setEditStepData({...editStepData, durationValue: parseFloat(e.target.value) || 0})} 
                              />
                              <select 
                                value={editStepData.durationUnit} 
                                onChange={e => setEditStepData({...editStepData, durationUnit: e.target.value})}
                              >
                                <option value="minutes">{t('Minutes')}</option>
                                <option value="days">{t('Days')}</option>
                              </select>
                            </div>
                          </div>
                          <div className="timeline__edit-group">
                            <label>{t('Target Temp (°C)')}</label>
                            <input 
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
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={() => handleDrop(index)}
                  >
                    <div className="timeline__drag-handle">
                      <FaGripLines />
                    </div>
                    <div className="timeline__indicator">
                      <div className="timeline__circle">{isCompleted ? <FaCheck size={10} /> : step.stepNumber}</div>
                      {index < steps.length - 1 && <div className="timeline__line"></div>}
                    </div>
                    <div className="timeline__content">
                      <div className="timeline__item-header">
                        <div className="timeline__title-group">
                          <span className="timeline__phase">{t(step.phase)}</span>
                          <strong className="timeline__item-title">{step.title}</strong>
                        </div>
                        <div className="timeline__target">
                          {step.targetTempC !== null && step.targetTempC !== undefined && <span className="timeline__temp">🌡 {step.targetTempC}°C</span>}
                          {targetText && <span className="timeline__duration">⏱ {targetText}</span>}
                          <div className="timeline__context-actions">
                            <button type="button" className="timeline__btn-icon" onClick={() => startEditStep(step)} title={t('Edit Step')}>
                              <FaEdit />
                            </button>
                            <button type="button" className="timeline__btn-icon timeline__btn-icon--danger" onClick={() => deleteStep(step.id)} title={t('Delete Step')}>
                              <FaTrash />
                            </button>
                          </div>
                        </div>
                      </div>
                      <p className="timeline__desc">{step.description}</p>
                      
                      <div className="timeline__actions">
                        {!isCompleted && (
                          <>
                            <button type="button" className={`timeline__btn-timer ${isActive ? 'timeline__btn-timer--active' : ''}`} onClick={() => toggleStepTimer(step.id)}>
                              {isActive ? <><FaPause /> {t('Pause')}</> : <><FaPlay /> {t('Start')}</>}
                            </button>
                            {isActive && (
                              <button type="button" className="timeline__btn-complete" onClick={() => completeStep(step.id)}>
                                <FaCheck /> {t('Complete')}
                              </button>
                            )}
                          </>
                        )}
                        {(isActive || isCompleted) && progressText && (
                          <span className={`timeline__progress ${isCompleted ? 'timeline__progress--success' : 'timeline__progress--primary'}`}>
                            {progressText}
                          </span>
                        )}
                      </div>

                      {isActive && (
                        <div className="timeline__quick-log">
                          <input 
                            type="text" 
                            className="timeline__quick-input"
                            placeholder={t('Add a quick note or action for this step...')} 
                            value={quickNoteInputs[step.id] || ''}
                            onChange={(e) => setQuickNoteInputs(prev => ({ ...prev, [step.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleQuickNoteSubmit(step.id)}
                          />
                          <button 
                            type="button" 
                            className="timeline__quick-btn" 
                            onClick={() => handleQuickNoteSubmit(step.id)}
                            disabled={!quickNoteInputs[step.id]?.trim()}
                          >
                            <FaCommentDots />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {steps.length === 0 && <div className="timeline__empty">{t('No steps available.')}</div>}
            </div>
          </div>

          <div className="brew-session__card session-chart">
            <h3 className="brew-session__card-title">{t('Fermentation Chart')}</h3>
            {chartData.length === 0 ? (
              <div className="session-chart__empty">{t('Add your first measurement to generate the chart.')}</div>
            ) : (
              <div className="session-chart__container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#888" />
                    <YAxis yAxisId="left" domain={['dataMin - 0.005', 'dataMax + 0.005']} tick={{ fontSize: 12 }} stroke="var(--color-primary)" />
                    <YAxis yAxisId="right" orientation="right" domain={[2.5, 5.0]} tick={{ fontSize: 12 }} stroke="#e67e22" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="sg" stroke="var(--color-primary)" strokeWidth={3} name={t('Gravity (SG)')} activeDot={{ r: 8 }} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#e67e22" strokeWidth={3} name={t('Acidity (pH)')} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="brew-session__card session-logs">
            <h3 className="brew-session__card-title">{t('Session Logs')}</h3>
            <div className="session-logs__list">
              {!currentSession.logs || currentSession.logs.length === 0 ? (
                <div className="session-logs__empty">{t('No logs recorded yet.')}</div>
              ) : (
                [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
                  <div key={log.id} className="session-logs__item">
                    <div className="session-logs__header">
                      <strong className="session-logs__day">{t('Day')} {log.dayNumber}</strong>
                      <span className="session-logs__time">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    {log.stepId && steps.find(s => s.id === log.stepId) && (
                      <div className="session-logs__step-badge">
                        {t('Step')}: {steps.find(s => s.id === log.stepId)?.title}
                      </div>
                    )}
                    <div className="session-logs__metrics">
                      {log.sg !== null && <div><strong>SG:</strong> {log.sg.toFixed(3)}</div>}
                      {log.ph !== null && <div><strong>pH:</strong> {log.ph.toFixed(2)}</div>}
                      {log.tempC !== null && <div><strong>{t('Temp')}:</strong> {log.tempC}°C</div>}
                    </div>
                    {log.actionTaken && <div className="session-logs__action"><strong>{t('Action')}:</strong> {log.actionTaken}</div>}
                    {log.notes && <div className="session-logs__notes">"{log.notes}"</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="brew-session__col-side">

          {currentSession.status === 'fermenting' && currentSession.tosnaSchedule && (
            <div className="brew-session__card tosna-widget">
              <div className="tosna-widget__header">
                <h3 className="brew-session__card-title" style={{ margin: 0 }}>🚀 {t('TOSNA 3.0 Tracker')}</h3>
                <span className="tosna-widget__target">
                  {t('1/3 Break')}: <strong>{currentSession.tosnaSchedule.targetOneThirdBreak.toFixed(3)}</strong>
                </span>
              </div>

              {currentSession.tosnaSchedule.isCompressed && (
                <div className="session-alert session-alert--warning tosna-widget__alert">
                  <FaExclamationTriangle className="session-alert__icon" />
                  <div className="session-alert__content">
                    <h4 className="session-alert__title">{t('Fast Fermentation Detected!')}</h4>
                    <p className="session-alert__text">
                      {t('1/3 Sugar Break reached early. Schedule compressed. Add remaining nutrients now.')}
                    </p>
                  </div>
                </div>
              )}

              <div className="tosna-widget__list">
                {currentSession.tosnaSchedule.additions.map((addition) => {
                  const isOverdue = addition.targetDate ? new Date(addition.targetDate).getTime() < Date.now() : false;
                  const isDueNow = currentSession.tosnaSchedule?.isCompressed && !addition.isCompleted;

                  return (
                    <div 
                      key={addition.id} 
                      className={`tosna-widget__item ${addition.isCompleted ? 'tosna-widget__item--completed' : ''} ${isOverdue ? 'tosna-widget__item--overdue' : ''} ${isDueNow ? 'tosna-widget__item--due-now' : ''}`}
                    >
                      <div className="tosna-widget__info">
                        <span className="tosna-widget__item-title">{t(`Addition ${addition.id}`)} ({t(addition.type)})</span>
                        
                        {addition.isCompleted ? (
                          <span className="tosna-widget__time tosna-widget__time--success">
                            <FaCheck /> {t('Completed')} {addition.actualDate ? new Date(addition.actualDate).toLocaleTimeString() : ''}
                          </span>
                        ) : isDueNow ? (
                          <span className="tosna-widget__time tosna-widget__time--overdue">{t('DUE NOW')}</span>
                        ) : (
                          <span className={`tosna-widget__time ${isOverdue ? 'tosna-widget__time--overdue' : ''}`}>
                            {getCountdownText(addition.targetDate)}
                          </span>
                        )}
                      </div>
                      
                      {!addition.isCompleted && (
                        <button 
                          type="button" 
                          className="btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={() => handleCompleteTosna(addition.id, addition.type)}
                          disabled={isSubmitting}
                        >
                          <FaCheck />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="brew-session__card measurement-form">
            <h3 className="measurement-form__title"><FaPlus /> {t('New Measurement')}</h3>
            {activeStep && (
              <div className="measurement-form__context">
                {t('Recording under active step')}: <strong>{activeStep.title}</strong>
              </div>
            )}
            <form className="measurement-form__fields" onSubmit={handleAddLog}>
              <div className="measurement-form__row">
                <div className="measurement-form__group">
                  <label className="measurement-form__label">{t('Gravity (SG)')}</label>
                  <input className="measurement-form__input" type="number" step="0.001" min="0.990" max="1.150" value={sgInput} onChange={(e) => setSgInput(e.target.value)} placeholder="e.g. 1.045" disabled={isSubmitting} />
                </div>
                <div className="measurement-form__group">
                  <label className="measurement-form__label">{t('Acidity (pH)')}</label>
                  <input className="measurement-form__input" type="number" step="0.01" min="2.0" max="7.0" value={phInput} onChange={(e) => setPhInput(e.target.value)} placeholder="e.g. 3.80" disabled={isSubmitting} />
                </div>
              </div>
              <div className="measurement-form__group">
                <label className="measurement-form__label">{t('Temperature (°C)')}</label>
                <input className="measurement-form__input" type="number" step="0.1" value={tempInput} onChange={(e) => setTempInput(e.target.value)} placeholder="e.g. 19.5" disabled={isSubmitting} />
              </div>
              <div className="measurement-form__group">
                <label className="measurement-form__label">{t('Action Taken')}</label>
                <input className="measurement-form__input" type="text" value={actionInput} onChange={(e) => setActionInput(e.target.value)} placeholder={t('e.g. Added 1.8g Fermaid-O, degassed')} disabled={isSubmitting} />
              </div>
              <div className="measurement-form__group">
                <label className="measurement-form__label">{t('Notes')}</label>
                <textarea className="measurement-form__input" value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder={t('Observations, smells, bubble activity...')} rows={2} disabled={isSubmitting} />
              </div>
              <button type="submit" className="btn-primary measurement-form__btn" disabled={isSubmitting || (!sgInput && !phInput && !tempInput && !actionInput && !notesInput)}>
                <FaSave /> {isSubmitting ? t('Saving...') : t('Save Log')}
              </button>
            </form>
          </div>

          <div className="brew-session__card target-stats">
            <h3 className="brew-session__card-title">{t('Target Metrics')}</h3>
            <div className="target-stats__list">
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Original Gravity')}</span>
                <span className="target-stats__value">{currentSession.targetOg?.toFixed(3)}</span>
              </div>
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Target Final Gravity')}</span>
                <span className="target-stats__value target-stats__value--primary">{currentSession.targetFg?.toFixed(3)}</span>
              </div>
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Batch Size')}</span>
                <span className="target-stats__value">{currentSession.batchSizeLiters} {t('L')}</span>
              </div>
            </div>
          </div>
          
          {isPhDanger && (
            <div className="session-alert session-alert--warning">
              <FaExclamationTriangle className="session-alert__icon" />
              <div className="session-alert__content">
                <h4 className="session-alert__title">{t('Low pH Warning')}</h4>
                <p className="session-alert__text">
                  {t('Your latest pH reading is below 3.2. This can stall fermentation. Consider adding Potassium Carbonate to buffer the acidity.')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrewSession;