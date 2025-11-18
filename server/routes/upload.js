import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { saveUploadedImage, MAX_UPLOAD_SIZE_BYTES, deleteStoredImage } from '../utils/imageStorage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
})

const DEFAULT_LOG_PATH = process.env.NODE_ENV === 'production'
  ? '/var/log/img-upload.log'
  : path.join(__dirname, '../../logs/img-upload.log')
const UPLOAD_LOG_PATH = process.env.IMAGE_UPLOAD_LOG || DEFAULT_LOG_PATH
const PASSWORD_HASH = process.env.IMAGE_UPLOAD_PASSWORD_HASH
const SESSION_TTL_DAYS = parseInt(process.env.IMAGE_UPLOAD_SESSION_TTL_DAYS || '30', 10)
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
const SESSION_COOKIE_NAME = 'upload_session'
const SESSION_TEMP_TTL_MS = 24 * 60 * 60 * 1000 // 24 часа для незапомненных
const sessionStore = new Map()

async function logUpload(event) {
  try {
    await fs.mkdir(path.dirname(UPLOAD_LOG_PATH), { recursive: true })
    await fs.appendFile(UPLOAD_LOG_PATH, JSON.stringify(event) + '\n', { encoding: 'utf8' })
  } catch (error) {
    console.error('Не удалось записать лог загрузки:', error.message)
  }
}

function cleanupSessions() {
  const now = Date.now()
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token)
    }
  }
}

function getSession(req) {
  cleanupSessions()
  const token = req.cookies?.[SESSION_COOKIE_NAME]
  if (!token) return null
  const session = sessionStore.get(token)
  if (!session) return null
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token)
    return null
  }
  return { token, ...session }
}

function issueSession(res, { user = 'uploader', remember = false } = {}) {
  const token = crypto.randomBytes(32).toString('hex')
  const ttl = remember ? SESSION_TTL_MS : SESSION_TEMP_TTL_MS
  sessionStore.set(token, {
    user,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttl
  })

  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ttl
  })
}

function requireSession(req, res, next) {
  const session = getSession(req)
  if (!session) {
    return res.status(401).json({ error: 'Требуется авторизация' })
  }
  req.uploadSession = session
  return next()
}

router.get('/', (req, res) => {
  const session = getSession(req)
  res.type('html').send(renderUploadPage(Boolean(session)))
})

router.post('/login', async (req, res) => {
  try {
    if (!PASSWORD_HASH) {
      return res.status(503).json({ error: 'Пароль не настроен (IMAGE_UPLOAD_PASSWORD_HASH)' })
    }
    const { password, remember } = req.body || {}
    if (!password) {
      return res.status(400).json({ error: 'Введите пароль' })
    }

    const match = await bcrypt.compare(password, PASSWORD_HASH)
    if (!match) {
      return res.status(401).json({ error: 'Неверный пароль' })
    }

    issueSession(res, { remember: Boolean(remember) })
    return res.json({ success: true })
  } catch (error) {
    console.error('Ошибка авторизации загрузчика:', error)
    return res.status(500).json({ error: 'Ошибка сервера' })
  }
})

router.post('/logout', (req, res) => {
  const session = getSession(req)
  if (session) {
    sessionStore.delete(session.token)
  }
  res.clearCookie(SESSION_COOKIE_NAME)
  return res.json({ success: true })
})

router.post('/', requireSession, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не передан' })
  }

  try {
    const stored = await saveUploadedImage(req.file.buffer, req.file.originalname, {
      uploader: req.uploadSession?.user || 'unknown',
      via: 'manual-panel'
    })

    await logUpload({
      at: new Date().toISOString(),
      user: req.uploadSession?.user || 'unknown',
      filename: req.file.originalname,
      bytes: req.file.size,
      publicId: stored.publicId,
      variants: stored.variants
    })

    return res.json({
      original: stored.originalUrl,
      optimized: stored.variants.card,
      variants: stored.variants,
      metadata: {
        width: stored.width,
        height: stored.height,
        format: stored.format,
        bytes: stored.bytes
      },
      publicId: stored.publicId
    })
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error)
    return res.status(400).json({ error: error.message })
  }
})

