# Quickstart: локальный CDN для превью стримов

> Руководство рассчитано на новичка. Выполняйте шаги по порядку, не пропускайте проверку после каждого этапа.

---

## 1. Что понадобится

1. **Сервер** с Ubuntu 22.04 (минимум 2 ГБ RAM) и root-доступом через SSH.
2. **Домены**:
   - существующий `gensyxavods.com` оставляем для основного приложения (как есть);
   - покупаем новый `nikothan.com` только под систему изображений:
     - `nikothan.com` (прямой доступ без Cloudflare, проксируется на Node/Express);
     - `img.nikothan.com` (через Cloudflare для CDN и кеша).
3. **Cloudflare** – бесплатный аккаунт, куда добавлен ваш домен.
4. **GitHub токен** (если репозиторий приватный).

---

## 2. Установка базового софта

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl unzip build-essential nginx sqlite3
```

### Node.js + npm

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v
```

---

## 3. Клонирование проекта

```bash
cd /opt
sudo git clone https://github.com/nifoleyarc/rephhggvi.git
sudo chown -R $USER:$USER rephhggvi
cd rephhggvi
npm install
```

Сохраните файл `database.sqlite`, если он был предоставлен.

---

## 4. Настройка переменных окружения

1. Создайте `.env` (если нет – скопируйте пример): `cp .env.example .env`
2. Обязательно заполните:

```dotenv
PORT=3000
FRONTEND_URL=https://nifoleyarc.github.io/rephhggvi

# Telegram / auth (были раньше)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_USERNAME=...
ADMIN_PASSWORD_HASH=...

# Новые переменные для картинок
IMAGE_STORAGE_ROOT=/var/www/images
IMAGE_CDN_BASE_URL=https://img.nikothan.com
IMAGE_PUBLIC_PATH=/images
IMAGINARY_RESIZE_PATH=/cdn/resize
IMAGE_MAX_UPLOAD_MB=20
IMAGE_UPLOAD_BASIC_USER=admin
IMAGE_UPLOAD_BASIC_PASS=сильный_пароль
# По желанию: IMAGE_UPLOAD_TOKEN=длинный_токен
```

Создайте директорию и права:

```bash
sudo mkdir -p /var/www/images
sudo chown -R www-data:www-data /var/www/images
sudo chmod -R 775 /var/www/images
```

---

## 5. Установка Imaginary

1. Скачайте последний релиз (используем ссылку `…/latest/…`, поэтому версия всегда свежая):
   ```bash
   cd /tmp
   curl -L https://github.com/h2non/imaginary/releases/latest/download/imaginary-linux-amd64 -o imaginary
   sudo mv imaginary /usr/local/bin/imaginary
   sudo chmod +x /usr/local/bin/imaginary
   ```
   > Если GitHub заблокирован, зайдите на https://github.com/h2non/imaginary/releases, скачайте нужный файл вручную и перенесите его на сервер (scp).
2. Создайте сервис:
   ```bash
   sudo tee /etc/systemd/system/imaginary.service > /dev/null <<'EOF'
   [Unit]
   Description=Imaginary Image Processing Server
   After=network.target

   [Service]
   ExecStart=/usr/local/bin/imaginary \
     -enable-url-source \
     -allow-hardware-acceleration \
     -concurrency 4 \
     -max-bytes 20971520 \
     -max-height 4320 \
     -max-width 4320 \
     -listen localhost:9001
   Restart=always
   User=www-data
   Group=www-data

   [Install]
   WantedBy=multi-user.target
   EOF

   sudo systemctl daemon-reload
   sudo systemctl enable --now imaginary
   sudo systemctl status imaginary
   ```

---

## 6. Настройка Nginx (nikothan.com + img.nikothan.com)

> У вас уже работает Nginx для `gensyxavods.com`. Он может обслуживать и новый домен, конфликтов не будет: мы просто добавляем два новых server-block’а.

1. Создайте файл `/etc/nginx/sites-available/nikothan` со следующим содержимым:

```nginx
# API и веб-панель (nikothan.com)
server {
    listen 80;
    server_name nikothan.com www.nikothan.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 25m;
}

# Статика и Imaginary (img.nikothan.com)
server {
    listen 80;
    server_name img.nikothan.com;

    # Оригиналы
    location /images/ {
        root /var/www;
        autoindex off;
        add_header Cache-Control "public, max-age=2592000";
    }

    # Проксирование Imaginary
    location /cdn/ {
        proxy_pass http://127.0.0.1:9001/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

2. Подключите конфигурацию и проверяйте:

```bash
sudo ln -s /etc/nginx/sites-available/nikothan /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

3. В DNS панели регистратора создайте A-записи:
   - `nikothan.com` → IP вашего сервера (без прокси);
   - `img.nikothan.com` → тот же IP.

