# 🍯 Ingria Brewcraft PWA

**Production-Grade System Architecture & Technical Specification**

Профессиональное PWA-приложение для пивоваров и медоваров. Платформа обеспечивает полный цикл производства: от строгого складского учета и конструирования рецептов (с математическим ядром TOSNA 3.0) до "живого" трекинга брожения, ветвления партий (Split-Batch) и AI-аналитики на базе архитектуры RAG.

## 🛠 Технологический стек

- **Frontend:** React 19, TypeScript, Vite, Zustand (State Management), React Router.
- **Backend/DB:** Supabase (PostgreSQL, Auth, RLS, Edge Functions).
- **Math Engine:** `@mead-tracker/math` (изолированный monorepo-пакет).
- **AI & Analytics:** Google Genkit, Gemini 3.1 Flash (RAG Pipeline).
- **UI/UX:** Mobile-First, SCSS (БЭМ-методология, CSS-переменные), Recharts (аналитика брожения).
- **Localization:** i18next (автоматизированный пайплайн перевода).

---

## 🏗 1. Глобальная структура проекта и зоны ответственности файлов

Проект организован по принципам Monorepo и Feature-Sliced Design.

```text
/mead-brew-tracker-pwa
├── packages/
│   └── math/src/index.ts       # Независимое математическое ядро
├── supabase/
│   └── functions/              # Backend (Edge Functions)
└── src/
    ├── components/             # Изолированные UI-компоненты и виджеты
    ├── pages/                  # Страницы-оркестраторы (Smart Components)
    ├── store/                  # Глобальные контроллеры состояний (Zustand)
    ├── types/                  # TypeScript интерфейсы и контракты данных
    ├── utils/                  # Утилиты (BJCP, форматирование)
    └── styles/                 # Глобальные SCSS-стили

```

### 📁 `src/pages/` — Страницы-оркестраторы

_Отвечают за связывание глобальных сторов, бизнес-логики и UI-компонентов._

- **`Recipes.tsx`**: Конструктор рецептов (Recipe Builder). Управляет стейтом `useRecipeBuilderState`, собирает ингредиенты, вызывает AI для генерации шагов (через Edge Functions).
- **`RecipeDetails.tsx`**: Режим просмотра рецепта (Read-only). Высчитывает спецификации (ABV, IBU, EBC), отображает превью расписания TOSNA.
- **`BrewSessionSetup.tsx`**: Экран запуска варки. **Ключевые функции**:
- `handleScaleVolume`: пропорциональный пересчет ингредиентов при изменении объема.
- `generateSmartSteps`: автоматическое добавление шагов (Dry Hop) на основе ингредиентов.
- Формирует объект `tosna_schedule` и списывает ингредиенты со склада перед созданием записи в БД.

- **`BrewSession.tsx`**: Dashboard активной варки. Рендерит график брожения (`Recharts`), таймлайн шагов, виджет TOSNA и журнал логов (SG/pH/Temp).

### 📁 `src/components/` — Умные и глупые виджеты

- **`TosnaTracker.tsx`**: Вычисляет время, прошедшее с момента начала брожения (`pitchTimestamp`), высчитывает 1/3 Sugar Break и управляет состояниями "OVERDUE" / "Done" для 4 этапов внесения подкормки.
- **`TimelineWidget.tsx`**: Отрисовывает этапы (`VALID_PHASES`: Preparation, Mashing, Boiling, Fermentation, Conditioning, Packaging). Управляет `ActiveTimer` для текущего шага.
- **`MeasurementBottomSheet.tsx`**: UI для добавления записей (логов) в дневник ферментации с привязкой к активному шагу.
- **`IngredientEditorModal.tsx`**: Универсальная форма добавления ингредиента из `globalCatalog` или создания кастомного.

---

## 🗄 2. Глобальное состояние (Zustand Stores)

_Логика работы с API (Supabase) вынесена в специализированные хранилища `src/store/`._

- **`useSessionStore.ts`**: Оркестратор варок.
- `fetchSessionById()`: Вытаскивает сессию из `brew_sessions` и логи из `daily_fermentation_logs`, собирая их в единый объект `currentSession`.
- `addLogToSession()`: Пишет лог в БД. Автоматически сжимает расписание TOSNA (`isCompressed: true`), если достигнут 1/3 Sugar Break.
- `updateSessionStatus()`: Переводит варку по стадиям (`Brew Day` -> `Fermentation` -> `Conditioning` -> `Bottled`). Автоматически фиксирует `pitchTimestamp` при старте брожения.

