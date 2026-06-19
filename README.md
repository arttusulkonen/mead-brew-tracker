Production-Grade System Architecture & Technical Specification: Mead & Brew Tracker PWA1. Архитектура коллекций Firestore (Firestore Collection Architecture)В системе используется гибридный дизайн базы данных для обеспечения максимальной производительности, горизонтальной масштабируемости и высокой скорости индексации. Глобальный каталог верхнего уровня выступает в роли мастер-реестра эталонного сырья, тогда как изолированные пространства пивоварен содержат локальные складские запасы, технологические рецепты и динамические сессии варок.Для предотвращения дублирования записей при конкурентных запросах на добавление сырья, документы внутри подколлекции /inventory используют детерминированный ID, строго эквивалентный ingredientId из глобального каталога./ingredients {Глобальный мастер-каталог шаблонов сырья}
└─ itemId {Документ: Характеристики конкретного сорта меда/дрожжей/хмеля}

/recipes {Сохраненные технологические карты (идеальные шаблоны)}
└─ recipeId {Документ рецепта со структурированными шагами и фазами, привязанный к breweryId}

/breweries {Изолированные или совместные рабочие пространства пивоварен}
└─ breweryId {Документ пивоварни}
├─ /inventory {Локальный склад остатков. ID документа = ingredientId}
│ └─ ingredientId {Документ: количество в наличии, единица измерения}
│
└─ /sessions {Активные и исторические варки (живой журнал-регистратор)}
└─ sessionId {Документ: текущий статус, целевой ABV (Session Mead vs Wine), фактический объем}
├─ /fermentation_logs {Подколлекция периодических измерений брожения}
│ └─ logId {Документ: плотность, pH, температура, маркеры событий}
│
└─ /timeline_events {Подколлекция динамических шагов текущей варки}
└─ eventId {Документ: фактические таймеры, флаги выполнения, отклонения}
Реляционное сопоставление и составные индексы (Composite Indexes)Для выполнения сложного аналитического анализа без падения производительности чтения в Firestore настроены следующие составные индексы:Индекс Активных Сессий (Active Sessions Index):Коллекция: sessions (Группа коллекций)Поля: breweryId (Ascending), status (Ascending), startedAt (Descending)Назначение: Обеспечивает мгновенный рендеринг главного экрана с запущенными процессами.Хронологический Индекс Логов (Chronological Log Index):Коллекция: fermentation_logs (Группа коллекций)Поля: sessionId (Ascending), loggedAt (Descending)Назначение: Позволяет последовательно извлекать точки данных для отрисовки многоосевых графиков брожения.Индекс Генеалогии Партий (Parent-Child Ancestry Index):Коллекция: sessions (Группа коллекций)Поля: parentSessionId (Ascending), splitTimestamp (Ascending)Назначение: Восстанавливает древовидную структуру происхождения разделенных батчей (Split-Batch) в интерфейсе.2. Интерфейсы TypeScript (TypeScript Interfaces)export type IngredientCategory =
| 'Honey'
| 'Yeast'
| 'Hops'
| 'Water Profile'
| 'Additive';

export type UnitType =
| 'g'
| 'kg'
| 'L'
| 'ml'
| 'oz'
| 'lb'
| 'gal'
| 'ppm'
| 'unit';

export interface BaseIngredient {
id: string;
name: string;
category: IngredientCategory;
notes?: string;
origin?: string;
updatedAt: string;
createdBy?: string;
}

export interface HoneyIngredient extends BaseIngredient {
category: 'Honey';
sugarContentBrix: number;
moistureContentPct: number;
}

export interface YeastIngredient extends BaseIngredient {
category: 'Yeast';
tempMinC: number;
tempMaxC: number;
alcoholTolerancePct: number;
nitrogenDemand: 'Low' | 'Medium' | 'High' | 'Very High';
}

export interface HopsIngredient extends BaseIngredient {
category: 'Hops';
alphaAcidPct: number;
}

export interface WaterProfileIngredient extends BaseIngredient {
category: 'Water Profile';
calciumPpm: number;
magnesiumPpm: number;
sodiumPpm: number;
sulfatePpm: number;
chloridePpm: number;
bicarbonatePpm: number;
}

export interface AdditiveIngredient extends BaseIngredient {
category: 'Additive';
additiveType:
| 'Nutrient'
| 'Spice'
| 'Fruit'
| 'Clarifier'
| 'Stabilizer'
| 'Acid';
dosagePer10Liters?: number;
dosagePerGramYeast?: number;
}

export type IngredientUnion =
| HoneyIngredient
| YeastIngredient
| HopsIngredient
| WaterProfileIngredient
| AdditiveIngredient;

export interface WorkspaceInventoryItem {
id: string;
breweryId: string;
ingredientId: string;
quantityOnHand: number;
unit: UnitType;
batchLotNumber?: string;
expirationDate?: string;
}

export interface PopulatedInventoryItem extends WorkspaceInventoryItem {
ingredient: IngredientUnion;
}

export interface RecipeIngredientReference {
id: string;
globalIngredientId: string;
name: string;
category: IngredientCategory;
quantity: number;
note: string;
}

export type StepPhase = 'Preparation' | 'Fermentation' | 'Aging';
export type TimeUnit = 'minutes' | 'days';

export interface RecipeStep {
id: string;
stepNumber: number;
phase: StepPhase;
title: string;
description: string;
durationValue: number;
durationUnit: TimeUnit;
targetTempC: number | null;
}

export interface IdealTargetCurves {
tempTargetC: number;
tempBufferMax: number;
tempBufferMin: number;
phCurvePoints: {
relativeDay: number;
targetPh: number;
phBufferMax: number;
phBufferMin: number;
};
}

export interface Recipe {
id: string;
breweryId: string;
name: string;
expectedBatchSizeLiters: number;
targetOriginalGravity: number;
targetFinalGravity: number;
targetAbv: number;
ingredients: RecipeIngredientReference[];
steps: RecipeStep[];
targetCurves?: IdealTargetCurves;
createdAt: string;
updatedAt: string;
createdBy: string;
}

export type BrewSessionStage =
| 'planned'
| 'fermenting'
| 'aging'
| 'completed';

export type MeadStyleTarget =
| 'Session (4-6%)'
| 'Standard (7-10%)'
| 'Wine/Sack (11%+)'
| 'Custom';

export interface BrewLog {
id: string;
timestamp: string;
dayNumber: number;
sg: number | null;
ph: number | null;
tempC: number | null;
notes: string;
actionTaken: string;
}

export interface BrewSession {
id: string;
recipeId: string | null;
breweryId: string;
recipeName: string;
status: BrewSessionStage;
targetStyle?: MeadStyleTarget;
batchSizeLiters: number;
targetOg: number;
targetFg: number;
logs: BrewLog[];
startDate: string;
completedDate: string | null;
createdAt: string;
updatedAt: string;
createdBy: string;
} 3. Математическое ядро и расчетные формулы (Calculation Engine)3.1 Физика объемов (Volume Physics)Алгоритм вычисляет общий объем жидкости до начала кипения (Pre-boil Volume), учитывая испарение воды (Boil-off rate) и физический объем, занимаемый растворенным сахаром (Плотность мёда $\approx 1.42$ кг/л).В случае современного охмеленного "No-Boil" метода (где кипятится только вода с хмелем, а мёд растворяется при $50^\circ C$), потери на выкипание рассчитываются только для водной матрицы.Формула: Объем воды + (Масса мёда / 1.42) = Целевой объем + Объем выкипания.3.2 Конвертация Плотности и Уровня АлкоголяЗащита от микро-отрицательных значений:$$\text{Brix} = \max\left(0, 135.997 \times SG^3 - 630.272 \times SG^2 + 1111.14 \times SG - 616.868\right)$$Высокоточная нелинейная модель Крауча:$$ABV = \left[ \frac{76.08 \times (OG - FG)}{1.775 - OG} \right] \times \left( \frac{FG}{0.794} \right)$$3.3 Протокол питания дрожжей (TOSNA 3.0 Protocol)Динамический расчет общего органического азота с учетом средневзвешенного Brix медовой базы:$$M_{\text{Ferm-O}} = \left( \frac{\text{Brix}_{\text{weighted}} \times 10 \times N_{\text{factor}}}{50} \right) \times V_{\text{gal}}$$4. Дневник Брожения и Интерактивный Ассистент (Live Fermentation Feedback)В фазе fermenting приложение выполняет роль цифрового технолога. При вводе каждого нового лога (Температура, Плотность, pH), система мгновенно пропускает данные через детерминированный движок правил:Контроль TOSNA: Если введенная плотность ($SG$) пересекает расчетную отметку $1/3$ сахарного разлома, интерфейс выдает зеленый Alert: "Точка разлома достигнута. Внесите финальную порцию Fermaid-O".Контроль pH: Если введенный $pH$ опускается ниже 3.2, появляется красный Alert: "Критический уровень кислотности. Дрожжи могут уснуть. Рекомендуется внесение бикарбоната калия".Визуализация (Graphing): Все данные накладываются на интерактивный график AdvancedFermentationChart. Целевые кривые температуры и плотности для конкретного стиля (Session Mead 4-6%) отображаются полупрозрачным "коридором" (shading), чтобы оператор визуально видел, идет ли варка по идеальному плану.5. Интеграция ИИ: Умный Технолог (Google Genkit AI Assistant)В платформу интегрирован AI-ассистент, использующий технологию RAG (Retrieval-Augmented Generation) для создания идеальных рецептур и анализа процесса.5.1 Smart Recipe Wizard (Генератор Рецептов)Пользователь использует UI-визард для задания желаемых параметров медовухи (Итоговый объем, Крепость %, Горечь, Сладость, Вкусовой профиль).Math-to-AI Pipeline: Приложение самостоятельно проводит точные расчеты физических объемов (количество воды с учетом выкипания и плотности мёда) и передает эти жесткие числа в промпт. ИИ запрещено пересчитывать математику — он обязан встроить предоставленные цифры в генерируемый JSON массив шагов.5.2 База Знаний и Строгие Правила (RAG)Для устранения "галлюцинаций" ИИ модель использует локальную базу знаний:recipes.json: Массив эталонных рецептов (Классическая, Гречишная, с еловыми побегами, охмеленная Session Hopped Mead) для предоставления контекста (Few-Shot Prompting).mead_rules.md: Жестко прописанный протокол технологических процессов. ИИ обязан знать правильную последовательность: гидрохимия -> кипячение воды с хмелем -> растворение мёда без кипячения (No-Boil) -> охлаждение -> внесение дрожжей -> брожение с дегазацией по TOSNA 2.0/3.0.5.3 Предиктивный анализ броженияЕсли детерминированные правила показывают, что показатели в норме, но плотность не падает 3 дня, по кнопке "Спросить ИИ" модель анализирует весь массив логов конкретной сессии и предлагает нестандартные решения для возобновления брожения.6. Жизненный цикл ветвления партий (Advanced Split-Batch Lifecycle)Дочерние сессии при сплите полностью наследуют родительские метаданные и глубоко копируют исторический массив /fermentation_logs строго до метки времени splitTimestamp. После фиксации транзакции логирование партий разветвляется и протекает абсолютно изолированно.
