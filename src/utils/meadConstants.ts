export const MEAD_STYLES = [
  { id: 'traditional', name: 'Traditional Mead', boilProtocol: 'No-Boil' },
  { id: 'session_hopped', name: 'Session Hopped Mead', boilProtocol: 'Boil (60m)' },
  { id: 'melomel', name: 'Melomel', boilProtocol: 'No-Boil' },
  { id: 'metheglin', name: 'Metheglin', boilProtocol: 'No-Boil' },
  { id: 'braggot', name: 'Braggot', boilProtocol: 'Boil (60m)' }
];

export const SWEETNESS_LEVELS = [
  { id: 'dry', name: 'Dry (FG: 0.996 - 1.006)', minFg: 0.996, maxFg: 1.006 },
  { id: 'semi_dry', name: 'Semi-Dry (FG: 1.006 - 1.015)', minFg: 1.006, maxFg: 1.015 },
  { id: 'semi_sweet', name: 'Semi-Sweet (FG: 1.015 - 1.025)', minFg: 1.015, maxFg: 1.025 },
  { id: 'sweet', name: 'Sweet (FG: 1.025 - 1.050)', minFg: 1.025, maxFg: 1.050 }
];

export const ABV_RANGES = [
  { id: 'session', name: 'Session (3-6%)', minAbv: 3, maxAbv: 6 },
  { id: 'standard', name: 'Standard (7-10%)', minAbv: 7, maxAbv: 10 },
  { id: 'sack', name: 'Sack (11%+)', minAbv: 11, maxAbv: 20 }
];

export const HONEY_TERROIR = [
  { id: 'linden', name: 'Linden (Липовый)' },
  { id: 'acacia', name: 'Acacia (Акациевый)' },
  { id: 'heather', name: 'Heather (Вересковый)' },
  { id: 'buckwheat', name: 'Buckwheat (Гречишный)' },
  { id: 'wildflower', name: 'Wildflower (Разнотравье)' }
];

export const ADDITIVE_ROLES = [
  { id: 'hops', name: 'Hops', stage: 'Boil/Whirlpool' },
  { id: 'fruit', name: 'Fruit', stage: 'Secondary' },
  { id: 'spices', name: 'Spices', stage: 'Aging' },
  { id: 'woods', name: 'Woods', stage: 'Aging' },
  { id: 'acids', name: 'Acids', stage: 'Bottling' }
];