# 🔧 Настройка переменных окружения

## Что нужно настроить для безопасной работы приложения

### 1. Создайте файл `.env` в корне проекта

```bash
# Скопируйте этот шаблон в файл .env
cp ENV_SETUP.md .env
```

### 2. Переменные окружения для сервера

#### ОБЯЗАТЕЛЬНЫЕ переменные:

```env
# ===========================================
# СЕРВЕРНАЯ ЧАСТЬ (server.js)
# ===========================================

# Порт сервера
PORT=3000

# Режим работы (development/production)
NODE_ENV=development

# ===========================================
# БЕЗОПАСНОСТЬ И АУТЕНТИФИКАЦИЯ
# ===========================================

# Telegram Bot Token (получить у @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# ID администратора Telegram (получить командой npm run get:user-id)
ADMIN_USER_ID=your_admin_user_id_here

# Секретный ключ для API (генерируется автоматически или задается вручную)
API_SECRET_KEY=your_secret_api_key_here

# Ключ для доступа к данным с фронтенда (опционально, по умолчанию = API_SECRET_KEY)
FRONTEND_API_KEY=your_frontend_api_key_here

# Хеш пароля для резервного доступа (генерируется командой npm run setup:password)
EDITOR_PASSWORD_HASH=your_password_hash_here

# ===========================================
# ВНЕШНИЕ СЕРВИСЫ
# ===========================================

# Cloudinary для загрузки изображений
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ===========================================
# ФРОНТЕНД (переменные с префиксом VITE_)
# ===========================================

# URL API для фронтенда (НЕ СЕКРЕТ! Попадает в публичный bundle)
# В development автоматически используется http://localhost:3000/api
# В production укажите ваш API домен
VITE_API_URL=https://your-api-domain.com/api

# Ключ для доступа к данным с фронтенда (НЕ СЕКРЕТ! Попадает в публичный bundle)
# Можно использовать тот же ключ что и API_SECRET_KEY или создать отдельный
VITE_FRONTEND_KEY=your_frontend_key_here
```

#### ОПЦИОНАЛЬНЫЕ переменные:

```env
# ===========================================
# СЕТЕВЫЕ НАСТРОЙКИ
# ===========================================

# URL фронтенда (для CORS)
FRONTEND_URL=https://nifoleyarc.github.io/rephhggvi

# Webhook URL для Telegram бота (только для production)
WEBHOOK_URL=https://your-api-domain.com/api/webhook

# Дополнительные IP для whitelist (через запятую, опционально)
# IP_WHITELIST=192.168.1.1,10.0.0.1

# ===========================================
# БАЗА ДАННЫХ
# ===========================================

# SQLite база данных (путь к файлу)
# По умолчанию создается в server/database/streams.db
DATABASE_PATH=server/database/streams.db

# ===========================================
# ДОПОЛНИТЕЛЬНЫЕ НАСТРОЙКИ
# ===========================================

# Включить дополнительное логирование
DEBUG=true

# Максимальный размер файлов для загрузки (в MB)
MAX_FILE_SIZE=10
```

## 3. Настройка для разных сред

### Development (локальная разработка):

```env
NODE_ENV=development
PORT=3000
VITE_API_URL=http://localhost:3000/api
```

### Production (сервер):

```env
NODE_ENV=production
PORT=3000
VITE_API_URL=https://your-api-domain.com/api
WEBHOOK_URL=https://your-api-domain.com/api/webhook
```

## 4. Настройка для GitHub Pages

### Для фронтенда на GitHub Pages:

1. Перейдите в **Settings** вашего репозитория
2. Выберите **Secrets and variables** → **Actions**
3. Добавьте переменные:
   - `VITE_API_URL` со значением вашего API домена
   - `VITE_FRONTEND_KEY` с ключом для доступа к данным

**❗ ВАЖНО**: `VITE_API_URL` и `VITE_FRONTEND_KEY` НЕ являются секретами! Они попадают в публичный bundle фронтенда.

