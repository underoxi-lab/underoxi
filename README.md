# UNDEROXI Site

Сайт ванильного Minecraft сервера UNDEROXI.

## 🔐 Безопасная серверная авторизация

Раньше пароль владельца хранился в клиентском JavaScript (в виде массива чисел) и проверялся в браузере. Это было небезопасно.

**Текущая архитектура:**
- Пароль владельца хранится только в виде bcrypt хеша на сервере (Vercel)
- Проверка пароля происходит на сервере через API `/api/login`
- После успешного входа создаётся сессия с HttpOnly cookie
- Все действия панели (добавление/удаление участников) проходят через сервер с проверкой сессии
- Данные команды записываются в GitHub через API с использованием Personal Access Token

## 🏗 Архитектура

```
Frontend (HTML/CSS/JS) ──→ Vercel Serverless Functions ──→ GitHub API
  (GitHub Pages)              │                              │
                              │                              └── team-data.json
                              ├── /api/login (POST)
                              ├── /api/logout (POST)
                              ├── /api/verify-session (GET)
                              └── /api/team-data (GET/POST)
```

## 📁 Структура проекта

```
/
├── index.html              # Главная страница
├── team.html               # Страница команды + панель владельца
├── rules.html              # Правила
├── how-to-join.html        # Как попасть
├── how-to-apply.html       # Как подать заявку
├── support.html            # Поддержка
├── site-base.css           # Общие стили
├── team-data.json          # Данные команды (локальная копия)
│
├── api/
│   ├── _session.js         # Модуль управления сессиями (in-memory)
│   ├── login.js            # POST /api/login — вход владельца
│   ├── logout.js           # POST /api/logout — выход
│   ├── verify-session.js   # GET /api/verify-session — проверка сессии
│   └── team-data.js        # GET/POST /api/team-data — чтение/запись команды
│
├── scripts/
│   └── hash-password.js    # Скрипт для генерации bcrypt хеша пароля
│
├── vercel.json             # Конфигурация Vercel
├── package.json            # Зависимости Node.js
├── .env.example            # Пример переменных окружения
└── .gitignore
```

## 🚀 Быстрый старт (локальная разработка)

```bash
# 1. Установи зависимости
npm install

# 2. Сгенерируй bcrypt хеш пароля владельца
npm run hash-password

# 3. Скопируй .env.example в .env и заполни
cp .env.example .env

# 4. Установи Vercel CLI (если ещё не установлен)
npm install -g vercel

# 5. Запусти локальный сервер Vercel
vercel dev
```

## ☁️ Деплой на Vercel

### Шаг 1: Подготовка

1. Убедись, что у тебя есть аккаунт на [Vercel](https://vercel.com)
2. Установи Vercel CLI: `npm install -g vercel`
3. Войди в аккаунт: `vercel login`

### Шаг 2: Настройка переменных окружения

На Vercel нужно установить следующие переменные окружения (Secrets):

| Переменная | Описание | Где взять |
|-----------|----------|-----------|
| `OWNER_PASSWORD_HASH` | bcrypt хеш пароля владельца | `npm run hash-password` |
| `GITHUB_TOKEN` | GitHub Personal Access Token | GitHub Settings → Developer settings |
| `GITHUB_REPO` | Репозиторий (например, `username/underoxi-site`) | Твой GitHub репозиторий |
| `GITHUB_FILE_PATH` | Путь к файлу данных (по умолч. `team-data.json`) | Опционально |
| `GITHUB_BRANCH` | Ветка (по умолч. `main`) | Опционально |

**Установка через Vercel CLI:**
```bash
vercel secrets add owner-password-hash "твой_bcrypt_хеш"
vercel secrets add github-token "твой_github_token"
```

**Установка через Dashboard Vercel:**
1. Зайди в проект на vercel.com
2. Settings → Environment Variables
3. Добавь все переменные из `.env.example`

### Шаг 3: GitHub Personal Access Token

1. Зайди в GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Нажми "Generate new token"
3. Укажи имя (например, "underoxi-site-deploy")
4. Repository access: выбери **Only select repositories** → выбери свой репозиторий
5. Permissions → Contents: **Read and write**
6. Создай токен и скопируй его
7. Установи как `GITHUB_TOKEN` на Vercel

### Шаг 4: Деплой

```bash
# Деплой на Vercel
vercel --prod
```

Или подключи GitHub репозиторий к Vercel через Dashboard:
1. На vercel.com нажми "Add New → Project"
2. Импортируй свой GitHub репозиторий
3. Добавь переменные окружения
4. Нажми "Deploy"

## 🔑 Как задать новый пароль владельца

```bash
# Запусти скрипт генерации хеша
npm run hash-password

# Введи новый пароль (он не будет отображаться на экране)
# Скопируй полученный хеш

# Обнови переменную окружения на Vercel:
vercel secrets rm owner-password-hash
vercel secrets add owner-password-hash "новый_bcrypt_хеш"

# Передеплой
vercel --prod
```

## 🔒 Безопасность

- **Пароль не хранится в открытом виде** — только bcrypt хеш на сервере
- **HttpOnly cookie** — JavaScript в браузере не может прочитать session_id
- **Rate limiting** — не более 5 попыток входа за 15 минут
- **Валидация данных** — все поля проверяются на сервере
- **GitHub токен** — хранится только на сервере, не доступен клиенту
- **Сессия истекает** через 24 часа
- **Выход из аккаунта** уничтожает сессию на сервере

## 🧪 Проверка безопасности

После деплоя проверь:

1. **Пароль нельзя найти в исходном коде:**
   - Открой DevTools → Sources → проверь все JS файлы
   - Пароля нигде не должно быть

2. **Нельзя получить доступ к панели через консоль:**
   - В консоли браузера нет функции `verifyOwnerPassword`
   - Нет переменной `potato` с паролем

3. **API защищён:**
   - `POST /api/team-data` без cookie возвращает 401
   - `POST /api/team-data` с неверной cookie возвращает 401

4. **Выход работает:**
   - После вызова `/api/logout` панель недоступна
   - Cookie очищается

## 📝 Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `api/_session.js` | **Новый** — модуль управления сессиями (создание, проверка, удаление) |
| `api/login.js` | **Новый** — эндпоинт входа с bcrypt проверкой и rate limiting |
| `api/logout.js` | **Новый** — эндпоинт выхода с уничтожением сессии |
| `api/verify-session.js` | **Новый** — эндпоинт проверки сессии |
| `api/team-data.js` | **Переписан** — теперь использует сессию для авторизации, пишет в GitHub через API |
| `api/verify-owner.js` | **Удалён** — заменён на login.js с bcrypt |
| `team.html` | **Изменён** — удалена переменная `potato` и функция `verifyOwnerPassword`; весь JS переписан на серверную авторизацию |
| `vercel.json` | **Новый** — конфигурация Vercel с переменными окружения |
| `package.json` | **Обновлён** — добавлены зависимости и скрипты |
| `.env.example` | **Новый** — пример переменных окружения |
| `scripts/hash-password.js` | **Новый** — скрипт для генерации bcrypt хеша |
| `README.md` | **Обновлён** — полная документация |

## 🛠 Технологии

- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Backend:** Vercel Serverless Functions (Node.js)
- **Хеширование:** bcryptjs (12 rounds)
- **Сессии:** In-memory (с истечением 24ч)
- **Хранение данных:** GitHub API (Contents API)
- **Хостинг:** Vercel (frontend + serverless functions)