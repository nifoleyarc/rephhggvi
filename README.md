# 🎬 Архив стримов GENSYXA

**Telegram Mini App для архива стримов** - полностью мигрировано на собственный сервер!

## 🚀 Что изменилось

Проект **полностью переписан** и мигрирован:
- **❌ Vercel** → **✅ Ubuntu сервер**
- **❌ MongoDB** → **✅ SQLite** 
- **❌ Cloudinary** → **✅ S3 cloud.ru**

Все функции сохранились, но теперь всё работает на вашем сервере!

## 📁 Структура проекта

```
├── server.js                  # Главный сервер Express.js
├── server/                    # Серверная часть
│   ├── database/init.js       # База данных SQLite
│   ├── routes/               # API endpoints
│   │   ├── streams.js        # Управление стримами
│   │   ├── categories.js     # Категории
│   │   ├── auth.js          # Авторизация
│   │   ├── webhook.js       # Telegram webhook
│   │   └── thumbnails.js    # Превью изображений
│   └── utils/               # Утилиты
│       ├── s3.js           # Работа с S3 cloud.ru
│       └── thumbnailGenerator.js # Генерация превью
├── src/                      # React фронтенд
├── scripts/                  # Скрипты настройки
├── database.sqlite          # База данных (создаётся автоматически)
└── dist/                    # Собранный фронтенд
```

## ⚙️ Настройка

### 1. Создайте файл `.env`:

```bash
# Telegram Bot
TELEGRAM_BOT_TOKEN="ваш_токен_бота"
TELEGRAM_CHANNEL_USERNAME="@ваш_канал"
ADMIN_USER_ID="ваш_telegram_id"
EDITOR_PASSWORD_HASH="хеш_пароля"

# S3 cloud.ru для превью
S3_ACCESS_KEY_ID="ваш_access_key"
S3_SECRET_ACCESS_KEY="ваш_secret_key"
S3_BUCKET_NAME="bucket-817022"
S3_TENANT_ID="39d7ef97-9d7b-402b-83a9-cdc5a1bda6f4"

# Сервер
PORT=3000
NODE_ENV=production
FRONTEND_URL="http://localhost:3000"

# Webhook (опционально)
WEBHOOK_SECRET="секретный_ключ"
WEBAPP_URL="https://ваш-домен.com"
```

### 2. Установите зависимости:

```bash
npm install
```

### 3. Настройте базу данных:

```bash
npm run setup:database
```

### 4. Перенесите картинки в S3 (если есть старые):

```bash
npm run migrate:images
```

### 5. Соберите фронтенд и запустите:

```bash
npm run build
npm start
```

### 6. Настройте Telegram webhook:

```bash
npm run setup:webhook
```

## 🎯 Основные команды

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск сервера (продакшн) |
| `npm run start:dev` | Запуск в режиме разработки |
| `npm run build` | Сборка фронтенда |
| `npm run setup:database` | Создание базы данных |
| `npm run migrate:images` | Миграция картинок в S3 |
| `npm run upload:frontend` | Загрузка фронтенда в S3 |
| `npm run setup:webhook` | Настройка Telegram webhook |

## 🔧 Дополнительные скрипты

| Команда | Описание |
|---------|----------|
| `npm run setup:password` | Генерация хеша пароля |
| `npm run setup:admin` | Получение Telegram ID |
| `npm run check:webhook` | Проверка статуса webhook |
| `npm run diagnose:webhook` | Диагностика проблем |

## 🚀 Развёртывание на сервере

### 1. Установите PM2 для управления процессами:

```bash
npm install -g pm2
```

### 2. Запустите сервер через PM2:

```bash
pm2 start server.js --name "vod-archive"
pm2 startup
pm2 save
```

### 3. Настройте nginx (опционально):

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📱 Функционал

### ✅ Что работает:
- **Автоматический парсинг** постов из Telegram канала
- **Превью стримов** с автоматической генерацией
- **Категории** по тегам в постах
- **Авторизация админа** через Telegram или пароль
- **Добавление стримов** вручную
- **Responsive дизайн** для всех устройств
- **Защита от взлома** (ограничение попыток входа)

### 🔄 Автопарсер:
Бот автоматически обрабатывает посты из канала если они содержат:
- **Теги** (например: `#just_chatting`, `#игры`, `#фильм`)
- **Дату** в формате `DD.MM.YYYY` или `DD.MM.YY`
- **Превью** извлекается автоматически

### 📂 Категории:
- Общение / Видосы
- ИРЛ стримы  
- Фильмы / Мультики
- Игровые стримы
- Контент
- Марафоны
- Кукинги
- ШОУ

## 🔗 API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/streams` | GET | Получить список стримов |
| `/api/streams` | POST | Добавить новый стрим |
| `/api/streams/:id` | PUT | Обновить стрим |
| `/api/streams/:id` | DELETE | Удалить стрим |
| `/api/categories` | GET | Список категорий |
| `/api/auth` | POST | Авторизация |
| `/api/webhook` | POST | Telegram webhook |
| `/api/refresh-thumbnail` | POST | Обновить превью |

## 🛠️ Разработка

### Структура базы данных:

**streams** - стримы
- id, title, telegram_url, stream_date
- tags (JSON), categories (JSON)  
- thumbnail_url, thumbnail_s3_key
- created_at, updated_at

**categories** - категории
- id, name, tag, description

**auth_attempts** - защита от взлома
- ip, attempts, banned_until

## 📞 Поддержка

Если что-то не работает:

1. **Проверьте логи**: `pm2 logs vod-archive`
2. **Проверьте webhook**: `npm run check:webhook`  
3. **Диагностика**: `npm run diagnose:webhook`
4. **Пересоздайте базу**: `npm run setup:database`

## 🎉 Готово!

Ваш архив стримов теперь работает на собственном сервере с SQLite и S3 хранилищем. Все функции сохранены, но теперь вы полностью контролируете данные и инфраструктуру! 