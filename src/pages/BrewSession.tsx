// src/pages/BrewSession.tsx
import { calculateOneThirdSugarBreak } from '@mead-tracker/math';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCodeBranch, FaInfoCircle, FaPlay, FaPlus } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ActiveTimer } from '../components/ActiveTimer';
import { MeasurementBottomSheet } from '../components/MeasurementBottomSheet';
import { SplitBatchModal } from '../components/SplitBatchModal';
import { TimelineWidget } from '../components/TimelineWidget';
import { TosnaTracker } from '../components/TosnaTracker';
import { useBreweryStore } from '../store/useBreweryStore';
import { useInventoryStore } from '../store/useInventoryStore';
import { useSessionStore } from '../store/useSessionStore';

const getLegacyStatusKey = (status: string) => {
  const map: Record<string, string> = {
    'Brew Day': 'planned',
    'Fermentation': 'fermenting',
    'Conditioning': 'aging',
    'Bottled': 'completed',
    'Completed': 'completed'
  };
  return map[status] || 'planned';
};

const BrewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus, updateTosnaSchedule, splitBrewSession, analyzeBrewSession } = useSessionStore();
  const { inventory, consumeIngredients, fetchInventory } = useInventoryStore();

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showOgModal, setShowOgModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [actualOgInput, setActualOgInput] = useState<string>('');

  const [showMidAddModal, setShowMidAddModal] = useState(false);
  const [midAddIngredientId, setMidAddIngredientId] = useState('');
  const [midAddQty, setMidAddQty] = useState<number>(50);
  const [midAddNote, setMidAddNote] = useState('');
  const [isMidAdding, setIsMidAdding] = useState(false);

  useEffect(() => {
    fetchSessionById(activeBreweryId, id);
    if (activeBreweryId) fetchInventory(activeBreweryId);
    return () => clearCurrentSession();
  }, [id, activeBreweryId, fetchSessionById, fetchInventory, clearCurrentSession]);

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        const steps = currentSession?.sessionSteps || [];
        const activeStep = steps.find((s: any) => s?.isActive);
        if ('wakeLock' in navigator && activeStep) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.error('Wake lock error:', err);
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(console.error);
      }
    };
  }, [currentSession]);

  if (isLoading) return <div className="global-loader"><div className="spinner"></div></div>;
  if (!currentSession) return <div className="home"><h2 className="home__title">{t('Session not found')}</h2></div>;

  const steps = currentSession.sessionSteps || [];
  const activeStep = steps.find((s: any) => s?.isActive);
  const isPrepDone = steps.filter((s: any) => s?.phase === 'Preparation').every((s: any) => s?.isCompleted);
  const isFermDone = steps.filter((s: any) => s?.phase === 'Fermentation').every((s: any) => s?.isCompleted);

  const canSplit = false; 
  const canMidAdd = ['Fermentation', 'Conditioning'].includes(currentSession.status) && !currentSession.isSplit;

  const targetSugarBreak = currentSession.beverageType === 'Mead' 
    ? calculateOneThirdSugarBreak(currentSession.actualOg || currentSession.targetOg || 1.000, currentSession.actualFg || currentSession.targetFg || 1.000)
    : null;

  const handleTimelinePhaseAction = async (phase: string) => {
    if (!activeBreweryId || !currentSession.id) return;

    if (phase === 'Fermentation' && currentSession.status === 'Brew Day') {
      if (!isPrepDone) {
        alert(t('Please complete all Preparation steps first!'));
        return;
      }
      setActualOgInput(currentSession.targetOg?.toString() || '1.000'); 
      setShowOgModal(true);
    } else if (phase === 'Conditioning' && currentSession.status === 'Fermentation') {
      if (!isFermDone) {
        alert(t('Please complete all Fermentation steps first!'));
        return;
      }
      await handleCompletePhase('Conditioning');
    } else if (phase === 'Packaging' && currentSession.status === 'Conditioning') {
      await handleCompletePhase('Completed');
    }
  };

  const handleTosnaAddition = async (additionId: string, nutrientAmount: number, metrics: { sg: number | null, notes: string }) => {
    if (!currentSession || !activeBreweryId) return;

    const now = new Date();
    const additions = (currentSession.tosnaSchedule?.additions || []).map(add => 
      add.id === additionId ? { ...add, isCompleted: true, completedAt: now.toISOString() } : add
    );

    await updateTosnaSchedule(activeBreweryId, currentSession.id, additions);
    
    const startDate = new Date(currentSession.startDate);
    const dayNumber = Math.max(1, Math.floor(Math.abs(now.getTime() - startDate.getTime()) / 86400000) + 1);

    await addLogToSession(activeBreweryId, currentSession.id, {
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      dayNumber,
      sg: metrics.sg, ph: null, tempC: null,
      actionTaken: `TOSNA Addition: ${nutrientAmount}g Fermaid-O`,
      notes: metrics.notes,
      stepId: null
    });
  };

  const handleMidSessionAdd = async () => {
    if (!currentSession?.id || !activeBreweryId || !midAddIngredientId || midAddQty <= 0) return;
    
    const safeInventory = inventory || [];
    const invItem = safeInventory.find(i => i?.ingredientId === midAddIngredientId);
    if (!invItem) return;
    
    setIsMidAdding(true);
    try {
      const success = await consumeIngredients(activeBreweryId, [{ globalIngredientId: midAddIngredientId, quantity: midAddQty }]);
      if (!success) throw new Error('Failed to consume ingredients from inventory');

      const now = new Date();
      const startDate = new Date(currentSession.startDate);
      const dayNumber = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / 86400000) + 1);
      
      await addLogToSession(activeBreweryId, currentSession.id, {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        dayNumber,
        sg: null, ph: null, tempC: null,
        actionTaken: `Mid-session addition: ${midAddQty}g of ${invItem.ingredient?.name || 'ingredient'}`,
        notes: midAddNote,
        stepId: null
      });

      setShowMidAddModal(false);
      setMidAddIngredientId('');
      setMidAddQty(50);
      setMidAddNote('');
    } catch (err) {
      console.error('Failed to add ingredient mid-session:', err);
      alert(t('Failed to add ingredient. Please check inventory and try again.'));
    } finally {
      setIsMidAdding(false);
    }
  };

  const handleMeasurementSubmit = async (data: { sg: number | null; ph: number | null; tempC: number | null; actionTaken: string; notes: string }) => {
    if (!currentSession?.id || !activeBreweryId) return;
    const startDate = new Date(currentSession.startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - startDate.getTime());
    const dayNumber = Math.max(1, Math.floor(diffTime / 86400000) + 1);

    await addLogToSession(activeBreweryId, currentSession.id, {
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      dayNumber,
      ...data,
      stepId: activeStep?.id || null
    });
  };

  const handleConfirmStartFermentation = async () => {
    if (!currentSession?.id || !activeBreweryId) return;
    const parsedOg = parseFloat(actualOgInput);
    if (isNaN(parsedOg) || parsedOg < 0.990 || parsedOg > 1.200) {
      alert(t('Please enter a valid Original Gravity (e.g. 1.050)')); return;
    }
    setShowOgModal(false);
    
    await updateSessionStatus(activeBreweryId, currentSession.id, 'Fermentation', parsedOg);
    
    await addLogToSession(activeBreweryId, currentSession.id, {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      dayNumber: 1,
      sg: parsedOg,
      ph: null,
      tempC: null,
      actionTaken: t('Yeast Pitched / Fermentation Started', 'Засев дрожжей / Старт брожения'),
      notes: '',
      stepId: activeStep?.id || null
    });
  };

  const handleCompletePhase = async (newStatus: 'Conditioning' | 'Completed') => {
    if (!currentSession?.id || !activeBreweryId) return;
    if (window.confirm(t('Are you sure you want to advance to the next phase?'))) {
      await updateSessionStatus(activeBreweryId, currentSession.id, newStatus);
    }
  };

  const handleSplitBatch = async (splits: any) => {
    if (!activeBreweryId) return;
    try {
      await splitBrewSession({ breweryId: activeBreweryId, parentSessionId: currentSession.id, splits });
      setShowSplitModal(false);
      navigate('/');
    } catch (err) {
      console.error('Failed to split batch:', err);
      alert(t('Failed to split batch. Please try again.'));
    }
  };

  const rawStatus = currentSession.status || 'Brew Day';
  
  const chartData = (currentSession.logs || [])
    .filter(log => log?.sg !== null && log?.sg !== undefined)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({ day: `${t('Day')} ${log.dayNumber}`, sg: log.sg }));

  return (
    <div className="brew-session">
      
      {showMidAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{t('Add Ingredient to Batch')}</h3>
            <select className="modal-select" value={midAddIngredientId} onChange={e => setMidAddIngredientId(e.target.value)}>
              <option value="" disabled>{t('Select ingredient...')}</option>
              {(inventory || []).filter(i => i?.quantityOnHand > 0).map(i => (
                <option key={i.ingredientId} value={i.ingredientId}>
                  {i.ingredient?.name || 'Unknown'} ({i.quantityOnHand} {t(`constants.units.${i.unit?.toLowerCase() || 'g'}`)} {t('avail')})
                </option>
              ))}
            </select>
            <div className="modal-input-group">
              <input type="number" className="brew-session__input" value={midAddQty || ''} onChange={e => setMidAddQty(parseFloat(e.target.value) || 0)} />
              <span className="modal-unit">{t('g')}</span>
            </div>
            <textarea className="modal-textarea" value={midAddNote || ''} onChange={e => setMidAddNote(e.target.value)} placeholder={t('Notes (optional)')} rows={3} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMidAddModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleMidSessionAdd} disabled={isMidAdding || !midAddIngredientId}>{isMidAdding ? t('Adding...') : t('Add to Batch')}</button>
            </div>
          </div>
        </div>
      )}

      {showOgModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{t('Start Fermentation')}</h3>
            <p className="modal-subtitle">{t('Please enter actual Original Gravity (OG)')}</p>
            <input type="number" step="0.001" className="modal-input-large" value={actualOgInput || ''} onChange={e => setActualOgInput(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowOgModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleConfirmStartFermentation}>{t('Start')}</button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && <SplitBatchModal currentVolume={currentSession.batchSizeLiters || 0} onClose={() => setShowSplitModal(false)} onSubmit={handleSplitBatch} />}
      <MeasurementBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} onSubmit={handleMeasurementSubmit} activeStepTitle={activeStep?.title} />

      <header className="brew-session__header">
        <div className="brew-session__title-block">
          <h1 className="brew-session__title">{currentSession.recipeName || t('Unknown Recipe')}</h1>
          <div className="brew-session__tags">
            <span className="brew-session__badge" data-status={getLegacyStatusKey(rawStatus)}>
              {t(`constants.status.${rawStatus.toLowerCase().replace(' ', '_')}`, rawStatus)}
            </span>
            {currentSession.isSplit && <span className="brew-session__split-badge">{t('Split Batch')}</span>}
            <span className="brew-session__date">{t('Started')}: {new Date(currentSession.startDate).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="brew-session__actions">
          {canMidAdd && <button className="btn-secondary" onClick={() => setShowMidAddModal(true)}><FaPlus className="brew-session__icon"/> {t('Add Ingredient')}</button>}
          {canSplit && <button className="btn-secondary" onClick={() => setShowSplitModal(true)}><FaCodeBranch className="brew-session__icon"/> {t('Split')}</button>}
          
          {currentSession.status === 'Completed' && !currentSession.aiAnalysisReport && (
            <button className="btn-primary" onClick={() => analyzeBrewSession(activeBreweryId, currentSession.id, i18n.language)}>
              ✨ {t('Analyze Brew', 'Анализировать варку')}
            </button>
          )}
        </div>
      </header>

      <div className="brew-session__stats-row">
        <div className="brew-session__stat-box">
          <span className="brew-session__stat-label">{t('Volume')}</span>
          <strong className="brew-session__stat-value">{currentSession.batchSizeLiters} {t('L')}</strong>
        </div>
        <div className="brew-session__stat-box">
          <span className="brew-session__stat-label">{t('Target ABV')}</span>
          <strong className="brew-session__stat-value brew-session__stat-value--primary">{(currentSession.actualAbv || 0).toFixed(1)}%</strong>
        </div>
        <div className="brew-session__stat-box">
          <span className="brew-session__stat-label">{t('Gravity')} (OG / FG)</span>
          <strong className="brew-session__stat-value">
            {currentSession.actualOg ? currentSession.actualOg.toFixed(3) : (currentSession.targetOg || 1.000).toFixed(3)}
            <span className="brew-session__stat-divider">/</span>
            {(currentSession.targetFg || 1.000).toFixed(3)}
          </strong>
        </div>
        {targetSugarBreak !== null && (
          <div className="brew-session__stat-box brew-session__stat-box--highlight">
            <span className="brew-session__stat-label">
              {t('1/3 Sugar Break')}
              <FaInfoCircle title={t('Stop TOSNA nutrients when SG drops below this point')} className="brew-session__info-icon"/>
            </span>
            <strong className="brew-session__stat-value">{targetSugarBreak.toFixed(3)}</strong>
          </div>
        )}
      </div>

      {currentSession.aiAnalysisReport && (
        <div className="brew-session__card ai-report">
          <div className="ai-report__header">
            <h2 className="ai-report__title">✨ {t('AI Master Brewer Report', 'Отчет ИИ-технолога')}</h2>
            {currentSession.aiScore !== null && currentSession.aiScore !== undefined && (
              <div className="ai-report__score-badge">
                <span className="ai-report__score-label">{t('Score', 'Оценка')}:</span>
                <strong className={`ai-report__score-value ${currentSession.aiScore >= 80 ? 'ai-report__score-value--high' : 'ai-report__score-value--medium'}`}>
                  {currentSession.aiScore}/100
                </strong>
              </div>
            )}
          </div>
          <div className="ai-report__content">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              {currentSession.aiAnalysisReport}
            </div>
          </div>
        </div>
      )}

      <div className="brew-session__grid">
        <div className="brew-session__col-main">
          {activeStep && (
            <div className="active-step-card">
              <div className="active-step-card__header">
                <FaPlay className="active-step-card__icon pulse-animation" />
                <h2 className="active-step-card__title">{t('Current Active Step')}</h2>
              </div>
              <div className="active-step-card__content">
                <strong className="active-step-card__step-name">{activeStep.title || ''}</strong>
                <p className="active-step-card__desc">{activeStep.description || ''}</p>
                <div className="active-step-card__timer">
                  <ActiveTimer startedAt={activeStep.startedAt} accumulatedSeconds={activeStep.accumulatedSeconds} isActive={activeStep.isActive} />
                </div>
              </div>
            </div>
          )}

          <TimelineWidget 
            breweryId={activeBreweryId} 
            sessionId={currentSession.id} 
            steps={steps} 
            startDate={currentSession.startDate} 
            onPhaseAction={handleTimelinePhaseAction}
          />
        </div>

        <div className="brew-session__col-side">
          {currentSession.tosnaSchedule && (
            <TosnaTracker session={currentSession} onMarkAddition={handleTosnaAddition} />
          )}

           <div className="brew-session__card session-logs">
             <div className="brew-session__card-header session-logs__header-main">
               <h2 className="brew-session__card-title">{t('Fermentation Logs')}</h2>
               {currentSession.status !== 'Bottled' && currentSession.status !== 'Completed' && (
                 <button className="btn-secondary btn-secondary--small" onClick={() => setIsBottomSheetOpen(true)}>
                   <FaPlus /> {t('Add')}
                 </button>
               )}
             </div>
             <div className="session-logs__list">
               {(currentSession.logs || []).length === 0 ? (
                 <div className="session-logs__empty">
                   <p>{t('No measurements recorded yet.')}</p>
                 </div>
               ) : (
                 [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => {
                   const linkedStep = steps.find(s => s?.id === log?.stepId);
                   return (
                     <div key={log.id} className="session-logs__item">
                       <div className="session-logs__header">
                         <div>
                           <strong className="session-logs__day">{t('Day')} {log.dayNumber || 1}</strong> 
                           <span className="session-logs__time"> • {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                         </div>
                       </div>
                       
                       {linkedStep && <span className="session-logs__step-badge">{linkedStep.title}</span>}
                       
                       <div className="session-logs__metrics">
                         {log.sg !== null && log.sg !== undefined && <span><strong>{t('SG')}:</strong> {log.sg.toFixed(3)}</span>}
                         {log.ph !== null && log.ph !== undefined && <span><strong>{t('pH')}:</strong> {log.ph.toFixed(2)}</span>}
                         {log.tempC !== null && log.tempC !== undefined && <span><strong>{t('Temp')}:</strong> {log.tempC}°C</span>}
                       </div>

                       <p className="session-logs__action">{log.actionTaken || ''}</p>
                       {log.notes && <p className="session-logs__notes">{log.notes}</p>}
                     </div>
                   );
                 })
               )}
             </div>
          </div>
        </div>
      </div>

      <div className="brew-session__card brew-session__chart-card">
        <h2 className="brew-session__card-title">{t('Fermentation Curve')}</h2>
        {chartData.length > 0 ? (
          <div className="session-chart__container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 0.005', 'dataMax + 0.005']} tick={{ fontSize: 12, fill: '#3b82f6' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} />
                <Line type="monotone" dataKey="sg" stroke="var(--color-primary)" strokeWidth={3} activeDot={{ r: 6, fill: 'var(--color-primary)', stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="session-chart__empty">
            <p>{t('Take your first SG measurement to build the fermentation curve.')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BrewSession;