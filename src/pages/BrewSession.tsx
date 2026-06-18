import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaCheck, FaExclamationTriangle, FaPlus, FaSave } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSessionStore } from '../store/useSessionStore';
import type { BrewLog } from '../types/session';

const BrewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentSession, fetchSessionById, clearCurrentSession, isLoading, addLogToSession, updateSessionStatus } = useSessionStore();

  const [sgInput, setSgInput] = useState<string>('');
  const [phInput, setPhInput] = useState<string>('');
  const [tempInput, setTempInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [actionInput, setActionInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSessionById(id);
    return () => clearCurrentSession();
  }, [id, fetchSessionById, clearCurrentSession]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSession || !currentSession.id) return;

    setIsSubmitting(true);
    try {
      const startDate = new Date(currentSession.startDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      const dayNumber = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const newLog: BrewLog = {
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        dayNumber,
        sg: sgInput ? parseFloat(sgInput) : null,
        ph: phInput ? parseFloat(phInput) : null,
        tempC: tempInput ? parseFloat(tempInput) : null,
        notes: notesInput,
        actionTaken: actionInput
      };

      await addLogToSession(currentSession.id, newLog);
      
      setSgInput('');
      setPhInput('');
      setTempInput('');
      setNotesInput('');
      setActionInput('');
    } catch (error) {
      console.error(error);
      alert(t('Failed to add log.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompletePhase = async (newStatus: 'fermenting' | 'aging' | 'completed') => {
    if (!currentSession || !currentSession.id) return;
    if (window.confirm(t('Are you sure you want to advance to the next phase?'))) {
      await updateSessionStatus(currentSession.id, newStatus);
    }
  };

  if (isLoading) {
    return <div className="global-loader"><div className="spinner"></div></div>;
  }

  if (!currentSession) {
    return (
      <div className="brew-session-page error-state">
        <h2>{t('Session not found')}</h2>
        <button className="btn-secondary" onClick={() => navigate('/recipes')}>
          {t('Back to Recipes')}
        </button>
      </div>
    );
  }

  const chartData = currentSession.logs
    .filter(log => log.sg !== null || log.ph !== null)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(log => ({
      day: `Day ${log.dayNumber}`,
      sg: log.sg,
      ph: log.ph,
      timestamp: new Date(log.timestamp).toLocaleDateString()
    }));

  const latestLog = currentSession.logs.length > 0 ? [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] : null;
  const isPhDanger = latestLog?.ph && (latestLog.ph < 3.2);

  return (
    <div className="brew-session-page">
      <header className="session-header">
        <div className="header-info">
          <h1>{currentSession.recipeName}</h1>
          <div className="meta-tags">
            <span className="status-badge">
              {t(currentSession.status.toUpperCase())}
            </span>
            <span className="start-date">
              {t('Started')}: {new Date(currentSession.startDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {currentSession.status === 'planned' && (
            <button className="btn-primary" onClick={() => handleCompletePhase('fermenting')}>{t('Start Fermentation')}</button>
          )}
          {currentSession.status === 'fermenting' && (
            <button className="btn-primary" onClick={() => handleCompletePhase('aging')}>{t('Move to Aging (Cold Crash)')}</button>
          )}
          {currentSession.status === 'aging' && (
            <button className="btn-primary" onClick={() => handleCompletePhase('completed')}><FaCheck /> {t('Complete Brew')}</button>
          )}
        </div>
      </header>

      <div className="session-grid">
        <div className="main-column">
          <div className="card chart-card">
            <h3>{t('Fermentation Chart')}</h3>
            {chartData.length === 0 ? (
              <div className="empty-text">{t('Add your first measurement to generate the chart.')}</div>
            ) : (
              <div className="chart-container">
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

          <div className="card logs-card">
            <h3>{t('Session Logs')}</h3>
            <div className="logs-list">
              {currentSession.logs.length === 0 ? (
                <div className="empty-text">{t('No logs recorded yet.')}</div>
              ) : (
                [...currentSession.logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(log => (
                  <div key={log.id} className="log-entry">
                    <div className="log-header">
                      <strong className="day-label">{t('Day')} {log.dayNumber}</strong>
                      <span className="timestamp">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="log-metrics">
                      {log.sg !== null && <div><strong>SG:</strong> {log.sg.toFixed(3)}</div>}
                      {log.ph !== null && <div><strong>pH:</strong> {log.ph.toFixed(2)}</div>}
                      {log.tempC !== null && <div><strong>{t('Temp')}:</strong> {log.tempC}°C</div>}
                    </div>
                    {log.actionTaken && (
                      <div className="log-action">
                        <strong>{t('Action')}:</strong> {log.actionTaken}
                      </div>
                    )}
                    {log.notes && (
                      <div className="log-notes">
                        "{log.notes}"
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="side-column">
          <div className="card measurement-form-card">
            <h3><FaPlus /> {t('New Measurement')}</h3>
            <form onSubmit={handleAddLog}>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('Gravity (SG)')}</label>
                  <input type="number" step="0.001" min="0.990" max="1.150" value={sgInput} onChange={(e) => setSgInput(e.target.value)} placeholder="e.g. 1.045" disabled={isSubmitting} />
                </div>
                <div className="form-group">
                  <label>{t('Acidity (pH)')}</label>
                  <input type="number" step="0.01" min="2.0" max="7.0" value={phInput} onChange={(e) => setPhInput(e.target.value)} placeholder="e.g. 3.80" disabled={isSubmitting} />
                </div>
              </div>
              <div className="form-group">
                <label>{t('Temperature (°C)')}</label>
                <input type="number" step="0.1" value={tempInput} onChange={(e) => setTempInput(e.target.value)} placeholder="e.g. 19.5" disabled={isSubmitting} />
              </div>
              <div className="form-group">
                <label>{t('Action Taken')}</label>
                <input type="text" value={actionInput} onChange={(e) => setActionInput(e.target.value)} placeholder={t('e.g. Added 1.8g Fermaid-O, degassed')} disabled={isSubmitting} />
              </div>
              <div className="form-group">
                <label>{t('Notes')}</label>
                <textarea value={notesInput} onChange={(e) => setNotesInput(e.target.value)} placeholder={t('Observations, smells, bubble activity...')} rows={2} disabled={isSubmitting} />
              </div>
              <button type="submit" className="btn-primary full-width" disabled={isSubmitting || (!sgInput && !phInput && !tempInput && !actionInput && !notesInput)}>
                <FaSave /> {isSubmitting ? t('Saving...') : t('Save Log')}
              </button>
            </form>
          </div>

          <div className="card stat-card">
            <h3>{t('Target Metrics')}</h3>
            <div className="stat-list">
              <div className="stat-row">
                <span className="label">{t('Original Gravity')}</span>
                <span className="value">{currentSession.targetOg?.toFixed(3)}</span>
              </div>
              <div className="stat-row">
                <span className="label">{t('Target Final Gravity')}</span>
                <span className="value primary-text">{currentSession.targetFg?.toFixed(3)}</span>
              </div>
              <div className="stat-row">
                <span className="label">{t('Batch Size')}</span>
                <span className="value">{currentSession.batchSizeLiters} {t('L')}</span>
              </div>
            </div>
          </div>

          {isPhDanger && (
            <div className="warning-banner">
              <FaExclamationTriangle className="warning-icon" />
              <div className="warning-content">
                <h4>{t('Low pH Warning')}</h4>
                <p>
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