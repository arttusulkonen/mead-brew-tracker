// src/pages/BrewSession.tsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCodeBranch, FaPlay, FaPlus } from 'react-icons/fa';
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

const BrewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus, updateTosnaSchedule, splitBrewSession } = useSessionStore();
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
        const activeStep = steps.find((s: any) => s.isActive);
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
  const activeStep = steps.find((s: any) => s.isActive);
  const isPrepDone = steps.filter((s: any) => s.phase === 'Preparation').every((s: any) => s.isCompleted);
  const isFermDone = steps.filter((s: any) => s.phase === 'Fermentation').every((s: any) => s.isCompleted);

  const canSplit = !currentSession.isSplit && ['Fermentation', 'Conditioning'].includes(currentSession.status);
  const canMidAdd = ['Fermentation', 'Conditioning'].includes(currentSession.status) && !currentSession.isSplit;

  const handleTosnaAddition = async (additionId: string, nutrientAmount: number, metrics: { sg: number | null, notes: string }) => {
    if (!currentSession || !activeBreweryId) return;

    const now = new Date();
    const additions = currentSession.tosnaSchedule?.additions.map(add => 
      add.id === additionId ? { ...add, isCompleted: true, completedAt: now.toISOString() } : add
    ) || [];

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
    
    const invItem = inventory.find(i => i.ingredientId === midAddIngredientId);
    if (!invItem) return;
    
    setIsMidAdding(true);
    try {
      const success = await consumeIngredients(activeBreweryId, [{ globalIngredientId: midAddIngredientId, quantity: midAddQty }]);
      
      if (!success) {
        throw new Error('Failed to consume ingredients from inventory');
      }

      const now = new Date();
      const startDate = new Date(currentSession.startDate);
      const dayNumber = Math.max(1, Math.floor((now.getTime() - startDate.getTime()) / 86400000) + 1);
      
      await addLogToSession(activeBreweryId, currentSession.id, {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        dayNumber,
        sg: null, ph: null, tempC: null,
        actionTaken: `Mid-session addition: ${midAddQty}g of ${invItem.ingredient.name}`,
        notes: midAddNote,
        stepId: null
      });

      setShowMidAddModal(false);
      setMidAddIngredientId('');
      setMidAddQty(50);
      setMidAddNote('');
    } catch (err) {
      alert(t('Failed to add ingredient to session.'));
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
  };

  const handleCompletePhase = async (newStatus: 'Conditioning' | 'Bottled') => {
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
      alert(t('Split Batch functionality requires Supabase RPC implementation.'));
    }
  };

  const chartData = (currentSession.logs || [])
    .filter(log => log.sg !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({ day: `Day ${log.dayNumber}`, sg: log.sg }));

  return (
    <div className="home" style={{ maxWidth: '1200px' }}>
      
      {showMidAddModal && (
        <div className="modal-overlay">
          <div className="home-card modal-content">
            <h3 className="modal-title">{t('Add Ingredient to Batch')}</h3>
            <select className="modal-select" value={midAddIngredientId} onChange={e => setMidAddIngredientId(e.target.value)}>
              <option value="" disabled>{t('Select ingredient...')}</option>
              {inventory.filter(i => i.quantityOnHand > 0).map(i => (
                <option key={i.ingredientId} value={i.ingredientId}>
                  {i.ingredient.name} ({i.quantityOnHand} {t(`constants.units.${i.unit.toLowerCase()}`)} avail)
                </option>
              ))}
            </select>
            <div className="modal-input-group">
              <input type="number" className="setup-form-input" value={midAddQty} onChange={e => setMidAddQty(parseFloat(e.target.value) || 0)} />
              <span className="modal-unit">g</span>
            </div>
            <textarea className="modal-textarea" value={midAddNote} onChange={e => setMidAddNote(e.target.value)} placeholder={t('Notes (optional)')} rows={3} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowMidAddModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleMidSessionAdd} disabled={isMidAdding || !midAddIngredientId}>{isMidAdding ? t('Adding...') : t('Add to Batch')}</button>
            </div>
          </div>
        </div>
      )}

      {showOgModal && (
        <div className="modal-overlay">
          <div className="home-card modal-content">
            <h3 className="modal-title">{t('Start Fermentation')}</h3>
            <p className="modal-subtitle">{t('Please enter actual Original Gravity (OG)')}</p>
            <input type="number" step="0.001" className="setup-form-input modal-input-large" value={actualOgInput} onChange={e => setActualOgInput(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowOgModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleConfirmStartFermentation}>{t('Start')}</button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && <SplitBatchModal currentVolume={currentSession.batchSizeLiters} onClose={() => setShowSplitModal(false)} onSubmit={handleSplitBatch} />}
      <MeasurementBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} onSubmit={handleMeasurementSubmit} activeStepTitle={activeStep?.title} />

      <header className="home__header brew-session__header">
        <div className="brew-session__title-block">
          <h1 className="home__title">{currentSession.recipeName}</h1>
          <span className="brew-item__badge brew-session__badge" data-status={currentSession.status}>
            {t(currentSession.status)}
            {currentSession.isSplit && ` • ${t('constants.actions.split')}`}
          </span>
        </div>
        <div className="brew-session__actions">
          {canMidAdd && <button className="btn-secondary" onClick={() => setShowMidAddModal(true)}><FaPlus className="brew-session__icon"/> {t('Add Ingredient')}</button>}
          {canSplit && <button className="btn-secondary" onClick={() => setShowSplitModal(true)}><FaCodeBranch className="brew-session__icon"/> {t('Split')}</button>}
          {currentSession.status === 'Brew Day' && !currentSession.isSplit && <button className="btn-primary" onClick={() => { setActualOgInput(currentSession.targetOg?.toString() || '1.000'); setShowOgModal(true); }} disabled={!isPrepDone}><FaPlay className="brew-session__icon"/> {t('Start Fermentation')}</button>}
          {currentSession.status === 'Fermentation' && !currentSession.isSplit && <button className="btn-primary" onClick={() => handleCompletePhase('Conditioning')} disabled={!isFermDone}><FaCheck className="brew-session__icon"/> {t('Move to Conditioning')}</button>}
          {currentSession.status === 'Conditioning' && !currentSession.isSplit && <button className="btn-primary" onClick={() => handleCompletePhase('Bottled')}><FaCheck className="brew-session__icon"/> {t('Complete Brew')}</button>}
        </div>
      </header>

      <div className="home__grid brew-session__grid">
        <div className="brew-session__column">
          <TimelineWidget breweryId={activeBreweryId} sessionId={currentSession.id} steps={steps} startDate={currentSession.startDate} />
          
          <div className="home-card">
            <div className="home-card__header"><h2 className="home-card__title">{t('Fermentation Chart')}</h2></div>
            <div className="brew-session__chart-container" style={{ height: '300px', padding: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#888" />
                  <YAxis domain={['dataMin - 0.005', 'dataMax + 0.005']} tick={{ fontSize: 12 }} stroke="var(--color-primary)" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--box-shadow-base)' }} />
                  <Line type="monotone" dataKey="sg" stroke="var(--color-primary)" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="brew-session__column">
          {currentSession.tosnaSchedule && (
            <TosnaTracker session={currentSession} onMarkAddition={handleTosnaAddition} />
          )}

          {activeStep && (
            <div className="home-card home-card--active-step">
              <div className="home-card__header"><h2 className="home-card__title home-card__title--primary">▶ {t('Active Step')}</h2></div>
              <div className="home-card__list">
                <strong className="active-step__title">{activeStep.title}</strong>
                <p className="active-step__desc">{activeStep.description}</p>
                <div className="active-step__timer">
                  ⏱ <ActiveTimer startedAt={activeStep.startedAt} accumulatedSeconds={activeStep.accumulatedSeconds} isActive={activeStep.isActive} />
                </div>
              </div>
            </div>
          )}

           <div className="home-card">
             <div className="home-card__header">
               <h2 className="home-card__title">{t('Session Logs')}</h2>
               {currentSession.status !== 'Bottled' && currentSession.status !== 'Completed' && (
                 <button className="btn-text" onClick={() => setIsBottomSheetOpen(true)}>+ {t('Add')}</button>
               )}
             </div>
             <div className="home-card__list">
               {currentSession.logs.length === 0 ? (
                 <p className="brew-session__empty-logs">{t('No logs recorded yet.')}</p>
               ) : (
                 [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => {
                   const linkedStep = steps.find(s => s.id === log.stepId);
                   
                   return (
                     <div key={log.id} className="log-item">
                       <div className="log-item__header">
                         <div className="log-item__title-group">
                           <strong className="log-item__day">{t('Day')} {log.dayNumber}</strong> 
                           {linkedStep && (
                             <span className="badge badge--outline log-item__badge">📍 {linkedStep.title}</span>
                           )}
                         </div>
                         <span className="log-item__time">{new Date(log.timestamp).toLocaleString()}</span>
                       </div>
                       
                       <p className="log-item__action">{log.actionTaken}</p>
                       
                       {log.notes && (
                         <p className="log-item__notes" style={{ whiteSpace: 'pre-wrap', marginTop: '8px', fontSize: '0.9rem' }}>{log.notes}</p>
                       )}
                       
                       <div className="log-item__metrics">
                         {log.sg !== null && <span className="log-item__metric"><strong>SG:</strong> {log.sg.toFixed(3)}</span>}
                         {log.ph !== null && <span className="log-item__metric"><strong>pH:</strong> {log.ph.toFixed(2)}</span>}
                         {log.tempC !== null && <span className="log-item__metric"><strong>Temp:</strong> {log.tempC}°C</span>}
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSession;