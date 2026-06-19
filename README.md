## 1. Архитектура коллекций Firestore (Firestore Collection Architecture)

В системе используется гибридный дизайн базы данных для обеспечения максимальной производительности, горизонтальной масштабируемости и высокой скорости индексации. Глобальный каталог верхнего уровня выступает в роли мастер-реестра эталонного сырья, тогда как изолированные пространства пивоварен содержат локальные складские запасы, технологические рецепты и динамические сессии варок.

Для предотвращения дублирования записей при конкурентных запросах на добавление сырья, документы внутри подколлекции `/inventory` используют детерминированный ID, строго эквивалентный `ingredientId` из глобального каталога.

````

```text
File saved successfully as mead_brew_tracker_specification.md

```text
/ingredients {Глобальный мастер-каталог шаблонов сырья}
└─ itemId {Документ: Характеристики конкретного сорта меда/дрожжей/хмеля}

/recipes {Сохраненные технологические карты (идеальные шаблоны)}
└─ recipeId {Документ рецепта со структурированными шагами и фазами, привязанный к breweryId}

/breweries {Изолированные или совместные рабочие пространства пивоварен}
└─ breweryId {Документ пивоварни}
   ├─ /inventory {Локальный склад остатков. ID документа = ingredientId}
   │  └─ ingredientId {Документ: количество в наличии, единица измерения}
   │
   └─ /brew_sessions {Активные и исторические варки (живой журнал-регистратор)}
      └─ sessionId {Документ: текущий статус, целевой ABV (Session Mead vs Wine), фактический объем}
         ├─ /fermentation_logs {Подколлекция периодических измерений брожения}
         │  └─ logId {Документ: плотность, pH, температура, маркеры событий}
         │
         └─ /timeline_events {Подколлекция динамических шагов текущей варки}
            └─ eventId {Документ: фактические таймеры, флаги выполнения, отклонения}

````

### Реляционное сопоставление и составные индексы (Composite Indexes)

Для выполнения сложного аналитического анализа без падения производительности чтения в Firestore настроены следующие составные индексы:

- **Индекс Активных Сессий (Active Sessions Index):**
- **Коллекция:** `sessions` (Группа коллекций)
- **Поля:** `breweryId` (Ascending), `status` (Ascending), `startedAt` (Descending)
- **Назначение:** Обеспевечивает мгновенный рендеринг главного экрана с запущенными процессами.

- **Хронологический Индекс Логов (Chronological Log Index):**
- **Коллекция:** `fermentation_logs` (Группа коллекций)
- **Поля:** `sessionId` (Ascending), `loggedAt` (Descending)
- **Назначение:** Позволяет последовательно извлекать точки данных для отрисовки многоосевых графиков брожения.

- **Индекс Генеалогии Партий (Parent-Child Ancestry Index):**
- **Коллекция:** `sessions` (Группа коллекций)
- **Поля:** `parentSessionId` (Ascending), `splitTimestamp` (Ascending)
- **Назначение:** Восстанавливает древовидную структуру происхождения разделенных батчей (Split-Batch) в интерфейсе.

---

## 2. Интерфейсы TypeScript (TypeScript Interfaces)

```typescript
export type IngredientCategory =
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
  yanValuePerGramPerLiter?: number;
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
  | 'Planning'
  | 'Brew Day'
  | 'Primary Fermentation'
  | 'Secondary/Aging'
  | 'Packaging/Bottling'
  | 'Completed';

export type MeadStyleTarget =
  | 'Session (4-6%)'
  | 'Standard (7-10%)'
  | 'Wine/Sack (11%+)'
  | 'Custom';

export interface BrewSession {
  id: string;
  recipeId: string | null;
  breweryId: string;
  parentSessionId: string | null;
  childSessionIds: string[];
  status: BrewSessionStage;
  targetStyle: MeadStyleTarget;
  actualBatchSizeLiters: number;
  actualOriginalGravity: number | null;
  actualFinalGravity: number | null;
  actualAbv: number | null;
  startedAt: string;
  completedAt: string | null;
  splitTimestamp: string | null;
  sessionIngredients: RecipeIngredientReference[];
  sessionSteps: RecipeStep[];
}
```

