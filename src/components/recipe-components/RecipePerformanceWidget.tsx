// src/components/recipe-components/RecipePerformanceWidget.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChartBar, FaRegStar, FaStar } from 'react-icons/fa';

interface RecipePerformanceWidgetProps {
  totalBrews?: number;
  completedBrews?: number;
  avgAiScore?: number | null;
  avgUserRating?: number | null;
  totalUserRatings?: number;
  currentUserRating?: number | null;
  onRateRecipe?: (rating: number) => Promise<void>;
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
  const [isRating, setIsRating] = useState(false);

  const handleRate = async (star: number) => {
    if (!onRateRecipe || isRating) return;
    
    setIsRating(true);
    try {
      await onRateRecipe(star);
    } catch (err) {
      console.error('Failed to submit rating:', err);
    } finally {
      setIsRating(false);
    }
  };

  const renderInteractiveStars = () => {
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
              onClick={() => handleRate(star)}
              disabled={!onRateRecipe || isRating}
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
        {t('Recipe Performance')}
      </h3>
      
      <div className="recipe-performance__stats">
        
        <div className="recipe-performance__stat">
          <span className="recipe-performance__label">
            {t('Total Brews')}
          </span>
          <div className="recipe-performance__value-group">
            <strong className="recipe-performance__value">{totalBrews}</strong>
            <span className="recipe-performance__sub-value">
              ({completedBrews} {t('completed')})
            </span>
          </div>
        </div>

        <div className="recipe-performance__stat recipe-performance__stat--divider">
          <span className="recipe-performance__label">
            {t('User Rating')}
          </span>
          <div className="recipe-performance__value-group recipe-performance__value-group--column">
            {renderInteractiveStars()}
            <span className="recipe-performance__sub-value">
              {avgUserRating ? `${avgUserRating.toFixed(1)} / 5` : t('Not rated')}
              {totalUserRatings > 0 && ` (${totalUserRatings})`}
            </span>
          </div>
        </div>

        {avgAiScore !== null && avgAiScore !== undefined && (
          <div className="recipe-performance__stat recipe-performance__stat--divider">
            <span className="recipe-performance__label">
              {t('AI Score')}
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