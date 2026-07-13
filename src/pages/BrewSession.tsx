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
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus, splitBrewSession } = useSessionStore();
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

  const canSplit = !currentSession.isSplit && ['fermenting', 'aging'].includes(currentSession.status);
  const canMidAdd = ['fermenting', 'aging'].includes(currentSession.status) && !currentSession.isSplit;

  const handleTosnaAddition = async (additionId: string, nutrientAmount: number) => {
    if (!currentSession || !activeBreweryId) return;

    const startDate = new Date(currentSession.startDate);
    const now = new Date();
    const dayNumber = Math.max(1, Math.floor(Math.abs(now.getTime() - startDate.getTime()) / 86400000) + 1);

    const additions = currentSession.tosnaSchedule?.additions.map(add => 
      add.id === additionId ? { ...add, isCompleted: true, completedAt: now.toISOString() } : add
    ) || [];

    // Мы сразу добавляем это в логи, стор сам обновит tosnaSchedule внутри
    const updatedTosna = { ...currentSession.tosnaSchedule!, additions };

    // Подменяем объект, чтобы функция addLogToSession записала свежие данные в БД
    currentSession.tosnaSchedule = updatedTosna;

    await addLogToSession(activeBreweryId, currentSession.id, {
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      dayNumber,
      sg: null, ph: null, tempC: null,
      actionTaken: `TOSNA Addition: ${nutrientAmount}g Fermaid-O`,
      notes: '',
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
      console.error('Error adding ingredient to session:', err);
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

  const chartData = (currentSession.logs || [])
    .filter(log => log.sg !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({ day: `Day ${log.dayNumber}`, sg: log.sg }));

  return (
    <div className="home" style={{ maxWidth: '1200px' }}>
      
      {showMidAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="home-card" style={{ padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>{t('Add Ingredient to Batch')}</h3>
            <select value={midAddIngredientId} onChange={e => setMidAddIngredientId(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <option value="" disabled>{t('Select ingredient...')}</option>
              {inventory.filter(i => i.quantityOnHand > 0).map(i => (
                <option key={i.ingredientId} value={i.ingredientId}>
                  {i.ingredient.name} ({i.quantityOnHand} {t(`constants.units.${i.unit.toLowerCase()}`)} avail)
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <input type="number" value={midAddQty} onChange={e => setMidAddQty(parseFloat(e.target.value) || 0)} style={{ flex: 1, padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
              <span style={{ alignSelf: 'center', fontWeight: 'bold' }}>g</span>
            </div>
            <textarea value={midAddNote} onChange={e => setMidAddNote(e.target.value)} placeholder={t('Notes (optional)')} rows={3} style={{ width: '100%', padding: '12px', marginBottom: '24px', borderRadius: '6px', border: '1px solid var(--border-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setShowMidAddModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleMidSessionAdd} disabled={isMidAdding || !midAddIngredientId}>{isMidAdding ? t('Adding...') : t('Add to Batch')}</button>
            </div>
          </div>
        </div>
      )}

      {showOgModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="home-card" style={{ padding: '24px', width: '100%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem' }}>{t('Start Fermentation')}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>{t('Please enter actual Original Gravity (OG)')}</p>
            <input type="number" step="0.001" value={actualOgInput} onChange={e => setActualOgInput(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '24px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '1.1rem' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setShowOgModal(false)}>{t('Cancel')}</button>
              <button className="btn-primary" onClick={handleConfirmStartFermentation}>{t('Start')}</button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && <SplitBatchModal currentVolume={currentSession.batchSizeLiters} onClose={() => setShowSplitModal(false)} onSubmit={async (splits) => { await splitBrewSession({ breweryId: activeBreweryId!, parentSessionId: currentSession.id, splits }); setShowSplitModal(false); navigate('/'); }} />}
      <MeasurementBottomSheet isOpen={isBottomSheetOpen} onClose={() => setIsBottomSheetOpen(false)} onSubmit={handleMeasurementSubmit} activeStepTitle={activeStep?.title} />

      <header className="home__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="home__title">{currentSession.recipeName}</h1>
          <span className="brew-item__badge" data-status={currentSession.status} style={{ display: 'inline-block', marginTop: '8px' }}>
            {t(currentSession.status)}
            {currentSession.isSplit && ` • ${t('constants.actions.split')}`}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canMidAdd && <button className="btn-secondary" onClick={() => setShowMidAddModal(true)}><FaPlus style={{ marginRight: '6px' }}/> {t('Add Ingredient')}</button>}
          {canSplit && <button className="btn-secondary" onClick={() => setShowSplitModal(true)}><FaCodeBranch style={{ marginRight: '6px' }}/> {t('Split')}</button>}
          {currentSession.status === 'planned' && !currentSession.isSplit && <button className="btn-primary" onClick={() => { setActualOgInput(currentSession.targetOg?.toString() || '1.000'); setShowOgModal(true); }} disabled={!isPrepDone}><FaPlay style={{ marginRight: '6px' }}/> {t('Start Fermentation')}</button>}
          {currentSession.status === 'fermenting' && !currentSession.isSplit && <button className="btn-primary" onClick={() => handleCompletePhase('aging')} disabled={!isFermDone}><FaCheck style={{ marginRight: '6px' }}/> {t('Move to Aging')}</button>}
          {currentSession.status === 'aging' && !currentSession.isSplit && <button className="btn-primary" onClick={() => handleCompletePhase('completed')}><FaCheck style={{ marginRight: '6px' }}/> {t('Complete Brew')}</button>}
        </div>
      </header>

      <div className="home__grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <TimelineWidget breweryId={activeBreweryId} sessionId={currentSession.id} steps={steps} startDate={currentSession.startDate} />
          
          <div className="home-card">
            <div className="home-card__header"><h2 className="home-card__title">{t('Fermentation Chart')}</h2></div>
            <div style={{ height: '300px', padding: '16px' }}>
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

          {currentSession.status === 'fermenting' && currentSession.tosnaSchedule && (
            <TosnaTracker session={currentSession} onMarkAddition={handleTosnaAddition} />
          )}

          {activeStep && (
            <div className="home-card" style={{ backgroundColor: 'var(--bg-surface-alt)' }}>
              <div className="home-card__header"><h2 className="home-card__title" style={{ color: 'var(--color-primary)' }}>▶ {t('Active Step')}</h2></div>
              <div className="home-card__list">
                <strong style={{ fontSize: '1.1rem' }}>{activeStep.title}</strong>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.4' }}>{activeStep.description}</p>
                <div style={{ marginTop: '12px', fontSize: '1.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary-dark)' }}>
                  ⏱ <ActiveTimer startedAt={activeStep.startedAt} accumulatedSeconds={activeStep.accumulatedSeconds} isActive={activeStep.isActive} />
                </div>
              </div>
            </div>
          )}

           <div className="home-card">
             <div className="home-card__header">
               <h2 className="home-card__title">{t('Session Logs')}</h2>
               {currentSession.status !== 'Bottled' && <button className="btn-text" onClick={() => setIsBottomSheetOpen(true)}>+ {t('Add')}</button>}
             </div>
             <div className="home-card__list">
               {currentSession.logs.length === 0 ? (
                 <p style={{ color: 'var(--text-disabled)', textAlign: 'center', margin: '20px 0' }}>{t('No logs recorded yet.')}</p>
               ) : (
                 [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => {
                   const linkedStep = steps.find(s => s.id === log.stepId);
                   
                   return (
                     <div key={log.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '8px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                         <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                           <strong style={{ color: 'var(--text-primary)' }}>{t('Day')} {log.dayNumber}</strong> 
                           {linkedStep && (
                             <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                               📍 {linkedStep.title}
                             </span>
                           )}
                         </div>
                         <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</span>
                       </div>
                       
                       <p style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '500' }}>{log.actionTaken}</p>
                       
                       {log.notes && (
                         <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                           {log.notes}
                         </p>
                       )}
                       
                       <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                         {log.sg !== null && <span style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '2px 6px', borderRadius: '4px' }}><strong>SG:</strong> {log.sg.toFixed(3)}</span>}
                         {log.ph !== null && <span style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '2px 6px', borderRadius: '4px' }}><strong>pH:</strong> {log.ph.toFixed(2)}</span>}
                         {log.tempC !== null && <span style={{ backgroundColor: 'var(--bg-surface-alt)', padding: '2px 6px', borderRadius: '4px' }}><strong>Temp:</strong> {log.tempC}°C</span>}
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