---

## 3. Математическое ядро и расчетные формулы (Calculation Engine)

### 3.1 Фокус на Session Mead (Слабоалкогольная медовуха)

Система адаптирует графики и алерты под выбранный `targetStyle`. Для «Традиционной медовухи 4-6%» ($OG \approx 1.035 - 1.050$) точка 1/3 сахарного разлома наступает значительно быстрее (часто на 2-3 день), поэтому система автоматически смещает таймеры протокола TOSNA и требует более раннего внесения питания, чтобы избежать стресса дрожжей.

### 3.2 Конвертация Плотности и Уровня Алкоголя

Защита от микро-отрицательных значений:

$$\text{Brix} = \max\left(0, 135.997 \times SG^3 - 630.272 \times SG^2 + 1111.14 \times SG - 616.868\right)$$

Высокоточная нелинейная модель Крауча:

$$ABV = \left[ \frac{76.08 \times (OG - FG)}{1.775 - OG} \right] \times \left( \frac{FG}{0.794} \right)$$

### 3.3 Протокол питания дрожжей (TOSNA 3.0 Protocol)

Динамический расчет общего органического азота с учетом средневзвешенного Brix медовой базы:

$$M_{\text{Ferm-O}} = \left( \frac{\text{Brix}_{\text{weighted}} \times 10 \times N_{\text{factor}}}{50} \right) \times V_{\text{gal}}$$

---

## 4. Дневник Брожения и Интерактивный Ассистент (Live Fermentation Feedback)

В фазе `Primary Fermentation` приложение выполняет роль цифрового технолога. При вводе каждого нового лога (Температура, Плотность, pH), система мгновенно пропускает данные через детерминированный движок правил:

- **Контроль TOSNA:** Если введенная плотность ($SG$) пересекает расчетную отметку $1/3$ сахарного разлома, интерфейс выдает зеленый Alert: _"Точка разлома достигнута. Внесите финальную порцию Fermaid-O"_.
- **Контроль pH:** Если введенный $pH$ опускается ниже 3.2, появляется красный Alert: _"Критический уровень кислотности. Дрожжи могут уснуть. Рекомендуется внесение бикарбоната калия"_.
- **Визуализация (Graphing):** Все данные накладываются на интерактивный график `AdvancedFermentationChart`. Целевые кривые температуры и плотности для конкретного стиля (Session Mead 4-6%) отображаются полупрозрачным "коридором" (shading), чтобы оператор визуально видел, идет ли варка по идеальному плану.

---

## 5. Интеграция ИИ: Умный Технолог (Google Genkit AI Assistant)

В платформу интегрирован AI-ассистент, использующий технологию RAG (Retrieval-Augmented Generation).

### 5.1 Строгий системный промпт (Session Mead Focus)

AI-модель инициализируется со строгим системным промптом:

> _"Ты — мастер-технолог классических славянских питких медовух (Session Meads). Твоя цель — создание напитков 4-6% ABV, легких, газированных и идеально подходящих под закуски (вяленое мясо, сыры). Не предлагай добавление спирта или создание крепких винных медов, если об этом не просят прямо"._

### 5.2 Предиктивный анализ и генерация

- **Генерация рецептов:** Парсинг запроса (например: _"У меня 3кг меда, хочу 20 литров традиционной легкой газированной медовухи"_) в структурированный JSON формат интерфейса `Recipe`.
- **Анализ стагнации:** Если детерминированные правила (TOSNA/pH) показывают, что показатели в норме, но плотность не падает 3 дня, по кнопке "Спросить ИИ" модель анализирует всю подколлекцию логов и предлагает нестандартные решения (перепад температур, взбалтывание осадка).

---

## 6. Жизненный цикл ветвления партий (Advanced Split-Batch Lifecycle)

Дочерние сессии при сплите полностью наследуют родительские метаданные и глубоко копируют исторический массив `/fermentation_logs` строго до метки времени `splitTimestamp`. После фиксации транзакции логирование партий разветвляется и протекает абсолютно изолированно.
