// src/components/recipe-components/RecipePerformanceWidget.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChartBar, FaRegStar, FaStar } from 'react-icons/fa';

interface RecipePerformanceWidgetProps {
  totalBrews?: number;
  completedBrews?: number;
  avgAiScore?: number | null;
  // Новые пропсы для пользовательского рейтинга
  avgUserRating?: number | null;     // Средняя оценка пользователей (например, 4.5)
  totalUserRatings?: number;         // Количество проголосовавших
  currentUserRating?: number | null; // Оценка текущего пользователя (чтобы подсветить его выбор)
  onRateRecipe?: (rating: number) => void; // Коллбэк для сохранения оценки в БД
}

export const RecipePerformanceWidget: React.FC<RecipePerformanceWidgetProps> = ({ 
  totalBrews = 0, 
  completedBrews = 0, 
  avgAiScore,
  avgUserRating,
  totalUserRatings = 0,
  currentUserRating,
  onRateRecipe
}) => {
  const { t } = useTranslation();
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  // Отрисовка интерактивных звезд для пользователей
  const renderInteractiveStars = () => {
    // Если юзер навел мышку — показываем ховер. Иначе показываем его собственную оценку. 
    // Если он еще не оценивал — показываем средний рейтинг по всем юзерам.
    const displayScore = hoveredStar || currentUserRating || Math.round(avgUserRating || 0);

    return (
      <div className="recipe-performance__stars-container">
        {[1, 2, 3, 4, 5].map(star => {
          const isFilled = star <= displayScore;
          return (
            <button
              key={star}
              type="button"
              className={`recipe-performance__star-btn ${isFilled ? 'recipe-performance__star-btn--filled' : ''}`}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => onRateRecipe && onRateRecipe(star)}
              disabled={!onRateRecipe}
              aria-label={t('Rate {{star}} stars', { star, defaultValue: `Rate ${star} stars` })}
            >
              {isFilled ? <FaStar /> : <FaRegStar />}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="recipe-performance">
      <h3 className="recipe-performance__header">
        <FaChartBar className="recipe-performance__icon" /> 
        {t('Recipe Performance', 'Статистика рецепта')}
      </h3>
      
      <div className="recipe-performance__stats">
        
        {/* Блок 1: История варок */}
        <div className="recipe-performance__stat">
          <span className="recipe-performance__label">
            {t('Total Brews', 'Всего варок')}
          </span>
          <div className="recipe-performance__value-group">
            <strong className="recipe-performance__value">{totalBrews}</strong>
            <span className="recipe-performance__sub-value">
              ({completedBrews} {t('completed', 'завершено')})
            </span>
          </div>
        </div>

        {/* Блок 2: Оценка пользователей (НОВЫЙ) */}
        <div className="recipe-performance__stat recipe-performance__stat--divider">
          <span className="recipe-performance__label">
            {t('User Rating', 'Оценка')}
          </span>
          <div className="recipe-performance__value-group recipe-performance__value-group--column">
            {renderInteractiveStars()}
            <span className="recipe-performance__sub-value">
              {avgUserRating ? `${avgUserRating.toFixed(1)} / 5` : t('Not rated', 'Нет оценок')}
              {totalUserRatings > 0 && ` (${totalUserRatings})`}
            </span>
          </div>
        </div>

        {/* Блок 3: Оценка ИИ */}
        {avgAiScore !== null && avgAiScore !== undefined && (
          <div className="recipe-performance__stat recipe-performance__stat--divider">
            <span className="recipe-performance__label">
              {t('AI Score', 'Рейтинг ИИ')}
            </span>
            <strong className="recipe-performance__value recipe-performance__value--ai">
              <FaStar className="recipe-performance__star-icon" /> {avgAiScore}/100
            </strong>
          </div>
        )}
      </div>
    </div>
  );
};