router.post('/delete', requireSession, async (req, res) => {
  try {
    const { publicId } = req.body || {}

    if (!publicId || typeof publicId !== 'string') {
      return res.status(400).json({ error: 'publicId не указан' })
    }

    const deleted = await deleteStoredImage(publicId)

    if (!deleted) {
      return res.status(404).json({ error: 'Изображение уже удалено или не найдено' })
    }

    await logUpload({
      at: new Date().toISOString(),
      user: req.uploadSession?.user || 'unknown',
      event: 'manual-delete',
      publicId
    })

    return res.json({ success: true })
  } catch (error) {
    console.error('Ошибка удаления загруженного изображения:', error)
    return res.status(500).json({ error: 'Не удалось удалить изображение' })
  }
})

function renderUploadPage(isAuthenticated = false) {
  const maxSizeMb = (MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0)
  const cdnBase = process.env.IMAGE_CDN_BASE_URL || 'https://img.example.com'
  const defaultExample = `${cdnBase}/cdn/resize?width=640&url=${cdnBase}/images/YYYY/MM/DD/<file>`

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Загрузка превью</title>
  <meta name="theme-color" content="#0f172a" />
  <link rel="apple-touch-icon" sizes="180x180" href="/nikothan-favicon/apple-touch-icon.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/nikothan-favicon/favicon-32x32.png" />
  <link rel="icon" type="image/png" sizes="16x16" href="/nikothan-favicon/favicon-16x16.png" />
  <link rel="manifest" href="/nikothan-favicon/site.webmanifest" />
  <link rel="shortcut icon" href="/nikothan-favicon/favicon.ico" />
  <style>
    :root {
      --bg: #0f172a;
      --panel: rgba(15,23,42,0.85);
      --panel-soft: rgba(15,23,42,0.65);
      --border: rgba(148,163,184,0.2);
      --border-strong: rgba(148,163,184,0.38);
      --text: #e2e8f0;
      --text-muted: #94a3b8;
      --accent: #0ea5e9;
      --accent-strong: #38bdf8;
      --success: #10b981;
      --danger: #f87171;
    }

    * {
      box-sizing: border-box;
    }

    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      margin: 0;
      min-height: 100vh;
    }

    body button,
    body input {
      font-family: inherit;
    }

    .hidden {
      display: none !important;
    }

    .upload-shell {
      max-width: 960px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 2rem;
    }

    @media (max-width: 640px) {
      .upload-shell {
        padding: 2rem 1rem;
      }
    }

    .upload-header {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .tagline {
      color: var(--accent-strong);
      text-transform: uppercase;
      letter-spacing: 0.35em;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .page-title {
      margin: 0;
      font-size: clamp(2rem, 4vw, 2.75rem);
      font-weight: 700;
    }

    .description {
      margin: 0;
      color: var(--text-muted);
      line-height: 1.6;
      max-width: 720px;
    }

    .result-card {
      background-color: var(--panel);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 1.75rem;
      box-shadow: 0 25px 60px rgba(2, 6, 23, 0.4);
    }

    .result-card > * + * {
      margin-top: 1rem;
    }

    .card-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 600;
    }

    .muted {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0;
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .form-label {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      font-size: 0.95rem;
      color: #cbd5f5;
    }

    .form-input {
      width: 100%;
      border-radius: 14px;
      border: 1px solid var(--border-strong);
      background: var(--panel-soft);
      color: var(--text);
      padding: 0.85rem 1rem;
      font-size: 1rem;
      transition: border 0.2s ease, box-shadow 0.2s ease;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.35);
    }

    .form-remember {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .form-checkbox {
      width: 18px;
      height: 18px;
      border-radius: 6px;
      border: 1px solid rgba(148,163,184,0.6);
      background: rgba(15,23,42,0.4);
      accent-color: var(--accent);
    }

    .form-error {
      color: #fecaca;
      font-size: 0.85rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      border-radius: 999px;
      border: none;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      color: #fff;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
    }

    .btn:active {
      transform: scale(0.97);
    }

    .btn.full-width {
      width: 100%;
    }

    .btn.small {
      padding: 0.45rem 1rem;
      font-size: 0.85rem;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0ea5e9, #22d3ee);
      box-shadow: 0 10px 25px rgba(14,165,233,0.35);
    }

    .btn-primary:hover {
      box-shadow: 0 15px 35px rgba(14,165,233,0.5);
    }

    .btn-ghost {
      background: rgba(51,65,85,0.7);
      color: var(--text);
      border: 1px solid rgba(148,163,184,0.25);
    }

    .btn-ghost:hover {
      background: rgba(51,65,85,0.85);
    }

    .btn-outline {
      background: rgba(56,189,248,0.15);
      color: #7dd3fc;
      border: 1px solid rgba(56,189,248,0.45);
    }

    .btn-outline:hover {
      background: rgba(56,189,248,0.25);
    }

    .btn-icon {
      border-radius: 999px;
      border: 1px solid rgba(248,113,113,0.35);
      background: rgba(248,113,113,0.12);
      color: #fecdd3;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, background 0.2s ease;
    }

    .btn-icon:active {
      transform: scale(0.95);
    }

    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .status-text {
      color: #6ee7b7;
      font-weight: 600;
      font-size: 0.95rem;
    }

    .dropzone {
      border: 2px dashed rgba(148,163,184,0.6);
      transition: all 0.2s ease;
      border-radius: 24px;
      padding: 3rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      text-align: center;
    }

    .dropzone.dragover {
      border-color: var(--accent-strong);
      background-color: rgba(56,189,248,0.1);
    }

    .dropzone .title {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .dropzone .hint {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .dropzone svg {
      width: 48px;
      height: 48px;
      color: rgba(148,163,184,0.85);
    }

    .alert {
      border-radius: 18px;
      padding: 0.95rem 1.25rem;
      font-size: 0.9rem;
      border: 1px solid transparent;
    }

    .alert-success {
      background: rgba(16,185,129,0.12);
      border-color: rgba(16,185,129,0.35);
      color: #bbf7d0;
    }

    .alert-error {
      background: rgba(239,68,68,0.12);
      border-color: rgba(239,68,68,0.35);
      color: #fecaca;
    }

    .section-label {
      font-size: 0.85rem;
      letter-spacing: 0.35em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    code {
      display: block;
      background: rgba(15,23,42,0.6);
      padding: 0.85rem;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.3);
      font-size: 0.9rem;
      color: var(--text);
      word-break: break-all;
    }

    details {
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,0.2);
      background: rgba(15,23,42,0.45);
      padding: 1rem;
    }

    details summary {
      cursor: pointer;
      font-weight: 600;
      color: var(--text-muted);
    }

    .preview-wrapper {
      background: rgba(15,23,42,0.45);
      border: 1px solid rgba(148,163,184,0.25);
      border-radius: 22px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .preview-title {
      font-size: 0.85rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .preview-wrapper img {
      max-width: 400px;
      width: 100%;
      height: auto;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.35);
      box-shadow: 0 20px 40px rgba(2,6,23,0.5);
    }

    .result-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .variants-block {
      margin-top: 0.5rem;
    }

    .variant-list {
      margin-top: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      font-size: 0.9rem;
    }

    .variant-list span {
      font-size: 0.75rem;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-right: 0.5rem;
    }

    .example-note {
      font-size: 0.75rem;
      color: #64748b;
    }

    .toast {
      position: fixed;
      top: 24px;
      right: 24px;
      background-color: rgba(15,23,42,0.95);
      border: 1px solid rgba(148,163,184,0.4);
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 9999px;
      font-size: 0.9rem;
      box-shadow: 0 10px 25px rgba(15,23,42,0.5);
      z-index: 9999;
      animation: toast-in 0.2s ease-out;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="upload-shell">
    <header class="upload-header">
      <p class="tagline">Self-hosted CDN</p>
      <h1 class="page-title">Загрузка превью</h1>
      <p class="description">
        Перетащите файл в область ниже или выберите его вручную. Допустимые форматы: JPG, PNG, WEBP.
        Максимальный размер файла — ${maxSizeMb} МБ.
      </p>
    </header>

    <div id="login-card" class="result-card ${isAuthenticated ? 'hidden' : ''}">
      <h2 class="card-title">Вход</h2>
      <p class="muted">Введите пароль администратора, чтобы получить доступ к загрузке изображений.</p>
      <form id="loginForm" class="form-fields">
        <label class="form-label">
          <span>Пароль</span>
          <input type="password" id="passwordInput" class="form-input" placeholder="••••••••" required />
        </label>
        <label class="form-remember">
          <input type="checkbox" id="rememberInput" class="form-checkbox">
          <span>Запомнить на 30 дней</span>
        </label>
        <button type="submit" class="btn btn-primary full-width">Войти</button>
      </form>
      <div id="loginError" class="hidden form-error"></div>
    </div>

    <div id="uploader-card" class="${isAuthenticated ? '' : 'hidden'} result-card">
      <div class="status-bar">
        <div class="status-text">Авторизация успешна</div>
        <button id="logoutBtn" class="btn btn-ghost small">Выйти</button>
      </div>

      <div id="dropzone" class="dropzone">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h10a4 4 0 004-4m-4-6l-4-4m0 0L7 9m4-4v12" />
        </svg>
        <div>
          <p class="title">Перетащите файл сюда</p>
          <p class="hint">или нажмите для выбора</p>
        </div>
        <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" class="hidden" />
      </div>

      <div id="status" class="hidden alert alert-success"></div>
      <div id="error" class="hidden alert alert-error"></div>

      <div id="result" class="hidden result-card">
        <div class="status-bar">
          <h2 class="card-title">Готово ✨</h2>
          <button id="copyOptimized" class="btn btn-outline small">Скопировать ссылку</button>
        </div>
        <div id="previewWrapper" class="hidden preview-wrapper">
          <div class="preview-header">
            <p class="preview-title">Превью</p>
            <button id="deleteImageBtn" type="button" class="btn-icon" aria-label="Удалить изображение" title="Удалить изображение" disabled>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 11v6m6-6v6M4 7h16m-1 0l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-3h4a1 1 0 011 1v2H9V5a1 1 0 011-1z" />
              </svg>
            </button>
          </div>
          <div class="preview-image">
            <img id="previewImage" alt="Превью загруженного изображения" loading="lazy" />
          </div>
        </div>
        <div class="result-section">
          <p class="section-label">Оригинал</p>
          <code id="originalUrl"></code>
        </div>
        <div class="result-section">
          <p class="section-label">Оптимизация</p>
          <code id="optimizedUrl"></code>
        </div>
        <details class="variants-block">
          <summary>Дополнительные варианты</summary>
          <div class="variant-list">
            <div><span class="section-label">Preview:</span> <code id="variantPreview"></code></div>
            <div><span class="section-label">Card:</span> <code id="variantCard"></code></div>
            <div><span class="section-label">Full:</span> <code id="variantFull"></code></div>
          </div>
        </details>
        <p class="example-note">Пример ссылки для вставки: <code>${defaultExample}</code></p>
      </div>
    </div>

  <script>
    const isAuthenticated = ${isAuthenticated ? 'true' : 'false'}
    const dropzone = document.getElementById('dropzone')
    const fileInput = document.getElementById('fileInput')
    const statusBox = document.getElementById('status')
    const errorBox = document.getElementById('error')
    const resultBox = document.getElementById('result')
    const copyButton = document.getElementById('copyOptimized')
    const loginForm = document.getElementById('loginForm')
    const loginError = document.getElementById('loginError')
    const logoutBtn = document.getElementById('logoutBtn')
    const rememberInput = document.getElementById('rememberInput')
    const previewWrapper = document.getElementById('previewWrapper')
    const previewImage = document.getElementById('previewImage')
    const deleteImageBtn = document.getElementById('deleteImageBtn')
    let currentPublicId = null

    function resetUI() {
      statusBox.classList.add('hidden')
      errorBox.classList.add('hidden')
    }

    function setStatus(message) {
      statusBox.textContent = message
      statusBox.classList.remove('hidden')
      errorBox.classList.add('hidden')
    }

    function setError(message) {
      errorBox.textContent = message
      errorBox.classList.remove('hidden')
      statusBox.classList.add('hidden')
      resultBox.classList.add('hidden')
    }

    function clearResultUi() {
      currentPublicId = null
      resultBox?.classList.add('hidden')
      previewWrapper?.classList.add('hidden')
      if (previewImage) {
        previewImage.removeAttribute('src')
      }
      if (deleteImageBtn) {
        deleteImageBtn.setAttribute('disabled', 'true')
      }
      const fields = ['originalUrl', 'optimizedUrl', 'variantPreview', 'variantCard', 'variantFull']
      fields.forEach((id) => {
        const el = document.getElementById(id)
        if (el) el.textContent = ''
      })
    }

    function showToastMessage(message) {
      const toast = document.createElement('div')
      toast.className = 'toast'
      toast.textContent = message
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
      document.body.appendChild(toast)
      setTimeout(() => {
        toast.style.opacity = '0'
        toast.style.transform = 'translateY(-10px)'
      }, 1600)
      setTimeout(() => toast.remove(), 2200)
    }

    function showResult(data) {
      currentPublicId = data.publicId || null
      document.getElementById('originalUrl').textContent = data.original
      document.getElementById('optimizedUrl').textContent = data.optimized
      document.getElementById('variantPreview').textContent = data.variants.preview
      document.getElementById('variantCard').textContent = data.variants.card
      document.getElementById('variantFull').textContent = data.variants.full
      const previewUrl = data?.variants?.preview || data.optimized || data.original
      if (previewUrl && previewImage) {
        previewImage.src = previewUrl
        previewImage.alt = 'Превью ' + (data.publicId || '')
        previewWrapper?.classList.remove('hidden')
        deleteImageBtn?.removeAttribute('disabled')
      }
      resultBox.classList.remove('hidden')
    }

    async function uploadFile(file) {
      resetUI()
      if (!file) return
      setStatus('Загружаем файл…')

      const formData = new FormData()
      formData.append('file', file)

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Ошибка загрузки')
        }

        setStatus('Готово! Ссылки ниже 👇')
        showResult(data)
      } catch (error) {
        setError(error.message)
      }
    }

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', (e) => uploadFile(e.target.files[0]))

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault()
        dropzone.classList.add('dragover')
      })

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover')
      })

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault()
        dropzone.classList.remove('dragover')
        if (e.dataTransfer.files.length > 0) {
          uploadFile(e.dataTransfer.files[0])
        }
      })
    }

    copyButton?.addEventListener('click', async () => {
      const text = document.getElementById('optimizedUrl').textContent
      try {
        await navigator.clipboard.writeText(text)
        copyButton.textContent = 'Скопировано!'
        setTimeout(() => (copyButton.textContent = 'Скопировать ссылку'), 2000)
      } catch (error) {
        console.error('Clipboard error', error)
      }
    })

    deleteImageBtn?.addEventListener('click', async () => {
      if (!currentPublicId) return
      setStatus('Удаляем изображение...')
      deleteImageBtn.disabled = true
      try {
        const response = await fetch('/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ publicId: currentPublicId })
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Не удалось удалить изображение')
        }

        setStatus('Изображение удалено')
        showToastMessage('Изображение удалено')
        clearResultUi()
        setTimeout(() => window.location.reload(), 2000)
      } catch (error) {
        setError(error.message)
        deleteImageBtn.disabled = false
      }
    })

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault()
      loginError.classList.add('hidden')
      const password = document.getElementById('passwordInput').value.trim()
      if (!password) {
        loginError.textContent = 'Введите пароль'
        loginError.classList.remove('hidden')
        return
      }
      try {
        const response = await fetch('/upload/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password, remember: rememberInput?.checked })
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Ошибка авторизации')
        }
        window.location.reload()
      } catch (error) {
        loginError.textContent = error.message
        loginError.classList.remove('hidden')
      }
    })

    logoutBtn?.addEventListener('click', async () => {
      await fetch('/upload/logout', { method: 'POST' })
      window.location.reload()
    })
  </script>
</body>
</html>`
}

export default router

