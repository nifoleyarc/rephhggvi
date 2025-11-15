import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import { saveUploadedImage, MAX_UPLOAD_SIZE_BYTES } from '../utils/imageStorage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
})

const BASIC_USER = process.env.IMAGE_UPLOAD_BASIC_USER
const BASIC_PASS = process.env.IMAGE_UPLOAD_BASIC_PASS
const BEARER_TOKEN = process.env.IMAGE_UPLOAD_TOKEN
const DEFAULT_LOG_PATH = process.env.NODE_ENV === 'production'
  ? '/var/log/img-upload.log'
  : path.join(__dirname, '../../logs/img-upload.log')
const UPLOAD_LOG_PATH = process.env.IMAGE_UPLOAD_LOG || DEFAULT_LOG_PATH

function haveCredentials() {
  return Boolean((BASIC_USER && BASIC_PASS) || BEARER_TOKEN)
}

async function logUpload(event) {
  try {
    await fs.mkdir(path.dirname(UPLOAD_LOG_PATH), { recursive: true })
    await fs.appendFile(UPLOAD_LOG_PATH, JSON.stringify(event) + '\n', { encoding: 'utf8' })
  } catch (error) {
    console.error('Не удалось записать лог загрузки:', error.message)
  }
}

function parseBasicAuth(header) {
  try {
    const base64Credentials = header.split(' ')[1]
    const decoded = Buffer.from(base64Credentials, 'base64').toString()
    const separatorIndex = decoded.indexOf(':')
    if (separatorIndex === -1) return null
    const username = decoded.slice(0, separatorIndex)
    const password = decoded.slice(separatorIndex + 1)
    return { username, password }
  } catch (error) {
    return null
  }
}

function unauthorized(res) {
  res.set('WWW-Authenticate', 'Basic realm="Image Upload", charset="UTF-8"')
  return res.status(401).send('Unauthorized')
}

function uploadAuth(req, res, next) {
  if (!haveCredentials()) {
    console.error('IMAGE_UPLOAD_* переменные не заданы, доступ к /upload запрещён')
    return res.status(503).send('Upload panel is not configured')
  }

  const authHeader = req.headers.authorization || ''

  if (authHeader.startsWith('Bearer ') && BEARER_TOKEN) {
    const token = authHeader.slice(7).trim()
    if (token === BEARER_TOKEN) {
      req.uploadAuthUser = 'token'
      return next()
    }
    return unauthorized(res)
  }

  if (authHeader.startsWith('Basic ') && BASIC_USER && BASIC_PASS) {
    const credentials = parseBasicAuth(authHeader)
    if (credentials && credentials.username === BASIC_USER && credentials.password === BASIC_PASS) {
      req.uploadAuthUser = credentials.username
      return next()
    }
    return unauthorized(res)
  }

  return unauthorized(res)
}

router.get('/', uploadAuth, (req, res) => {
  res.type('html').send(renderUploadPage())
})

