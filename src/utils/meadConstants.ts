// src/utils/meadConstants.ts

export const MEAD_STYLES = [
  { id: 'traditional', name: 'constants.styles.traditional', boilProtocol: 'No-Boil' },
  { id: 'session_hopped', name: 'constants.styles.session_hopped', boilProtocol: 'No-Boil' }, // Изменили на No-Boil по современным стандартам
  { id: 'melomel', name: 'constants.styles.melomel', boilProtocol: 'No-Boil' },
  { id: 'metheglin', name: 'constants.styles.metheglin', boilProtocol: 'No-Boil' },
  { id: 'braggot', name: 'constants.styles.braggot', boilProtocol: 'Boil (60m)' } // Брэггот варится из-за солода
];

export const SWEETNESS_LEVELS = [
  { id: 'dry', name: 'constants.sweetness.dry', minFg: 0.996, maxFg: 1.006 },
  { id: 'semi_dry', name: 'constants.sweetness.semi_dry', minFg: 1.006, maxFg: 1.015 },
  { id: 'semi_sweet', name: 'constants.sweetness.semi_sweet', minFg: 1.015, maxFg: 1.025 },
  { id: 'sweet', name: 'constants.sweetness.sweet', minFg: 1.025, maxFg: 1.050 }
];

export const ABV_RANGES = [
  { id: 'session', name: 'constants.abv.session', minAbv: 3, maxAbv: 6 },
  { id: 'standard', name: 'constants.abv.standard', minAbv: 7, maxAbv: 10 },
  { id: 'sack', name: 'constants.abv.sack', minAbv: 11, maxAbv: 20 }
];

export const HONEY_TERROIR = [
  { id: 'linden', name: 'constants.honey.linden' },
  { id: 'acacia', name: 'constants.honey.acacia' },
  { id: 'heather', name: 'constants.honey.heather' },
  { id: 'buckwheat', name: 'constants.honey.buckwheat' },
  { id: 'wildflower', name: 'constants.honey.wildflower' }
];

export const ADDITIVE_ROLES = [
  { id: 'hops', name: 'constants.additives.hops', stage: 'Active Fermentation (Biotransformation)' },
  { id: 'fruit', name: 'constants.additives.fruit', stage: 'Secondary' },
  { id: 'spices', name: 'constants.additives.spices', stage: 'Conditioning / Tincture' },
  { id: 'woods', name: 'constants.additives.woods', stage: 'Aging' },
  { id: 'acids', name: 'constants.additives.acids', stage: 'Bottling' }
];

// Обновленные технологические экшены
export const ACTION_CHIPS = [
  { id: 'ACCLIMATIZATION', name: 'constants.actions.acclimatization' },
  { id: 'AERATION', name: 'constants.actions.aeration' },
  { id: 'DEGASSING', name: 'constants.actions.degassing' },
  { id: '2_STEP_TOSNA', name: 'constants.actions.2_step_tosna' },
  { id: '4_STEP_TOSNA', name: 'constants.actions.4_step_tosna' },
  { id: 'COLD_CRASH', name: 'constants.actions.cold_crash' },
  { id: 'RACKING', name: 'constants.actions.racking' },
  { id: 'STABILIZATION', name: 'constants.actions.stabilization' }, // Химическая стабилизация (Сорбат/Сульфит)
  { id: 'BOTTLING', name: 'constants.actions.bottling' }
];