### 🍯 README.md

**Production-Grade System Architecture & Technical Specification**

Профессиональное PWA-приложение, спроектированное специально для создателей традиционных и современных сортов медовухи (Mead) и сидра (Cider). Пивоварение (Beer) поддерживается в качестве дополнительного расширения. Платформа обеспечивает полный цикл производства: от строгого складского учета сырья до "живого" трекинга брожения, управления азотным питанием дрожжей по протоколу TOSNA 3.0, ветвления партий (Split-Batch) и специализированной AI-аналитики на базе архитектуры RAG.

## 🛠 Технологический стек

- **Frontend:** React 19, TypeScript, Vite, Zustand (State Management), React Router.
- **Backend/DB:** Supabase (PostgreSQL, Auth, RLS, Edge Functions).
- **Math Engine:** `@mead-tracker/math` (изолированный monorepo-пакет вычислений плотности, спирта и азота).
- **AI & Analytics:** Google Genkit, Gemini 3.1 Flash (RAG Pipeline, калиброванный под BJCP Mead & Cider).
- **UI/UX:** Mobile-First, SCSS (БЭМ-методология, CSS-переменные), Recharts (аналитика брожения).
- **Localization:** i18next (автоматизированный пайплайн перевода).

---

## 🏗 1. Глобальная структура проекта и зоны ответственности файлов

Проект организован по принципам Monorepo и Feature-Sliced Design.

```text
/mead-brew-tracker-pwa
├── packages/
│   └── math/src/index.ts       # Независимое математическое ядро (TOSNA 3.0, Кислотность, SG/Brix)
├── supabase/
│   └── functions/              # Backend (Edge Functions для AI генерации рецептов)
└── src/
    ├── components/             # UI-виджеты (TosnaTracker, Timeline, BottomSheet)
    ├── pages/                  # Страницы-оркестраторы (Smart Components)
    ├── store/                  # Глобальные контроллеры состояний (Zustand)
    ├── types/                  # TypeScript интерфейсы и контракты данных (строгая типизация)
    ├── utils/                  # Утилиты (BJCP Match Engine, константы медоварения)
    └── styles/                 # Глобальные SCSS-стили (БЭМ, без Tailwind inline-стилей)

```

### 📁 `src/pages/` — Страницы-оркестраторы

_Отвечают за связывание глобальных сторов, бизнес-логики и UI-компонентов._

- **`Recipes.tsx`**: Конструктор рецептов (Recipe Builder). Управляет стейтом `useRecipeBuilderState`, собирает ингредиенты, вызывает AI для генерации шагов (через Edge Functions) с упором на медовые и яблочные сусла.
- **`RecipeDetails.tsx`**: Режим просмотра рецепта (Read-only). Высчитывает спецификации (ABV, цвет, плотность), отображает выделенный интерактивный блок-превью расписания TOSNA 3.0.
- **`BrewSessionSetup.tsx`**: Экран запуска варки. **Ключевые функции**:
- `handleScaleVolume`: пропорциональный пересчет ингредиентов при изменении объема.
- Очищен от автогенерации лишних таймлайн-шагов; вместо этого формирует чистый объект `tosna_schedule` в базу данных.
- Находит точное соответствие сырья на складе и производит транзакционное списание.

- **`BrewSession.tsx`**: Dashboard активной варки. Рендерит график брожения (`Recharts`), таймлайн шагов, виджет TOSNA и журнал логов (SG/pH/Temp).

### 📁 `src/components/` — Умные и глупые виджеты

- **`TosnaTracker.tsx`**: Независимый интерактивный модуль управления питанием медовухи. Отслеживает время от фактического засева дрожжей (`pitchTimestamp`), рассчитывает точку 1/3 Sugar Break. Содержит встроенную форму инлайн-фиксации плотности и заметок при внесении подкормки, исключающую ручной переход в другие вкладки.
- **`TimelineWidget.tsx`**: Отрисовывает этапы (`VALID_PHASES`: Preparation, Mashing, Boiling, Fermentation, Conditioning, Packaging). Управляет `ActiveTimer` для текущего шага.
- **`MeasurementBottomSheet.tsx`**: UI для добавления записей (логов) в дневник ферментации с привязкой к активному шагу.

