// src/components/recipe-components/RecipeFaqWidget.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown, FaChevronUp, FaQuestionCircle } from 'react-icons/fa';
import type { BeverageType } from '../../types/recipe';
import { SWEETNESS_LEVELS } from '../../utils/meadConstants';

interface RecipeFaqWidgetProps {
  beverageType: BeverageType;
  isSafeBacksweetening: boolean;
  isColdCrashEnabled: boolean;
  batchSizeLiters: number;
  wizardSweetness: string;
}

export const RecipeFaqWidget: React.FC<RecipeFaqWidgetProps> = ({
  beverageType,
  isSafeBacksweetening,
  isColdCrashEnabled,
  batchSizeLiters,
  wizardSweetness
}) => {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (beverageType !== 'Mead') return null;

  const sweetnessLvl = SWEETNESS_LEVELS.find(s => s.id === wizardSweetness);
  const targetSweetFg = sweetnessLvl ? sweetnessLvl.minFg : 1.000;
  const points = Math.max(0, Math.round((targetSweetFg - 1.000) * 1000));
  
  const erythritolGrams = Math.round(batchSizeLiters * points * 2.5);
  const dextroseGrams = Math.round(batchSizeLiters * 6.5);

  const toggleOpen = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqItems = [
    {
      title: t('Why do I start with less water than my target batch size?'),
      content: t(
        'Honey takes up physical space. 1kg of honey displaces approximately 0.7 liters of volume. If your target is {{liters}}L, you cannot start with {{liters}}L of water. You must start with less water, dissolve the honey, and then top it up with cold water to reach exactly {{liters}}L.',
        { liters: batchSizeLiters }
      )
    },
    {
      title: t('Why don\'t we boil the honey (No-Boil)?'),
      content: t('Heating honey above 45°C irreversibly destroys beneficial enzymes (diastase, invertase) and evaporates delicate floral aromatics (monoterpenes, esters). Instead, we heat water to 40-45°C, dissolve the honey, and rapidly cool it. This preserves the pure honey profile and prevents caramel/burnt off-flavors.')
    },
    {
      title: t('Why do we chill so fast and shake the fermenter?'),
      content: t('A rapid chill with a wort chiller prevents wild bacteria from taking over. Shaking the must vigorously for 10 minutes introduces oxygen, which yeast desperately need during their initial growth phase to build strong cell walls (sterol synthesis).')
    },
    {
      title: t('Why do we rehydrate and temper the yeast?'),
      content: t('Dry yeast cells are fragile. Go-Ferm provides essential sterols and vitamins. We rehydrate at 40°C, wait 15 minutes, and then slowly mix in small amounts of cold must every 5 minutes (tempering). This prevents a temperature shock that could kill half your yeast colony before fermentation even begins.')
    },
    {
      title: t('Why do I need to degas before adding nutrients?'),
      content: t('During fermentation, CO2 dissolves into the liquid. If you dump dry nutrient powder (Fermaid O) directly into it, it acts as thousands of nucleation points, causing a massive foam volcano. Always stir gently to release gas first!')
    },
    {
      title: t('When is fermentation actually finished?'),
      content: t('Fermentation is done when the specific gravity reaches 1.000 and does not change for 48 hours. The waiting period after reaching 1.000 is crucial: the yeast enter a "cleanup phase" where they re-absorb harsh off-flavors (fusel alcohols) created during active fermentation.')
    }
  ];

  if (isColdCrashEnabled) {
    faqItems.push({
      title: t('What is a Cold Crash?'),
      content: t('Moving the fermenter to a cold environment (2-4°C) for 3-5 days. This puts the yeast to sleep, causing them to drop out of suspension like a stone, resulting in a crystal-clear mead.')
    });
  }

  if (isSafeBacksweetening) {
    faqItems.push({
      title: t('How is the Erythritol and Dextrose calculated?'),
      content: t(
        'This is the Safe Backsweetening logic for a {{liters}}L batch:\n\nDextrose (Carbonation): We need ~6.5g per liter for a sparkling champagne-like carbonation (2.5 vols CO2). {{liters}}L * 6.5g = {{dextroseGrams}}g.\n\nErythritol (Sweetness): It takes ~2.5g of Erythritol per liter to raise the gravity by 0.001 points. To reach a "{{sweetness}}" profile ({{targetFg}} FG) from 1.000 FG, we need {{points}} points. {{liters}}L * {{points}} * 2.5g = {{erythritolGrams}}g.\n\nWARNING: You must boil this syrup for sterility, but COOL IT TO ROOM TEMPERATURE before mixing. Hot syrup will kill the yeast needed for carbonation!',
        { 
          liters: batchSizeLiters, 
          sweetness: t(`constants.sweetness.${wizardSweetness}`) || sweetnessLvl?.name || 'Sweet', 
          targetFg: targetSweetFg.toFixed(3),
          points: points,
          dextroseGrams, 
          erythritolGrams 
        }
      )
    });
  }

  return (
    <section className="builder-section builder-section--faq">
      <div className="builder-section__header">
        <h2 className="builder-section__title">
          <FaQuestionCircle /> {t('Recipe Science & FAQ')}
        </h2>
      </div>
      <div className="builder-section__body" style={{ padding: 0, background: 'transparent', border: 'none' }}>
        <div className="faq-accordion">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`faq-accordion__item ${isOpen ? 'faq-accordion__item--open' : ''}`}
                style={{ 
                  background: 'var(--bg-card)', 
                  marginBottom: '8px', 
                  borderRadius: '8px', 
                  border: '1px solid var(--border-color)',
                  overflow: 'hidden'
                }}
              >
                <button
                  type="button"
                  className="faq-accordion__header"
                  onClick={() => toggleOpen(index)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <span>{item.title}</span>
                  {isOpen ? <FaChevronUp style={{ color: 'var(--text-secondary)' }} /> : <FaChevronDown style={{ color: 'var(--text-secondary)' }} />}
                </button>
                {isOpen && (
                  <div 
                    className="faq-accordion__content" 
                    style={{ 
                      padding: '0 16px 16px 16px', 
                      color: 'var(--text-secondary)',
                      lineHeight: '1.6',
                      fontSize: '14px',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};