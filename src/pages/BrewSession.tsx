// src/pages/BrewSession.tsx
import { calculateAbvCrouch } from '@mead-tracker/math';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaCodeBranch, FaLock, FaPlus } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ActiveTimer } from '../components/ActiveTimer';
import { MeasurementBottomSheet } from '../components/MeasurementBottomSheet';
import { SplitBatchModal } from '../components/SplitBatchModal';
import { TimelineWidget } from '../components/TimelineWidget';
import { useBreweryStore } from '../store/useBreweryStore';
import { useSessionStore } from '../store/useSessionStore';

const BrewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeBreweryId } = useBreweryStore();
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus, splitBrewSession } = useSessionStore();

  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [showOgModal, setShowOgModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [actualOgInput, setActualOgInput] = useState<string>('');

  useEffect(() => {
    fetchSessionById(activeBreweryId, id);
    return () => clearCurrentSession();
  }, [id, activeBreweryId, fetchSessionById, clearCurrentSession]);

  if (isLoading) return <div className="brew-session__loader">{t('Loading session...')}</div>;
  if (!currentSession) return <div className="brew-session brew-session--empty"><h2 className="brew-session__title">{t('Session not found')}</h2></div>;

  const steps = currentSession.sessionSteps || [];
  const activeStep = steps.find((s: any) => s.isActive);
  const isPrepDone = steps.filter((s: any) => s.phase === 'Preparation').every((s: any) => s.isCompleted);
  const isFermDone = steps.filter((s: any) => s.phase === 'Fermentation').every((s: any) => s.isCompleted);

  const chartData = (currentSession.logs || [])
    .filter(log => log.sg !== null || log.ph !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({
      day: `Day ${log.dayNumber}`,
      sg: log.sg,
      ph: log.ph,
      timestamp: new Date(log.timestamp).toLocaleDateString()
    }));

  const usedOg = currentSession.actualOg || currentSession.targetOg || 1.000;
  const estimatedCurrentAbv = calculateAbvCrouch(usedOg, currentSession.targetFg || 1.000);

  const statusLabels: Record<string, string> = {
    planned: t('Planned (Setup)'),
    fermenting: t('Fermenting'),
    aging: t('Aging'),
    completed: t('Completed')
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
      alert(t('Please enter a valid Original Gravity (e.g. 1.050)'));
      return;
    }
    setShowOgModal(false);
    await updateSessionStatus(activeBreweryId, currentSession.id, 'fermenting', parsedOg);
  };

  const handleCompletePhase = async (newStatus: 'aging' | 'completed') => {
    if (!currentSession?.id || !activeBreweryId) return;
    if (window.confirm(t('Are you sure you want to advance to the next phase?'))) {
      await updateSessionStatus(activeBreweryId, currentSession.id, newStatus);
    }
  };

  const handleSplitBatch = async (splits: { volumeLiters: number; namePostfix: string }[]) => {
    if (!currentSession?.id || !activeBreweryId) return;
    try {
      await splitBrewSession({
        breweryId: activeBreweryId,
        parentSessionId: currentSession.id,
        splits
      });
      setShowSplitModal(false);
      navigate('/');
    } catch (error) {
      console.log('Error splitting batch:', error);
      alert(t('Failed to split batch.'));
    }
  };

  const canSplit = !currentSession.isSplit && ['fermenting', 'aging'].includes(currentSession.status);

  return (
    <div className="brew-session">
      {showOgModal && (
        <div className="og-modal">
          <div className="og-modal__content">
            <h3 className="og-modal__title">{t('Start Fermentation')}</h3>
            <p className="og-modal__desc">{t('Please enter the actual Original Gravity (OG) measured before pitching yeast.')}</p>
            <input 
              type="number" step="0.001" value={actualOgInput} 
              onChange={e => setActualOgInput(e.target.value)} 
              className="measurement-form__input"
            />
            <div className="og-modal__actions">
              <button type="button" className="btn-secondary" onClick={() => setShowOgModal(false)}>{t('Cancel')}</button>
              <button type="button" className="btn-primary" onClick={handleConfirmStartFermentation}>{t('Start')}</button>
            </div>
          </div>
        </div>
      )}

      {showSplitModal && currentSession && (
        <SplitBatchModal 
          currentVolume={currentSession.batchSizeLiters}
          onClose={() => setShowSplitModal(false)}
          onSubmit={handleSplitBatch}
        />
      )}

      <MeasurementBottomSheet 
        isOpen={isBottomSheetOpen}
        onClose={() => setIsBottomSheetOpen(false)}
        onSubmit={handleMeasurementSubmit}
        activeStepTitle={activeStep?.title}
      />

      {currentSession.status !== 'completed' && !currentSession.isSplit && (
        <button 
          className="fab-button" 
          onClick={() => setIsBottomSheetOpen(true)}
          title={t('Add Measurement')}
        >
          <FaPlus />
        </button>
      )}

      <header className="brew-session__header">
        <div className="brew-session__info">
          <h1 className="brew-session__title">
            {currentSession.recipeName}
            {currentSession.isSplit && <span className="brew-session__split-badge">{t('constants.actions.split')}</span>}
          </h1>
          <div className="brew-session__tags">
            <span className="brew-session__badge" data-status={currentSession.status}>
              {statusLabels[currentSession.status] || currentSession.status}
            </span>
          </div>
        </div>
        
        <div className="brew-session__actions">
          {canSplit && (
            <button className="btn-secondary" onClick={() => setShowSplitModal(true)}>
              <FaCodeBranch /> {t('constants.actions.split_batch')}
            </button>
          )}

          {!currentSession.isSplit && currentSession.status === 'planned' && (
            <button className="btn-primary" onClick={() => { setActualOgInput(currentSession.targetOg?.toString() || '1.000'); setShowOgModal(true); }} disabled={!isPrepDone}>
              {!isPrepDone && <FaLock style={{ marginRight: '6px' }} />} {t('Start Fermentation')}
            </button>
          )}
          {!currentSession.isSplit && currentSession.status === 'fermenting' && (
            <button className="btn-primary" onClick={() => handleCompletePhase('aging')} disabled={!isFermDone}>
              {!isFermDone && <FaLock style={{ marginRight: '6px' }} />} {t('Move to Aging')}
            </button>
          )}
          {!currentSession.isSplit && currentSession.status === 'aging' && (
            <button className="btn-primary" onClick={() => handleCompletePhase('completed')}>
              <FaCheck /> {t('Complete Brew')}
            </button>
          )}
        </div>
      </header>

      <div className="brew-session__grid">
        <div className="brew-session__col-main">
          <TimelineWidget 
            breweryId={activeBreweryId} 
            sessionId={currentSession.id} 
            steps={steps} 
            startDate={currentSession.startDate} 
          />
          
          <div className="brew-session__card session-chart">
            <h3 className="brew-session__card-title">{t('Fermentation Chart')}</h3>
            {chartData.length === 0 ? (
              <div className="session-chart__empty">{t('Add your first measurement using the + button.')}</div>
            ) : (
              <div className="session-chart__container">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#888" />
                    <YAxis yAxisId="left" domain={['dataMin - 0.005', 'dataMax + 0.005']} tick={{ fontSize: 12 }} stroke="var(--color-primary)" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="sg" stroke="var(--color-primary)" strokeWidth={3} name={t('Gravity (SG)')} activeDot={{ r: 8 }} connectNulls />
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
                    <div className="session-logs__metrics">
                      {log.sg !== null && <div><strong>SG:</strong> {log.sg.toFixed(3)}</div>}
                      {log.ph !== null && <div><strong>pH:</strong> {log.ph.toFixed(2)}</div>}
                      {log.tempC !== null && <div><strong>{t('Temp')}:</strong> {log.tempC}°C</div>}
                    </div>
                    {log.actionTaken && <div className="session-logs__action"><strong>{t('Action')}:</strong> {t(log.actionTaken)}</div>}
                    {log.notes && <div className="session-logs__notes">"{log.notes}"</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="brew-session__col-side">
          {activeStep && (
            <div className="brew-session__card active-step-card">
              <h3 className="brew-session__card-title">▶ {t('Active Step')}</h3>
              <div className="active-step-card__content">
                <strong>{activeStep.title}</strong>
                <p className="active-step-card__desc">{activeStep.description}</p>
                <div className="active-step-card__timer">
                  ⏱ <ActiveTimer startedAt={activeStep.startedAt} accumulatedSeconds={activeStep.accumulatedSeconds} isActive={activeStep.isActive} />
                </div>
              </div>
            </div>
          )}

          <div className="brew-session__card target-stats">
            <h3 className="brew-session__card-title">{t('Session Metrics')}</h3>
            <div className="target-stats__list">
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Target Final Gravity')}</span>
                <span className="target-stats__value">{currentSession.targetFg?.toFixed(3)}</span>
              </div>
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Estimated ABV')}</span>
                <span className="target-stats__value target-stats__value--primary">{estimatedCurrentAbv.toFixed(1)}%</span>
              </div>
              <div className="target-stats__row">
                <span className="target-stats__label">{t('Batch Size')}</span>
                <span className="target-stats__value">{currentSession.batchSizeLiters} {t('L')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrewSession;