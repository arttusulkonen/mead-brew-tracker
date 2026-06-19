export const knowledgeBase = JSON.stringify([
  {
    "referenceId": "traditional_session_noboil",
    "name": "Modern No-Boil Session Mead",
    "style": "traditional",
    "abvCategory": "session",
    "targetFg": 1.027,
    "boilProtocol": "No-Boil",
    "coreRules": [
      "Запрещено нагревать выше 60°C",
      "Остановка брожения на FG 1.027 через Cold Crash",
      "Пастеризация 65°C 15 мин вместо праймера"
    ],
    "steps": [
      { "phase": "Preparation", "title": "Растворение мёда", "description": "Нагреть воду до 40-45°C. Внести мёд и тщательно перемешать. Запрещается кипятить сусло." },
      { "phase": "Preparation", "title": "Аэрация", "description": "Остудить до 18-20°C. В течение 5 минут проводить интенсивную аэрацию (взбалтывать) для насыщения кислородом." },
      { "phase": "Preparation", "title": "Засев дрожжей", "description": "Регидрировать дрожжи с Go-Ferm при 35°C. Провести темперирование до разницы <5°C. Внести в ферментер." },
      { "phase": "Fermentation", "title": "Брожение и TOSNA", "description": "Вносить Fermaid O на 24ч, 48ч, 72ч и 1/3 Sugar Break. Обязательно дегазировать перед внесением!" },
      { "phase": "Fermentation", "title": "Cold Crash", "description": "При достижении FG 1.027 прервать брожение. Поместить в 1-4°C на 48-72 часа." },
      { "phase": "Aging", "title": "Розлив", "description": "Декантировать. Разлить по бутылкам. Одну порцию разлить в ПЭТ-бутылку для контроля давления. Праймер НЕ добавлять!" },
      { "phase": "Aging", "title": "Карбонизация и Пастеризация", "description": "Как только ПЭТ-бутылка станет каменной, поместить стеклянные бутылки в водяную баню при 65°C на 15 минут. Медленно остудить." }
    ]
  },
  {
    "referenceId": "session_hopped_sweet",
    "name": "Session Sweet Hopped Mead",
    "style": "session_hopped",
    "abvCategory": "session",
    "targetFg": 1.027,
    "boilProtocol": "Boil (60m)",
    "coreRules": [
      "Мёд вносится до кипячения",
      "Кипячение 60 минут с Magnum",
      "Вирпул 80°C с EKG для аромата"
    ],
    "steps": [
      { "phase": "Preparation", "title": "Гидрохимия и Мёд", "description": "Внести минеральные соли в воду. Нагреть до 50-60°C, растворить мёд избегая пригорания." },
      { "phase": "Preparation", "title": "Кипячение (Bittering)", "description": "Довести до кипения. Снять белковую пену. Внести горький хмель (Magnum) на 60 минут." },
      { "phase": "Preparation", "title": "Позднее охмеление (Flavor)", "description": "За 15 минут до конца кипячения внести хмель на вкус (EKG)." },
      { "phase": "Preparation", "title": "Вирпул (Aroma)", "description": "Отключить нагрев, охладить до 80°C. Внести хмель на аромат (EKG). Выдержать воронку 20 минут." },
      { "phase": "Preparation", "title": "Охлаждение и Аэрация", "description": "Охладить до 18°C. Снять с бруха в ферментер. Интенсивно аэрировать 5 минут." },
      { "phase": "Preparation", "title": "Засев дрожжей", "description": "Регидрировать дрожжи с Go-Ferm. Провести темперирование и внести в сусло." },
      { "phase": "Fermentation", "title": "Протокол TOSNA", "description": "Температура 18-20°C. Вносить питание Fermaid O порциями по графику, предварительно дегазируя сусло." },
      { "phase": "Fermentation", "title": "Cold Crash", "description": "При падении плотности до 1.027 охладить ферментер до 1-4°C на 48-72 часа." },
      { "phase": "Aging", "title": "Розлив", "description": "Снять с осадка. Разлить без добавления праймера (использовать ПЭТ-бутылку как манометр)." },
      { "phase": "Aging", "title": "Пастеризация", "description": "При достижении рабочего давления пастеризовать стекло в воде 65°C ровно 15 минут." }
    ]
  }
]);