- **`useInventoryStore.ts`**: Складской учет.
- `consumeIngredients()`: Транзакционное списание ингредиентов по их `inventoryItemId` при старте варки. Защищает от ухода остатков в минус.

- **`useRecipeStore.ts`**: CRUD операции для базы рецептов.
- **`useBreweryStore.ts`**: Управление рабочими пространствами (RBAC, invite-система).

---

## 🧮 3. Математическое ядро (`packages/math/src/index.ts`)

_Изолированный TypeScript-пакет без зависимостей от React/Firebase/Supabase._

**Ключевые функции:**

- `estimateOG(batchVolumeLiters, honeyGrams, honeyBrix)`: Прогнозирование начальной плотности.
- `calculateAbvCrouch(og, fg)`: Вычисление крепости по нелинейной модели Крауча.
- `calculateTosna(batchSizeLiters, og, nitrogenDemandFactor)`: Расчет органического азота (Fermaid-O/Go-Ferm) в граммах для 4 этапов.
- `calculateOneThirdSugarBreak(og, targetFg)`: Вычисление точки Specific Gravity, при которой дрожжи съели 33% сахаров.
- `calculateIbuTinseth(...)`: Расчет горечи пива (IBU).
- `estimateSrmMorey(totalMcu)` / `srmToEbc(srm)`: Вычисление цветности.
- `sgToBrix(sg)` / `brixToSg(brix)`: Конвертация шкал плотности.

---

## 🏗 4. Архитектура базы данных (Supabase PostgreSQL)

_Используется гибридный подход: строгие реляционные связи + `JSONB` для гибких вложенных структур._

### Основные таблицы и контракты (см. `src/types/`)

1. **`breweries`**: Рабочие пространства. Изоляция данных через `owner_id` и массив `members` (RLS Policies).
2. **`ingredients`**: Глобальный справочник + кастомные ингредиенты.
3. **`inventory`**: Локальные остатки (`brewery_id` + `ingredient_id` + `quantity_on_hand`).
4. **`recipes`**: Структурированные технологические карты.

- Использует `JSONB` для `ingredients` (`RecipeIngredientReference[]`) и `steps` (`RecipeStep[]`).

5. **`brew_sessions`**: Исторические копии запущенных рецептов.

- Поля: `status` (BrewSessionStage), `actual_batch_size_liters`, `pitch_timestamp`.
- Вложенные `JSONB`: `session_ingredients`, `session_steps`, `tosna_schedule` (расписание добавок с `completedAt`).

6. **`daily_fermentation_logs`**: Реляционная таблица логов.

- Поля: `session_id`, `gravity_reading`, `ph_reading`, `liquid_temperature_c`, `notes`.

---

## 🤖 5. Интеграция ИИ: Edge Functions & RAG

**Расположение**: `supabase/functions/generate-recipe/`

- **`index.ts`**: Точка входа API. Принимает параметры (объем, ABV, ингредиенты). Обращается к Gemini 3.1 Flash. Строго требует JSON-ответ.
- **`mead_rules.ts`**: Системный промпт (Guardrails). Запрещает ИИ пересчитывать вес базовых сахаров. Требует привязывать фазы только к строгим Enum-ам (`Mashing`, `Fermentation` и т.д.), но при этом переводить текст (`title`, `description`) на запрошенный язык пользователя.
- **`knowledge_base.ts`**: Векторная база эталонных стилей (No-Boil Mead, American Pale Ale, Dry Cider) для RAG-контекста.

---

## 🚀 6. Потоки данных (Data Flows)

### Flow 1: Создание варки (BrewSessionSetup -> BrewSession)

1. Пользователь выбирает Рецепт и нажимает "Start Brew".
2. `BrewSessionSetup` масштабирует объемы (`handleScaleVolume`).
3. Формируется расписание `tosna_schedule` (если есть дрожжи и медовуха).
4. `useInventoryStore.consumeIngredients()` списывает граммы со склада.
5. Выполняется `INSERT` в `brew_sessions` с копией всех шагов и ингредиентов (snapshot).
6. Редирект на `/brew/:id`.

### Flow 2: Трекинг TOSNA (TosnaTracker -> useSessionStore -> DB)

1. `TosnaTracker` слушает `currentHours` от `pitchTimestamp`.
2. При нажатии "Record" вызывается `handleTosnaAddition`.
3. `useSessionStore` обновляет `isCompleted: true` внутри `tosna_schedule` (JSONB) и сохраняет это в базу.
4. Параллельно вызывается `addLogToSession`, который пишет запись о внесенной подкормке (и текущий SG) в реляционную таблицу `daily_fermentation_logs`.
