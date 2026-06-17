# Production-Grade System Architecture & Technical Specification: Mead & Brew Tracker PWA

## 1. Архитектура коллекций Firestore (Firestore Collection Architecture)

В системе используется гибридный дизайн базы данных для обеспечения максимальной производительности, горизонтальной масштабируемости и высокой скорости индексации. Глобальный каталог верхнего уровня выступает в роли мастер-реестра эталонного сырья, тогда как изолированные пространства пивоварен содержат локальные складские запасы, технологические рецепты и динамические сессии варок.

Для предотвращения дублирования записей при конкурентных запросах на добавление сырья, документы внутри подколлекции `/inventory` используют **детерминированный ID**, строго эквивалентный `ingredientId` из глобального каталога.

```text
/ingredients {Глобальный мастер-каталог шаблонов сырья}
   └─ itemId {Документ: Характеристики конкретного сорта меда/дрожжей/хмеля}

/recipes {Сохраненные технологические карты (идеальные шаблоны)}
   └─ recipeId {Документ рецепта со структурированными шагами и фазами, привязанный к breweryId}

/breweries {Изолированные или совместные рабочие пространства пивоварен}
   └─ breweryId {Документ пивоварни}
       ├─ /inventory {Локальный склад остатков. ID документа = ingredientId}
       │   └─ ingredientId {Документ: количество в наличии, единица измерения}
       │
       └─ /brew_sessions {Активные и исторические варки (живой журнал-регистратор)}
           └─ sessionId {Документ: текущий статус, фактический объем, ссылки генеалогии}
               ├─ /fermentation_logs {Подколлекция периодических измерений брожения}
               │   └─ logId {Документ: плотность, pH, температура, маркеры событий}
               │
               └─ /timeline_events {Подколлекция динамических шагов текущей варки}
                   └─ eventId {Документ: фактические таймеры, флаги выполнения, отклонения}

```

### Реляционное сопоставление и составные индексы (Composite Indexes)

Для выполнения сложного аналитического анализа без падения производительности чтения в Firestore настроены следующие составные индексы:

1. **Индекс Активных Сессий (Active Sessions Index):**

- **Коллекция:** `brew_sessions` (Группа коллекций)
- **Поля:** `breweryId` (Ascending), `status` (Ascending), `startedAt` (Descending)
- **Назначение:** Обеспечивает мгновенный рендеринг главного экрана с запущенными процессами.

2. **Хронологический Индекс Логов (Chronological Log Index):**

- **Коллекция:** `fermentation_logs` (Группа коллекций)
- **Поля:** `sessionId` (Ascending), `loggedAt` (Descending)
- **Назначение:** Позволяет последовательно извлекать точки данных для отрисовки многоосевых графиков брожения.

3. **Индекс Генеалогии Партий (Parent-Child Ancestry Index):**

- **Коллекция:** `brew_sessions` (Группа коллекций)
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

