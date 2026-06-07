### 📝 README.md

# Production-Grade System Architecture & Technical Specification

## 1. Архитектура коллекций Firestore (Firestore Collection Architecture)

В системе используется гибридный дизайн базы данных для обеспечения максимальной производительности, масштабируемости и высокой скорости индексации. Корневой каталог общего уровня выступает в роли глобального реестра стандартного сырья, в то время как изолированные рабочие пространства пользователей содержат локальные складские остатки, рецепты и динамические сессии брожения.

Использование изолированных подколлекций для ежедневных логов измерений и событий таймлайна гарантирует, что размер отдельного документа варки (`brew_session`) никогда не превысит лимит Firestore в 1 МБ в процессе долгосрочного созревания продукта.

```
/ingredients {Глобальный мастер-каталог сырья}
   └─ itemId {Документ: Шаблон ингредиента}

/breweries {Изолированные или совместные рабочие пространства}
   └─ breweryId {Документ}
       ├─ /inventory {Локальный склад остатков конкретной пивоварни}
       │   └─ inventoryId {Документ: Ссылка на id глобального шаблона + количество}
       │
       ├─ /recipes {Сохраненные шаблоны рецептов пространства}
       │   └─ recipeId {Документ}
       │
       └─ /brew_sessions {Активные и исторические варки}
           └─ sessionId {Документ: Метаданные, текущий объем, ссылки происхождения партии}
               ├─ /fermentation_logs {Подколлекция периодических измерений параметров}
               │   └─ logId {Документ: Плотность, pH, Температура, заметки}
               │
               └─ /timeline_events {Подколлекция шагов технологического процесса варки}
                   └─ eventId {Документ: Выполненные этапы технологического дня}

```

### Реляционное сопоставление и составные индексы (Composite Indexes)

Для выполнения сложного аналитического анализа без падения производительности чтения в Firestore настроены следующие составные индексы:

1. **Индекс Активных Сессий (Active Sessions Index):**

- **Коллекция:** `brew_sessions` (Группа коллекций)
- **Поля:** `workspaceId` (Ascending), `status` (Ascending), `startedAt` (Descending)
- **Назначение:** Обеспечивает мгновенный рендеринг дашборда активных варок в реальном времени.

2. **Хронологический Индекс Логов (Chronological Log Index):**

- **Коллекция:** `fermentation_logs` (Группа коллекций)
- **Поля:** `sessionId` (Ascending), `loggedAt` (Descending)
- **Назначение:** Позволяет последовательно извлекать точки данных для отрисовки графиков Recharts.

3. **Индекс Генеалогии Партий (Parent-Child Ancestry Index):**

- **Коллекция:** `brew_sessions` (Группа коллекций)
- **Поля:** `parentSessionId` (Ascending), `splitTimestamp` (Ascending)
- **Назначение:** Восстанавливает древовидную структуру происхождения разделенных партий (Split-Batch) в интерфейсе.

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
  ingredientId: string;
  quantity: number;
  unit: UnitType;
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
  targetCurves?: IdealTargetCurves;
  instructions: string;
  createdAt: string;
}

export type BrewSessionStage =
  | 'Planning'
  | 'Primary Fermentation'
  | 'Secondary/Aging'
  | 'Packaging/Bottling'
  | 'Completed';

export interface BrewSession {
  id: string;
  recipeId: string | null;
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
}

export interface TimelineEvent {
  id: string;
  sessionId: string;
  stepIndex: number;
  stepName: string;
  scheduledDurationMinutes: number;
  completedAt: string | null;
  actualDurationSeconds: number | null;
  actualTemperatureReachedC: number | null;
  actualWeightAddedG: number | null;
  isCompleted: boolean;
  notes?: string;
}

