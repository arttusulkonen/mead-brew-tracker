// src/components/recipe-components/RecipePerformanceWidget.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaChartBar, FaStar } from 'react-icons/fa';

interface RecipePerformanceWidgetProps {
  totalBrews?: number;
  completedBrews?: number;
  avgAiScore?: number | null;
}

export const RecipePerformanceWidget: React.FC<RecipePerformanceWidgetProps> = ({ totalBrews = 0, completedBrews = 0, avgAiScore }) => {
  const { t } = useTranslation();
  console.log('Rendering RecipePerformanceWidget with props:', { totalBrews, completedBrews, avgAiScore });
  if (totalBrews === 0) return null;

  return (
    <div style={{ 
      marginBottom: '24px', 
      padding: '16px', 
      backgroundColor: 'var(--bg-surface)', 
      border: '1px solid var(--border-color)', 
      borderRadius: '8px', 
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)' 
    }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
        <FaChartBar style={{ color: 'var(--color-primary)' }} /> 
        {t('Historical Performance', 'История варок')}
      </h3>
      
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '100px' }}>
          <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {t('Total Brews', 'Всего варок')}
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{totalBrews}</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-disabled)' }}>
              ({completedBrews} {t('completed', 'завершено')})
            </span>
          </div>
        </div>

        {avgAiScore !== null && avgAiScore !== undefined && (
          <div style={{ flex: 1, minWidth: '100px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
            <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {t('AI Rating', 'Рейтинг ИИ')}
            </span>
            <strong style={{ fontSize: '1.25rem', color: '#9333ea', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FaStar style={{ color: '#eab308', fontSize: '1rem' }} /> {avgAiScore}/100
            </strong>
          </div>
        )}
      </div>
    </div>
  );
};