export interface BrewSession {
  id: string;
  recipeId: string | null; // Null in Freestyle Mode
  breweryId: string;
  parentSessionId: string | null;
  childSessionIds: string[];
  status: BrewSessionStage;
  actualBatchSizeLiters: number;
  actualOriginalGravity: number | null;
  actualFinalGravity: number | null;
  actualAbv: number | null;
  startedAt: string;
  completedAt: string | null;
  splitTimestamp: string | null;
  // Snapshot of ingredients and steps used in THIS specific session (Flight Recorder)
  sessionIngredients: RecipeIngredientReference[];
  sessionSteps: RecipeStep[];
}
```

---

## 3. Математическое ядро и расчетные формулы (Calculation Engine)

### 3.1 Конвертация Плотности (Specific Gravity vs. Brix)

Для предотвращения падения математических значений в отрицательный диапазон вблизи чистой воды ($SG = 1.000$) из-за полиномиальных флуктуаций, результаты расчетов принудительно зажимаются оператором `Math.max(0, ...)`:

$$\text{Brix} = \max\left(0, 135.997 \times SG^3 - 630.272 \times SG^2 + 1111.14 \times SG - 616.868\right)$$

Конвертация из шкалы Brix в удельный вес ($SG$):

$$SG = 1.00001 + \frac{\text{Brix}}{258.6 - 0.89 \times \text{Brix}}$$

### 3.2 Средневзвешенный расчет Brix по массе (Weighted Average Brix)

При использовании в одном рецепте нескольких видов меда с разными показателями сахаристости, обычное арифметическое среднее приводит к критическим ошибкам расчета плановой плотности. Система вычисляет точный средневзвешенный показатель на основе массы каждого ингредиента:

$$\text{Brix}_{\text{weighted}} = \frac{\sum_{i=1}^{n} \left(\text{Brix}_i \times M_i\right)}{\sum_{i=1}^{n} M_i}$$

Где $M_i$ — масса конкретного внесения меда в граммах.

### 3.3 Высокоточный расчет уровня алкоголя (ABV Crouch Model)

$$ABV = \left[ \frac{76.08 \times (OG - FG)}{1.775 - OG} \right] \times \left( \frac{FG}{0.794} \right)$$

### 3.4 Протокол питания дрожжей (TOSNA 3.0 Protocol)

$$\text{YAN}_{\text{needed}} = \text{Brix}_{\text{weighted}} \times 10 \times N_{\text{factor}}$$

Суммарный вес Fermaid-O ($M_{\text{Ferm-O}}$, в граммах) на объем сусла в галлонах ($V_{\text{gal}}$):

$$M_{\text{Ferm-O}} = \left( \frac{\text{Brix}_{\text{weighted}} \times 10 \times N_{\text{factor}}}{50} \right) \times V_{\text{gal}}$$

---

## 4. Концепция Цифрового Двойника: Рецепт vs. Реальность

Система строго разделяет понятия **Идеального Плана** (Recipe) и **Фактического Журнала** (Brew Session / Flight Recorder).

### 4.1 Жизненный цикл сессии (Continuous Lifecycle)

Варка — это непрерывный процесс. Сессия проходит через строгие статусы:

1. **Brew Day:** Активные счетчики времени, транзакционное списание ингредиентов со склада, внесение поправок в реальном времени.
2. **Primary Fermentation:** Таймеры останавливаются. Открывается доступ к графику многоосевой аналитики (SG/pH/Temp), активируются алерты протокола TOSNA.
3. **Secondary/Aging:** Редкие логи снятия с осадка.
4. **Packaging:** Фиксация итогового объема, расчет потерь (Trub loss). Сессия архивируется.

### 4.2 Свободный режим варки (Freestyle / Quick Brew)

Оператор может начать варку без предварительно созданного рецепта. В этом режиме сессия инициализируется как пустой холст. Оператор динамически добавляет ингредиенты и шаги прямо в процессе (записывая время добавления меда, нагрева воды и т.д.). По завершении варки или успешной дегустации, этот фактический слепок может быть сохранен в БД как новый эталонный Рецепт через функцию `Save as New Recipe`.

### 4.3 Клонирование и масштабирование (Clone & Scale)

Любую исторически успешную сессию варки (даже если она сильно отклонилась от изначального рецепта) можно повторить. При вызове функции `Brew Again`, система берет **фактические данные** прошлой сессии, запрашивает новый целевой объем ферментера и пропорционально пересчитывает массы ингредиентов и тайминги, создавая новую независимую сущность `BrewSession`.

---

## 5. Интеграция ИИ: Умный Технолог (Google Genkit AI Assistant)

В платформу интегрирован AI-ассистент на базе Google Genkit, использующий технологию RAG (Retrieval-Augmented Generation) для формирования рецептов и анализа брожения.

### 5.1 Генерация рецептов через естественный язык

Пользователь формирует запрос (Prompt): _"У меня есть 3кг цветочного меда и дрожжи S-04. Хочу сделать традиционную сладкую славянскую медовуху с легкой газацией на 12 литров"_.

1. **Контекст (RAG):** Система скармливает AI-модели текущий массив `globalCatalog` (чтобы ИИ использовал реальные ID и свойства ингредиентов из базы) и профили эталонных рецептов.
2. **Структурированный вывод (JSON Generation):** Genkit возвращает валидный JSON, соответствующий интерфейсу `Recipe` (включая рассчитанные шаги варки, температурные паузы и граммовки).
3. Рецепт мгновенно рендерится в UI с возможностью ручной корректировки перед сохранением.

### 5.2 Предиктивный анализ брожения

AI-ассистент имеет доступ к хронологическому массиву `/fermentation_logs`. При обнаружении стагнации плотности (Stalled Fermentation) или критическом падении pH, модель анализирует график и предлагает оператору корректирующие действия (например, внесение бикарбоната калия для выравнивания pH или изменение температурного режима).

---

## 6. Жизненный цикл ветвления партий (Advanced Split-Batch Lifecycle)

Дочерние сессии при сплите полностью наследуют родительские метаданные и глубоко копируют исторический массив `/fermentation_logs` строго до метки времени `splitTimestamp`. После фиксации транзакции логирование партий разветвляется и протекает абсолютно изолированно.

```text
                       │
                       │ Оператор инициирует "Split Batch"
                       ▼
                       │
                       ├─► Родительская емкость (Control batch)
                       │     - Объем = (Старый Объем - Объем Сплита)
                       │
                       └─► Дочерняя емкость (Experimental batch)
                             - Наследует parentSessionId
                             - Дублирует логи до отметки splitTimestamp
                             - Ведет изолированный журнал (мацерация, щепа и др.)

```