export interface FermentationLog {
  id: string;
  sessionId: string;
  loggedAt: string;
  specificGravity: number;
  brix: number;
  ph: number | null;
  liquidTempC: number | null;
  ambientTempC: number | null;
  bubblesPerMinute: number | null;
  krausenLevelMm: number | null;
  actionTaken?: string;
  notes?: string;
}
```

---

## 3. Математическое ядро и расчетные формулы (Calculation Engine)

Все вычисления осуществляются на стороне клиента для обеспечения мгновенного отклика интерфейса без выполнения лишних сетевых запросов.

### 3.1 Конвертация Плотности (Specific Gravity vs. Brix)

Стандартные линейные формулы аппроксимации создают критическую погрешность при высоких начальных плотностях плотного сусла медов. Система использует полиномиальное уравнение третьего порядка для точной конвертации измеренной ареометром плотности ($SG$) в шкалу Brix ($^\circ\text{Bx}$):

$$Brix = 135.997 \times SG^3 - 630.272 \times SG^2 + 1111.14 \times SG - 616.868$$

Обратная конвертация из Brix в удельный вес ($SG$) выполняется по верифицированной кривой:

$$SG = 1.00001 + \frac{Brix}{258.6 - 0.89 \times Brix}$$

### 3.2 Высокоточный расчет уровня алкоголя (ABV Crouch Model)

Базовые линейные формулы существенно занижают выход этанола в крепких средах, поскольку этанол имеет плотность ниже, чем у чистой воды ($\approx 0.794\text{ г/мл}$ при $20^\circ\text{C}$). Платформа применяет нелинейную физико-химическую модель Крауча:

$$ABV = \left[ \frac{76.08 \times (OG - FG)}{1.775 - OG} \right] \times \left( \frac{FG}{0.794} \right)$$

### 3.3 Калькулятор протокола питания дрожжей (TOSNA 3.0 Protocol)

Модуль рассчитывает ступенчатое внесение органического азота (на примере Fermaid-O) в зависимости от гидромодуля и дефицита питательных веществ в натуральном меде.

1. **Целевой уровень усвояемого азота (Target YAN):**
   Необходимая концентрация азота вMust ($mg/L$ или $ppm$) рассчитывается исходя из плотности сахаров ($Brix$) и индивидуального коэффициента азотной потребности конкретного штамма дрожжей ($N_{\text{factor}}$):

$$YAN_{\text{needed}} = Brix \times 10 \times N_{\text{factor}}$$

- Low Demand (e.g., Lalvin D47, EC-1118) $\implies N_{\text{factor}} = 0.75$
- Medium Demand (e.g., Lalvin 71B) $\implies N_{\text{factor}} = 0.90$
- High Demand / Very High $\implies N_{\text{factor}} = 1.25$

2. **Норма засева дрожжей и регидрация Go-Ferm:**
   Вес сухих дрожжей ($M_{\text{yeast}}$) динамически масштабируется в зависимости от начальной плотности ($OG$) сусла на объем партии в галлонах ($V_{\text{gal}} = V_{\text{liters}} \times 0.264172$):

- Если $OG < 1.100 \implies R_{\text{pitch}} = 1.0\text{ г/гал}$
- Если $1.100 \le OG < 1.130 \implies R_{\text{pitch}} = 2.0\text{ г/гал}$
- Если $1.130 \le OG < 1.160 \implies R_{\text{pitch}} = 3.0\text{ г/гал}$
- Если $OG \ge 1.160 \implies R_{\text{pitch}} = 4.0\text{ г/гал}$

$$M_{\text{yeast}} = R_{\text{pitch}} \times V_{\text{gal}}$$

Препарат для защиты клеток при регидрации Go-Ferm рассчитывается в строгой пропорции:

$$M_{\text{GoFerm}} = 1.25 \times M_{\text{yeast}}$$

3. **Суммарный объем Fermaid-O и Ступенчатый График (Staggered Nutrient Additions):**
   Полная масса подкормки Fermaid-O ($M_{\text{Ferm-O}}$, в граммах) на всю сессию составляет:

$$M_{\text{Ferm-O}} = \left( \frac{Brix \times 10 \times N_{\text{factor}}}{50} \right) \times V_{\text{gal}}$$

Делитель 50 учитывает повышенную в 4 раза эффективность усвоения чистого органического азота по сравнению с минеральными солями (DAP). Весь объем делится на **4 равные порции (по 25%)** и вносится по таймеру:

- **Доза 1:** Через 24 часа после внесения дрожжей.
- **Доза 2:** Через 48 часов после внесения дрожжей.
- **Доза 3:** Через 72 часа после внесения дрожжей.
- **Доза 4:** Наступает при прохождении точки $1/3$ сахарного разлома ($\text{SG}_{1/3}$) или на 7-й день брожения (в зависимости от того, что наступит раньше).

$$\text{SG}_{1/3} = OG - \frac{OG - FG_{\text{target}}}{3}$$

---

## 4. Жизненный цикл ветвления партий (Advanced Split-Batch Lifecycle)

Система исключает использование плоских линейных списков варок, реализуя древовидную структуру направленного графа. При выполнении операции разделения (`Split Batch`) дочерняя сессия полностью наследует всю историческую хронологию измерений и логов родителя до момента разветвления, после чего начинает полностью изолированный учет параметров (например, при добавлении фруктов в часть партии на вторичное брожение).

```
                       │
                       │ Оператор инициирует "Split Batch"
                       ▼

                       │
                       ├─► Родительский батч (Остается сухим контролем)
                       │     - Объем = (Старый Объем - Объем Сплита)
                       │
                       └─► Дочерний батч (Уходит на мацерацию ягод)
                             - Записывает parentSessionId
                             - Клонирует логи /fermentation_logs до текущей даты
                             - Получает новые уникальные итерации логов

```

### Пошаговый конвейер транзакции ветвления:

1. **Валидация объемов:** Система проверяет остаток объема родительского сусла. Запрос отклоняется, если объем сплита превышает или равен текущему физическому объему емкости.
2. **Атомарная транзакция в БД:**

- В документе родителя уменьшается поле `actualBatchSizeLiters` и в массив `childSessionIds` добавляется ID нового батча.
- Создается новый документ в коллекции `/brew_sessions` с заполнением полей `parentSessionId` и `splitTimestamp`.

3. **Глубокое копирование логов:** Специализированный серверный скрипт или пакетная операция Firestore находит все документы в подколлекции `/fermentation_logs` родителя, у которых `loggedAt <= splitTimestamp`, и дублирует их структуры данных в подколлекцию дочерней сессии, сохраняя точность графиков аналитики.