---

## 🗄 2. Глобальное состояние (Zustand Stores)

_Логика работы с API (Supabase) вынесена в специализированные хранилища `src/store/`._

- **`useSessionStore.ts`**: Оркестратор варок.
- `fetchSessionById()`: Вытаскивает сессию из `brew_sessions` и логи из `daily_fermentation_logs`, собирая их в единый объект `currentSession`.
- Автоматически нормализует старые текстовые статусы (`planned`, `fermenting`) к новым типам (`Brew Day`, `Fermentation`).
- Безопасно обновляет `tosna_schedule` (JSONB) без мутации стейта реактивно и с жесткой привязкой к `.eq('brewery_id', breweryId)`.

- **`useInventoryStore.ts`**: Складской учет. Списание ингредиентов по их `inventoryItemId` при старте варки с защитой от ухода остатков в минус.
- **`useRecipeStore.ts`**: CRUD операции для базы рецептов.
- **`useBreweryStore.ts`**: Управление рабочими пространствами (RBAC, invite-система).

---

## 🧮 3. Математическое ядро (`packages/math/src/index.ts`)

_Изолированный TypeScript-пакет без зависимостей от React, выступающий стандартом для фронтенда и облачных функций._

**Ключевые функции медоварения и сидроделия:**

- `calculateTosna(batchSizeLiters, og, nitrogenDemandFactor)`: Динамический расчет точных дозировок Fermaid-O и Go-Ferm на основе взвешенного Brix и потребностей штамма дрожжей.
- `calculateOneThirdSugarBreak(og, targetFg)`: Вычисление критической точки плотности (33% падения сахаров), после которой внесение азота запрещено (чтобы не кормить стороннюю микрофлору).
- `estimateOG(batchVolumeLiters, honeyGrams, honeyBrix)`: Прогнозирование начальной плотности сусла.
- `calculateAbvCrouch(og, fg)`: Нелинейная модель Крауча для точного расчета ABV на высоких плотностях (вплоть до 1.160 SG).

---

## 🏗 4. Архитектура базы данных (Supabase PostgreSQL)

_Используется гибридный подход: строгие реляционные связи + `JSONB` для гибких вложенных структур._

1. **`breweries`**: Рабочие пространства. Изоляция данных через `owner_id` и массив `members` (RLS Policies).
2. **`ingredients`**: Глобальный справочник сырья с расширенными полями для медов и соков.
3. **`inventory`**: Локальные остатки (`brewery_id` + `ingredient_id` + `quantity_on_hand`).
4. **`recipes`**: Структурированные технологические карты. Хранит вложенные шаги и ингредиенты в `JSONB`.
5. **`brew_sessions`**: Исторические копии запущенных рецептов.

- Поля: `status` (строгий Enum `BrewSessionStage`), `actual_batch_size_liters`, `pitch_timestamp`, `tosna_schedule` (структурированный JSONB со статусами добавок).

6. **`daily_fermentation_logs`**: Реляционная таблица логов, связанная с сессией по внешнему ключу.

---

## 🤖 5. Интеграция ИИ: Edge Functions & RAG

**Расположение**: `supabase/functions/generate-recipe/`

- **`index.ts`**: Точка входа API. Принимает параметры (объем, ABV, ингредиенты). Обращается к Gemini 3.1 Flash. Строго требует JSON-ответ.
- **`mead_rules.ts`**: Системный промпт (Guardrails). Запрещает ИИ пересчитывать вес базовых сахаров. **Новое правило:** Запрещено дробить TOSNA на отдельные шаги в общем массиве — ИИ генерирует один шаг Fermentation, ссылаясь на внешний виджет. Запрещено предлагать кипячение меда или яблочного сока.
- **`knowledge_base.ts`**: Векторная база эталонных стилей BJCP (Mead/Cider) для RAG-контекста.

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