После этого домены будут обслуживаться напрямую вашим Nginx без участия CDN.

---

## 7. HTTPS без CDN (Let’s Encrypt)

Чтобы всё работало по HTTPS, установите certbot и выпустите сертификаты сразу для двух доменов:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d nikothan.com -d www.nikothan.com
sudo certbot --nginx -d img.nikothan.com
```

Certbot автоматически перепишет конфигурацию (`listen 443 ssl`) и настроит автообновление сертификатов. Nginx продолжит обслуживать старый `gensyxavods.com` параллельно.

---

## 8. Запуск backend через PM2

PM2 позволит перезапускать приложение при сбоях, смотреть логи и автозапускать после перезагрузки.

1. Установите PM2 глобально:
   ```bash
   sudo npm install -g pm2
   ```
2. Перейдите в папку проекта и запустите backend:
   ```bash
   cd /opt/rephhggvi
   NODE_ENV=production pm2 start server.js --name vod-backend
   ```
   PM2 сам подхватит переменные из `.env`.
3. Сохраните конфигурацию PM2 и настройте автозапуск:
   ```bash
   pm2 save
   pm2 startup systemd
   # выполните команду, которую PM2 выведет (обычно sudo env PATH=$PATH pm2 startup ...)
   ```
4. Основные команды:
   - `pm2 status` — список процессов;
   - `pm2 logs vod-backend` — онлайн‑логи;
   - `pm2 restart vod-backend` / `pm2 stop vod-backend`.

---

## 9. Проверка API

1. `curl http://localhost:3000/` → должен вернуть `{"message":"Backend status: ok"}`.
2. `curl http://localhost:3000/api/streams` (с авторизацией) → список стримов.
3. Для dev-режима (без Nginx) Express сам отдаёт `/images`, поэтому вы увидите локальные файлы.

---

## 10. Веб-панель загрузки `/upload`

1. Настройте `IMAGE_UPLOAD_BASIC_USER/PASS` (уже сделано в `.env`).
2. Перезапустите сервис backend.
3. Зайдите по адресу `https://nikothan.com/upload` → браузер попросит логин/пароль.
4. Перетащите JPG/PNG/WebP.
5. Панель покажет:
   - `original` – прямой URL (через Cloudflare);
   - `optimized` – пример Imaginary (640px);
   - дополнительные варианты (320/640/1280).
6. В `/var/log/img-upload.log` появится строка со временем, пользователем и путём.

---

## 11. Миграция Cloudinary → локально

1. **Сделайте резервную копию** базы:
   ```bash
   cp database.sqlite database.backup.sqlite
   ```
2. Убедитесь, что новые переменные окружения уже работают (CDN отдаёт файлы).
3. Запустите:
   ```bash
   npm run migrate:thumbnails
   ```
4. Ждите окончания. Итоговый отчёт `migration-report.json` покажет:
   - `migrated` – успешно перенесённые записи;
   - `failed` – ошибки (например, битая ссылка);
   - `skipped` – записи без Cloudinary.
5. После миграции все стримы должны ссылаться на `https://img.nikothan.com/...`.

---

## 12. Telegram мини-приложение

Frontend автоматически берёт `thumbnail.url` → теперь это ваш CDN. Ничего менять не нужно, главное – убедиться, что API выдаёт корректные ссылки.

---

## 13. Мониторинг и обслуживание

| Команда | Назначение |
| --- | --- |
| `pm2 status` / `pm2 logs vod-backend` | состояние и логи backend |
| `journalctl -u imaginary -f` | логи Imaginary |
| `tail -f /var/log/nginx/access.log` | логи Nginx |
| `tail -f /var/log/img-upload.log` | действия из веб-панели |

Проверяйте, что ответы с `img.nikothan.com` содержат заголовок `Cache-Control: public, max-age=2592000` — это значит, что браузеры и промежуточные прокси смогут их кешировать.

---

## 14. Что делать при проблемах

1. **Изображение не открывается** – проверьте, существует ли файл в `/var/www/images/...` и нет ли ошибок разрешений.
2. **Imaginary не отвечает** – `systemctl status imaginary` и `journalctl -u imaginary`.
3. **Cloudflare не кэширует** – убедитесь, что запрос идёт по HTTPS и правила кэширования применены.
4. **Миграция упала** – смотрите `migration-report.json`; можно повторно запустить скрипт, он обработает только Cloudinary-URL.
5. **/upload просит логин бесконечно** – проверьте, что заданы `IMAGE_UPLOAD_BASIC_USER/PASS` и вы вводите правильные данные.

---

Готово! После прохождения всех шагов система перестаёт зависеть от Cloudinary: превью сохраняются локально, оптимизация выполняется Imaginary, а CDN-слои обеспечиваются Cloudflare. Если нужно больше технических деталей, смотрите `docs/self-hosted-images.md`.