router.post('/', uploadAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не передан' })
  }

  try {
    const stored = await saveUploadedImage(req.file.buffer, req.file.originalname, {
      uploader: req.uploadAuthUser || 'unknown',
      via: 'manual-panel'
    })

    await logUpload({
      at: new Date().toISOString(),
      user: req.uploadAuthUser || 'unknown',
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

function renderUploadPage() {
  const maxSizeMb = (MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0)
  const cdnBase = process.env.IMAGE_CDN_BASE_URL || 'https://img.example.com'
  const defaultExample = `${cdnBase}/cdn/resize?width=640&url=${cdnBase}/images/YYYY/MM/DD/<file>`

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Загрузка превью</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0f172a; color: #e2e8f0; font-family: 'Inter', sans-serif; }
    .dropzone { border: 2px dashed rgba(148,163,184,0.6); transition: all 0.2s ease; }
    .dropzone.dragover { border-color: #38bdf8; background-color: rgba(56,189,248,0.1); }
    .result-card { background-color: rgba(15,23,42,0.85); border: 1px solid rgba(148,163,184,0.2); }
  </style>
</head>
<body class="min-h-screen">
  <div class="max-w-3xl mx-auto py-12 px-4 space-y-8">
    <header class="space-y-2">
      <p class="text-sky-400 font-semibold uppercase tracking-widest text-xs">Self-hosted CDN</p>
      <h1 class="text-3xl font-bold">Загрузка превью</h1>
      <p class="text-slate-400 max-w-2xl">
        Перетащите файл в область ниже или выберите его вручную. Допустимые форматы: JPG, PNG, WEBP.
        Максимальный размер файла — ${maxSizeMb} МБ.
      </p>
    </header>

    <div id="dropzone" class="dropzone rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 15a4 4 0 004 4h10a4 4 0 004-4m-4-6l-4-4m0 0L7 9m4-4v12" />
      </svg>
      <div class="text-center space-y-1">
        <p class="text-lg font-medium">Перетащите файл сюда</p>
        <p class="text-sm text-slate-400">или нажмите для выбора</p>
      </div>
      <input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" class="hidden" />
    </div>

    <div id="status" class="hidden bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 rounded-xl px-4 py-3 text-sm"></div>
    <div id="error" class="hidden bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-xl px-4 py-3 text-sm"></div>

    <div id="result" class="hidden result-card rounded-2xl p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Готово ✨</h2>
        <button id="copyOptimized" class="text-sm px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 transition">Скопировать ссылку</button>
      </div>
      <div class="space-y-2">
        <p class="text-sm text-slate-400 uppercase tracking-widest">Оригинал</p>
        <code id="originalUrl" class="block bg-slate-900/60 p-3 rounded-lg text-slate-100 text-sm break-all"></code>
      </div>
      <div class="space-y-2">
        <p class="text-sm text-slate-400 uppercase tracking-widest">Оптимизация</p>
        <code id="optimizedUrl" class="block bg-slate-900/60 p-3 rounded-lg text-slate-100 text-sm break-all"></code>
      </div>
      <details class="bg-slate-900/40 rounded-lg p-4">
        <summary class="cursor-pointer text-sm text-slate-300">Дополнительные варианты</summary>
        <div class="mt-3 space-y-2 text-sm">
          <div><span class="text-slate-400 uppercase text-xs">Preview:</span> <code id="variantPreview" class="break-all block"></code></div>
          <div><span class="text-slate-400 uppercase text-xs">Card:</span> <code id="variantCard" class="break-all block"></code></div>
          <div><span class="text-slate-400 uppercase text-xs">Full:</span> <code id="variantFull" class="break-all block"></code></div>
        </div>
      </details>
      <p class="text-xs text-slate-500">Пример ссылки для вставки: <code>${defaultExample}</code></p>
    </div>
  </div>

  <script>
    const dropzone = document.getElementById('dropzone')
    const fileInput = document.getElementById('fileInput')
    const statusBox = document.getElementById('status')
    const errorBox = document.getElementById('error')
    const resultBox = document.getElementById('result')
    const copyButton = document.getElementById('copyOptimized')

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

    function showResult(data) {
      document.getElementById('originalUrl').textContent = data.original
      document.getElementById('optimizedUrl').textContent = data.optimized
      document.getElementById('variantPreview').textContent = data.variants.preview
      document.getElementById('variantCard').textContent = data.variants.card
      document.getElementById('variantFull').textContent = data.variants.full
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

    copyButton.addEventListener('click', async () => {
      const text = document.getElementById('optimizedUrl').textContent
      try {
        await navigator.clipboard.writeText(text)
        copyButton.textContent = 'Скопировано!'
        setTimeout(() => (copyButton.textContent = 'Скопировать ссылку'), 2000)
      } catch (error) {
        console.error('Clipboard error', error)
      }
    })
  </script>
</body>
</html>`
}

export default router