## 5. Команды для настройки

```bash
# Получить ID пользователя Telegram
npm run get:user-id

# Создать хеш пароля для резервного доступа
npm run setup:password

# Генерировать Frontend ключ для доступа к данным
npm run generate:frontend-key

# Проверить API конфигурацию
npm run check:api-config

# Проверить переменные GitHub
npm run check:github-vars

# Настроить webhook для Telegram бота
npm run setup:webhook

# Проверить статус webhook
npm run check:webhook
```

## 6. Проверка безопасности

### Что является секретом:
- ✅ `TELEGRAM_BOT_TOKEN`
- ✅ `API_SECRET_KEY`
- ✅ `EDITOR_PASSWORD_HASH`
- ✅ `CLOUDINARY_API_SECRET`
- ✅ `ADMIN_USER_ID`
- ✅ `FRONTEND_API_KEY` (только серверная)

### Что НЕ является секретом:
- ❌ `VITE_API_URL` (попадает в frontend bundle)
- ❌ `VITE_FRONTEND_KEY` (попадает в frontend bundle)
- ❌ `PORT`
- ❌ `FRONTEND_URL`
- ❌ `CLOUDINARY_CLOUD_NAME`

## 7. Как работает аутентификация

### Способы аутентификации:

1. **Telegram Web App** (основной):
   - Использует `initData` от Telegram
   - Проверяется по `TELEGRAM_BOT_TOKEN`
   - Доступ только для `ADMIN_USER_ID`

2. **API ключ** (для серверных запросов):
   - Заголовок: `Authorization: Bearer YOUR_API_SECRET_KEY`
   - Использует `API_SECRET_KEY`

3. **Пароль** (резервный доступ):
   - Поле `password` в теле запроса
   - Проверяется по `EDITOR_PASSWORD_HASH`

4. **Frontend ключ** (для доступа к данным):
   - Заголовок: `x-frontend-key: YOUR_FRONTEND_KEY`
   - Дополнительная проверка Origin/Referer
   - Используется для GET запросов к данным

### Endpoints с ограниченным доступом:
- `GET /api/streams` - просмотр стримов (требует frontend ключ или проверка origin)
- `GET /api/categories` - просмотр категорий (требует frontend ключ или проверка origin)
- `GET /api/` - проверка статуса (требует frontend ключ или проверка origin)

### Полностью защищенные endpoints:
- `POST/PUT/DELETE /api/streams` - управление стримами
- `POST/PUT/DELETE /api/categories` - управление категориями
- `POST /api/refresh-thumbnails` - обновление превью

## 8. Troubleshooting

### Проблема: "API не подключается"
1. Проверьте, что сервер запущен
2. Убедитесь, что `VITE_API_URL` правильно настроен
3. Проверьте CORS настройки в `server.js`

### Проблема: "Нет доступа к API"
1. Убедитесь, что `ADMIN_USER_ID` правильно настроен
2. Проверьте, что `TELEGRAM_BOT_TOKEN` действителен
3. Убедитесь, что вы запускаете приложение через Telegram

### Проблема: "405 Method Not Allowed" в редакторе
1. Проверьте API конфигурацию: `npm run check:api-config`
2. Убедитесь, что `VITE_API_URL` настроен в GitHub Variables
3. Значение должно быть: `https://gensyxavods.com/api` (НЕ github.io!)
4. Сделайте новый deploy после настройки переменных

### Проблема: "Переменные окружения не загружаются"
1. Убедитесь, что файл `.env` в корне проекта
2. Проверьте, что нет пробелов вокруг `=`
3. Перезапустите сервер после изменения `.env`

### Проблема: "Запросы идут на GitHub Pages вместо API сервера"
1. Проверьте, что используется `API_CONFIG` вместо относительных путей
2. В коде не должно быть: `'/api'` или `'/api/auth'`
3. Должно быть: `API_CONFIG.baseURL + '/auth'` 