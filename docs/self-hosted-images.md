## Self-Hosted Image CDN

### Переменные окружения

| Переменная | Назначение | Значение по умолчанию |
|------------|------------|------------------------|
| `IMAGE_STORAGE_ROOT` | Путь до каталога с оригиналами (`/var/www/images`) | `./storage/images` |
| `IMAGE_CDN_BASE_URL` | Публичный домен Cloudflare/Nginx (`https://img.example.com`) | **обязательно задать** |
| `IMAGE_PUBLIC_PATH` | Путь раздачи оригиналов через Nginx | `/images` |
| `IMAGINARY_RESIZE_PATH` | Endpoint, проксирующий Imaginary | `/cdn/resize` |
| `IMAGE_MAX_UPLOAD_MB` | Лимит размера файла | `20` |
| `IMAGE_DOWNLOAD_TIMEOUT_MS` | Таймаут загрузки из Telegram/Cloudinary | `20000` |
| `IMAGE_UPLOAD_BASIC_USER`/`IMAGE_UPLOAD_BASIC_PASS` | Доступ к веб-панели (Basic Auth) | _нет_ |
| `IMAGE_UPLOAD_TOKEN` | Альтернативный Bearer-token для API | _нет_ |
| `IMAGE_UPLOAD_LOG` | Файл логов ручных загрузок | `/var/log/img-upload.log` |
| `IMAGE_PREVIEW_WIDTH`, `IMAGE_CARD_WIDTH`, `IMAGE_FULL_WIDTH` | Ширина предустановок CDN | `320 / 640 / 1280` |

### Архитектура

1. **Nginx** раздаёт `IMAGE_PUBLIC_PATH` напрямую из `IMAGE_STORAGE_ROOT` и проксирует `/cdn/` к локальному Imaginary.
2. **Imaginary** доступен только через Nginx (сам слушает на `localhost:9001`). Все вызовы вида  
   `https://img.domain/cdn/resize?width=640&url=https://img.domain/images/...` кэшируются Cloudflare минимум на 30 дней.
3. **Cloudflare** обслуживает домен `img.<domain>` и кеширует `/images/*` и `/cdn/*`.

#### Пример блока Nginx

```nginx
server {
    listen 80;
    server_name img.example.com;

    location /images/ {
        root /var/www;
        autoindex off;
        add_header Cache-Control "public, max-age=2592000";
    }

    location /cdn/ {
        proxy_pass http://127.0.0.1:9001/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

### Imaginary

Установите бинарь и поднимите как systemd-сервис:

```ini
[Service]
ExecStart=/usr/local/bin/imaginary \
  -enable-url-source \
  -allow-hardware-acceleration \
  -concurrency 4 \
  -max-bytes 20971520 \
  -max-height 4320 \
  -max-width 4320 \
  -listen localhost:9001
User=www-data
Group=www-data
```

### Веб-панель /upload

- Защитите Basic Auth на уровне переменных `IMAGE_UPLOAD_BASIC_USER/PASS` **или** используйте Bearer token.
- В панели доступен drag-n-drop, автоматически отображаются `original`, `preview` (320), `card` (640) и `full` (1280) ссылки.
- Логи пишутся в `/var/log/img-upload.log` (или путь из `IMAGE_UPLOAD_LOG`).

### Dev-режим

- Backend автоматически раздаёт `IMAGE_PUBLIC_PATH` из `IMAGE_STORAGE_ROOT`, что позволяет тестировать без Nginx/Cloudflare.
- При прод-сборке обязательно отключите публичный доступ к Express и используйте только Nginx.

### Миграция Cloudinary → локально

1. Заполните `.env` с новыми переменными.
2. Запустите `npm run migrate:thumbnails`.
3. Скрипт обновит `streams.thumbnail_*` и сформирует отчёт `migration-report.json`, например:

```json
{
  "finishedAt": "2025-01-15T10:45:00.000Z",
  "total": 420,
  "migrated": 418,
  "skipped": 1,
  "failed": 1,
  "errors": [
    { "id": 1337, "title": "Новогодний стрим", "error": "Недопустимый формат изображения: gif" }
  ]
}
```

При повторном запуске обрабатываются только записи с `thumbnail_source = 'cloudinary'` или ссылками `res.cloudinary.com`.

### Проверка

- Загрузите файл через `/upload` и убедитесь, что `original` и `optimized` открываются через CDN.
- В ответ Imaginary должен возвращать `CF-Cache-Status: HIT` после прогрева.
- Мини-приложение Telegram теперь использует `thumbnail.variants.card`.

