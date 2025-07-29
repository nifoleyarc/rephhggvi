# 🤖 Руководство по работе с Telegram Webhook

Это руководство поможет вам настроить и управлять Telegram webhook для автоматического парсинга постов канала.

## 📋 Быстрые команды

### Обновить webhook одной командой:
```bash
npm run webhook:update
```

### Проверить статус webhook:
```bash
npm run webhook:status
```

### Полная диагностика webhook:
```bash
npm run webhook:diagnostic
```

### Полная настройка (обновить + проверить + протестировать):
```bash
npm run webhook:full
```

## 🔧 Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run webhook:update` | Обновить webhook с текущими настройками |
| `npm run webhook:status` | Проверить текущий статус webhook |
| `npm run webhook:delete` | Удалить webhook |
| `npm run webhook:test` | Протестировать webhook |
| `npm run webhook:full` | Полная настройка (обновить + проверить + протестировать) |
| `npm run webhook:diagnostic` | Детальная диагностика всех компонентов |

## ⚙️ Настройка переменных окружения

Убедитесь, что в файле `.env` установлены следующие переменные:

```env
# Обязательные
TELEGRAM_BOT_TOKEN=your_bot_token_here
WEBHOOK_URL=https://yourdomain.com/api/webhook

# Рекомендуемые
WEBHOOK_SECRET=your_secret_token_here
TELEGRAM_CHANNEL_USERNAME=your_channel_name

# Дополнительные
MINI_APP_URL=https://your-mini-app.com
```

### Где взять TELEGRAM_BOT_TOKEN:
1. Найдите @BotFather в Telegram
2. Отправьте команду `/newbot` или используйте существующий бот
3. Скопируйте токен вида: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

### Как настроить WEBHOOK_URL:
- Для локальной разработки: `http://localhost:3000/api/webhook`
- Для продакшена: `https://yourdomain.com/api/webhook`
- Для Vercel: `https://your-app.vercel.app/api/webhook`

## 🔍 Диагностика проблем

### 1. Webhook не работает
```bash
npm run webhook:diagnostic
```

Этот скрипт проверит:
- ✅ Переменные окружения
- ✅ Доступность бота
- ✅ Настройки webhook
- ✅ Доступность webhook URL
- ✅ Права бота в канале

### 2. Частые проблемы и решения

#### Проблема: "Webhook не установлен"
**Решение:**
```bash
npm run webhook:update
```

#### Проблема: "channel_post не включен в разрешенные обновления"
**Решение:**
```bash
npm run webhook:update
```

#### Проблема: "Webhook URL недоступен"
**Возможные причины:**
- Сервер не запущен
- Неправильный URL
- Проблемы с SSL сертификатом
- Блокировка файрволом

**Решение:**
1. Убедитесь, что сервер запущен
2. Проверьте правильность WEBHOOK_URL
3. Для продакшена используйте HTTPS

#### Проблема: "Бот не является администратором канала"
**Решение:**
1. Добавьте бота в канал как администратора
2. Дайте права "Управление сообщениями"
3. Убедитесь, что TELEGRAM_CHANNEL_USERNAME указан БЕЗ символа @

## 📊 Мониторинг webhook

### Проверка логов
После настройки webhook, посты канала будут автоматически обрабатываться. Проверьте логи:

```bash
# Локальная разработка
npm run start:dev

# Продакшен (Vercel)
# Проверьте логи в Vercel Dashboard → Functions → webhook.js
```

### Проверка статуса
```bash
npm run webhook:status
```

Вы увидите:
- URL webhook
- Количество ожидающих обновлений
- Последние ошибки
- Разрешенные типы обновлений

## 🧪 Тестирование

### Тест webhook
```bash
npm run webhook:test
```

Этот скрипт:
- Проверит доступность webhook URL
- Протестирует подключение к Telegram API
- Покажет информацию о боте

### Тест с реальным постом
1. Опубликуйте пост в канале с тегами (например, `#just_chatting`)
2. Подождите 30 секунд
3. Проверьте логи сервера
4. Проверьте базу данных на наличие нового стрима

## 🔄 Обновление webhook

### При изменении URL
Если вы изменили домен или путь webhook:

1. Обновите WEBHOOK_URL в .env
2. Выполните:
```bash
npm run webhook:update
```

### При изменении настроек
Если нужно изменить параметры webhook (например, добавить секретный токен):

1. Обновите переменные в .env
2. Выполните:
```bash
npm run webhook:full
```

## 🛠️ Ручное управление

### Установка webhook через API
```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://yourdomain.com/api/webhook",
    "allowed_updates": ["channel_post"],
    "max_connections": 40
  }'
```

### Получение информации о webhook
```bash
curl "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getWebhookInfo"
```

### Удаление webhook
```bash
curl -X POST "https://api.telegram.org/bot{YOUR_BOT_TOKEN}/deleteWebhook"
```

## 📝 Логи и отладка

### Включение подробных логов
В файле `server/routes/webhook.js` уже настроено подробное логирование:

```javascript
console.log('📨 Получен webhook от Telegram')
console.log('📋 Тип обновления:', Object.keys(update).join(', '))
```

### Проверка логов в продакшене
- **Vercel**: Dashboard → Functions → webhook.js → Logs
- **Heroku**: `heroku logs --tail`
- **Другие платформы**: Проверьте соответствующие логи

## 🔒 Безопасность

### Рекомендации:
1. **Используйте WEBHOOK_SECRET** для защиты от несанкционированных запросов
2. **Используйте HTTPS** в продакшене
3. **Ограничьте доступ** к webhook endpoint
4. **Мониторьте логи** на подозрительную активность

### Настройка секретного токена:
```env
WEBHOOK_SECRET=your_random_secret_here
```

## 📞 Поддержка

Если у вас возникли проблемы:

1. Запустите диагностику: `npm run webhook:diagnostic`
2. Проверьте логи сервера
3. Убедитесь, что все переменные окружения установлены
4. Проверьте права бота в канале

### Полезные ссылки:
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Webhook Guide](https://core.telegram.org/bots/webhooks)
- [BotFather Commands](https://core.telegram.org/bots#botfather-commands) 