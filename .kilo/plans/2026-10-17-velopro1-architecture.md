# VeloPro1 — Микросервисное WebView приложение "ВелоПРО"

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать сайт мобильного WebView приложения "ВелоПРО" на микросервисной архитектуре с независимыми сервисами, общей базой, push-уведомлениями (не через Google), двумя окружениями (test/stable) и кнопкой скачивания стабильного APK.

**Architecture:** 4 независимых микросервиса (auth, api, push, app) на Express.js + nanoid, общая JSON-база в `data-db/`, PM2 с автоперезапуском (1 попытка) и отключением при сбое, единый формат ответов API `{success, data, error}`. WebView-сайт загружается онлайн, Android-приложение (29+, universal APK) сохраняет cookie и идентификаторы локально.

**Tech Stack:** Node.js (^18 || >=20), Express.js (^4.19.2), nanoid (^5.0.7), PM2, Web Push API, WebView (Android 29+), GitHub (ChurkaGeek22/VeloPro1).

**Spec:** Этот план является спецификацией. Дополнительные требования из задачи пользователя.

---

## Global Constraints

- Каждый микросервис независим: сбой одного не ломает остальные.
- Общая база данных: JSON-файлы в `data-db/`.
- Единый формат ответа API: `{ success: boolean, data: any, error: { code, message } | null }`.
- Каждый сервис имеет `package.json`, `server.js`, `metrics.json`.
- Управление процессами: PM2 через `ecosystem.config.cjs`.
- Микросервис при сбое перезапускается 1 раз; если не восстанавливается — отключается временно.
- Два окружения: `test` (разработка/тестирование) и `stable` (продакшн для всех пользователей).
- Android WebView: minSdk 29, universal APK (все архитектуры).
- Сайт открывается и с iPhone.
- Сайт загружается онлайн (встроен в приложение).
- Приложение сохраняет cookie и идентификаторы локально.
- Push-уведомления через отдельный микросервис `push`, не через Google FCM, отправляются конкретному пользователю системой.
- В разделе "Еще" → "Приложение" кнопка "Скачать APK" для актуальной Stable-версии.
- Сборка только по команде пользователя (`//Сборка` или `//FullСборка`).
- Повышение версии только по команде `//ПовыситьВерсию`.
- Unit-тесты (200 шт.) только по команде `//UnitТесты`.
- Git-репозиторий: ChurkaGeek22/VeloPro1 (приватный).
- Ветки: `main` (stable), `dev` (разработка), `feature/*` → `dev` → `main`.

---

## Review Focus

1. **Сбой микросервиса** — если `push` недоступен, остальные сервисы (`auth`, `api`, `app`) продолжают работать; фронтенд скрывает элементы push и показывает "Сервис временно недоступен".
2. **Автоперезапуск** — PM2 перезапускает упавший сервис 1 раз; при повторном сбое сервис отключается (`status: inactive` в `metrics.json`).
3. **Общая база** — одновременная запись в JSON-файлы из разных сервисов должна быть безопасной (без потери данных).
4. **Cookie в WebView** — Android WebView должен сохранять cookie и идентификаторы между сессиями.
5. **APK скачивание** — кнопка "Скачать APK" отдаёт только стабильную версию, доступную всем пользователям.

---

## File Structure

```
VeloPro1/
├── .kilo/
│   └── plans/
│       └── 2026-10-17-velopro1-architecture.md
├── microservices/
│   ├── auth/              # Авторизация и пользователи
│   │   ├── package.json
│   │   ├── server.js
│   │   └── metrics.json
│   ├── api/               # Основной API-шлюз
│   │   ├── package.json
│   │   ├── server.js
│   │   └── metrics.json
│   ├── push/              # Push-уведомления (отдельный сервис)
│   │   ├── package.json
│   │   ├── server.js
│   │   └── metrics.json
│   └── app/               # Управление приложением (версии, APK)
│       ├── package.json
│       ├── server.js
│       └── metrics.json
├── data-db/
│   ├── users.json
│   ├── sessions.json
│   ├── push-subscriptions.json
│   ├── app-versions.json
│   └── metrics.json
├── site/                  # WebView сайт (фронтенд)
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── pages/
│       └── app-download.html
├── android-app/           # WebView Android приложение
│   ├── app/
│   │   └── src/
│   └── build.gradle
├── ecosystem.config.cjs   # PM2 конфигурация (test + stable)
├── .github/
│   └── workflows/
│       ├── build-test.yml
│       └── build-stable.yml
└── README.md
```

---

## Tasks

### Task 1: Структура репозитория и базовая конфигурация

**Files:**
- Create: `.kilo/plans/2026-10-17-velopro1-architecture.md`
- Create: `ecosystem.config.cjs`
- Create: `data-db/users.json`
- Create: `data-db/sessions.json`
- Create: `data-db/push-subscriptions.json`
- Create: `data-db/app-versions.json`
- Create: `data-db/metrics.json`
- Create: `README.md`

**Interfaces:**
- Consumes: —
- Produces: `ecosystem.config.cjs` с определением 4 сервисов для test и stable окружений

- [ ] **Step 1:** Создать структуру директорий проекта
- [ ] **Step 2:** Создать `ecosystem.config.cjs` с PM2 конфигурацией для 4 сервисов, max_restarts: 1, окружения test/stable
- [ ] **Step 3:** Создать заготовки JSON-файлов общей базы в `data-db/`
- [ ] **Step 4:** Проверить, что все файлы созданы и валидны (JSON парсится)

---

### Task 2: Микросервис `auth` — авторизация и пользователи

**Files:**
- Create: `microservices/auth/package.json`
- Create: `microservices/auth/server.js`
- Create: `microservices/auth/metrics.json`

**Interfaces:**
- Consumes: `data-db/users.json`, `data-db/sessions.json`
- Produces: POST `/api/auth/register`, POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`

- [ ] **Step 1:** Написать failing тест для регистрации пользователя
- [ ] **Step 2:** Реализовать `server.js` сервиса `auth` (Express.js, nanoid для ID)
- [ ] **Step 3:** Реализовать эндпоинты регистрации, логина, выхода, получения профиля
- [ ] **Step 4:** Сохранение сессий и cookie в `data-db/sessions.json`
- [ ] **Step 5:** Проверить, что сервис работает независимо от остальных
- [ ] **Step 6:** Commit

---

### Task 3: Микросервис `api` — основной API-шлюз

**Files:**
- Create: `microservices/api/package.json`
- Create: `microservices/api/server.js`
- Create: `microservices/api/metrics.json`

**Interfaces:**
- Consumes: `data-db/users.json`, `data-db/sessions.json`, `data-db/app-versions.json`
- Produces: GET `/api/app/info`, GET `/api/app/version`, прокси-запросы к `auth` и `push`

- [ ] **Step 1:** Написать failing тест для получения информации о приложении
- [ ] **Step 2:** Реализовать `server.js` сервиса `api` (Express.js)
- [ ] **Step 3:** Реализовать эндпоинты информации о приложении и версии
- [ ] **Step 4:** Реализовать проксирование к другим сервисам с обработкой их недоступности
- [ ] **Step 5:** Проверить, что при недоступности другого сервиса `api` продолжает работать
- [ ] **Step 6:** Commit

---

### Task 4: Микросервис `push` — push-уведомления

**Files:**
- Create: `microservices/push/package.json`
- Create: `microservices/push/server.js`
- Create: `microservices/push/metrics.json`

**Interfaces:**
- Consumes: `data-db/push-subscriptions.json`, `data-db/users.json`
- Produces: POST `/api/push/subscribe`, POST `/api/push/send`, GET `/api/push/status`

- [ ] **Step 1:** Написать failing тест для подписки на push-уведомления
- [ ] **Step 2:** Реализовать `server.js` сервиса `push` (Express.js, Web Push API, не Google FCM)
- [ ] **Step 3:** Реализовать подписку пользователя на push (сохранение в `push-subscriptions.json`)
- [ ] **Step 4:** Реализовать отправку уведомления конкретному пользователю системой
- [ ] **Step 5:** Проверить, что сервис `push` независим: при его сбое остальные сервисы работают
- [ ] **Step 6:** Commit

---

### Task 5: Микросервис `app` — управление приложением и версиями

**Files:**
- Create: `microservices/app/package.json`
- Create: `microservices/app/server.js`
- Create: `microservices/app/metrics.json`

**Interfaces:**
- Consumes: `data-db/app-versions.json`
- Produces: GET `/api/app/versions`, GET `/api/app/download/stable`, GET `/api/app/status`

- [ ] **Step 1:** Написать failing тест для получения списка версий приложения
- [ ] **Step 2:** Реализовать `server.js` сервиса `app` (Express.js)
- [ ] **Step 3:** Реализовать эндпоинт получения актуальной стабильной версии
- [ ] **Step 4:** Реализовать эндпоинт скачивания стабильного APK
- [ ] **Step 5:** Проверить, что отдаётся только стабильная версия
- [ ] **Step 6:** Commit

---

### Task 6: WebView сайт (фронтенд)

**Files:**
- Create: `site/index.html`
- Create: `site/css/style.css`
- Create: `site/js/app.js`
- Create: `site/js/push-client.js`
- Create: `site/js/storage.js`
- Create: `site/pages/app-download.html`
- Create: `site/pages/app-download.js`

**Interfaces:**
- Consumes: API эндпоинты сервисов `auth`, `api`, `push`, `app`
- Produces: HTML/JS интерфейс для WebView, включая раздел "Еще" → "Приложение" с кнопкой "Скачать APK"

- [ ] **Step 1:** Написать failing тест для сохранения cookie в локальном хранилище
- [ ] **Step 2:** Создать базовый HTML-шаблон сайта с навигацией
- [ ] **Step 3:** Реализовать сохранение cookie и идентификаторов локально (localStorage/IndexedDB)
- [ ] **Step 4:** Реализовать раздел "Еще" → "Приложение" с кнопкой "Скачать APK"
- [ ] **Step 5:** Реализовать клиент push-уведомлений (подписка, получение)
- [ ] **Step 6:** Реализовать обработку недоступности сервисов (показ "Сервис временно недоступен")
- [ ] **Step 7:** Проверить, что сайт открывается на iPhone и Android
- [ ] **Step 8:** Commit

---

### Task 7: Android WebView приложение

**Files:**
- Create: `android-app/app/build.gradle`
- Create: `android-app/app/src/main/AndroidManifest.xml`
- Create: `android-app/app/src/main/java/com/velopro/MainActivity.java`
- Create: `android-app/app/src/main/res/layout/activity_main.xml`

**Interfaces:**
- Consumes: URL онлайн-сайта (test или stable)
- Produces: Universal APK (android-arm64 + все архитектуры), minSdk 29

- [ ] **Step 1:** Написать failing тест для конфигурации build.gradle (universal APK)
- [ ] **Step 2:** Создать AndroidManifest.xml с minSdk 29, интернет-разрешениями, уведомлениями
- [ ] **Step 3:** Реализовать MainActivity с WebView, загрузкой онлайн-сайта
- [ ] **Step 4:** Настроить сохранение cookie и идентификаторов локально
- [ ] **Step 5:** Настроить universal APK (все архитектуры, не только arm64)
- [ ] **Step 6:** Проверить сборку тестового APK
- [ ] **Step 7:** Commit

---

### Task 8: PM2 отказоустойчивость и управление сервисами

**Files:**
- Modify: `ecosystem.config.cjs`

**Interfaces:**
- Consumes: `metrics.json` каждого сервиса
- Produces: Автоперезапуск (1 попытка), отключение при повторном сбое, API `/api/service/status`

- [ ] **Step 1:** Настроить `max_restarts: 1` в PM2 для всех сервисов
- [ ] **Step 2:** Реализовать логику отключения сервиса при повторном сбое (`status: inactive`)
- [ ] **Step 3:** Реализовать API-эндпоинт `/api/service/status` для управления состоянием
- [ ] **Step 4:** Проверить, что при отключении одного сервиса остальные продолжают работать
- [ ] **Step 5:** Commit

---

### Task 9: Два окружения — test и stable

**Files:**
- Modify: `ecosystem.config.cjs`
- Create: `.github/workflows/build-test.yml`
- Create: `.github/workflows/build-stable.yml`

**Interfaces:**
- Consumes: ветки `dev` (test) и `main` (stable)
- Produces: Тестовый деплой (test) и продакшн деплой (stable)

- [ ] **Step 1:** Настроить PM2 конфигурацию для двух окружений (test/stable)
- [ ] **Step 2:** Создать GitHub Actions workflow для тестовой сборки (universal APK + сайт)
- [ ] **Step 3:** Создать GitHub Actions workflow для стабильной сборки (только по подтверждению)
- [ ] **Step 4:** Проверить, что test окружение доступно для разработки, stable — для всех пользователей
- [ ] **Step 5:** Commit

---

### Task 10: Кнопка "Скачать APK" в разделе "Еще" → "Приложение"

**Files:**
- Modify: `site/pages/app-download.html`
- Modify: `site/pages/app-download.js`
- Modify: `microservices/app/server.js`

**Interfaces:**
- Consumes: `GET /api/app/download/stable` от сервиса `app`
- Produces: Кнопка скачивания актуального стабильного APK

- [ ] **Step 1:** Реализовать раздел "Приложение" в "Еще" на сайте
- [ ] **Step 2:** Добавить кнопку "Скачать APK" со ссылкой на стабильную версию
- [ ] **Step 3:** Реализовать эндпоинт скачивания APK в сервисе `app`
- [ ] **Step 4:** Проверить, что кнопка доступна только для стабильной версии
- [ ] **Step 5:** Commit

---

### Task 11: GitHub репозиторий и CI/CD

**Files:**
- Create: `.github/workflows/build-test.yml`
- Create: `.github/workflows/build-stable.yml`
- Create: `.gitignore`

**Interfaces:**
- Consumes: GitHub токен, репозиторий ChurkaGeek22/VeloPro1
- Produces: Удалённый репозиторий, автоматические сборки

- [ ] **Step 1:** Создать приватный репозиторий ChurkaGeek22/VeloPro1 на GitHub
- [ ] **Step 2:** Настроить Git remote и первоначальный push
- [ ] **Step 3:** Настроить ветки `main` (stable) и `dev` (разработка)
- [ ] **Step 4:** Настроить GitHub Actions для сборки test и stable версий
- [ ] **Step 5:** Commit

---

### Task 12: Финальная проверка и подготовка к сборке

**Files:**
- Modify: все файлы проекта (проверка)

**Interfaces:**
- Consumes: весь код проекта
- Produces: Подтверждение готовности к сборке

- [ ] **Step 1:** Проверить, что каждый объявленный метод реализован (нет пустых/заглушечных методов)
- [ ] **Step 2:** Проверить корректность входных и выходных параметров всех API-методов
- [ ] **Step 3:** Проверить обработку исключений и коды ответов (200, 400, 401, 403, 404, 500)
- [ ] **Step 4:** Проверить соответствие бизнес-логике и архитектуре проекта
- [ ] **Step 5:** Проверить, что нет дублирования логики и недостижимого кода
- [ ] **Step 6:** Сообщить: "Можно произвести новую сборку, так как приложение готово."
- [ ] **Step 7:** Commit

---

## Open Questions (require user decision)

1. **GitHub репозиторий:** Создан репозиторий ChurkaGeek22/VeloPro1 (публичный). Ветки: main (стабильная), dev (разработка).

2. **Хостинг сайта:** Сайт загружается онлайн. На какой платформе будет хоститься (Vercel, Netlify, собственный сервер, GitHub Pages)? Нужны ли домены для test и stable окружений?

3. **Механизм push-уведомлений:** Использовать Web Push API (PushManager + Service Worker), WebSockets или кастомный HTTP long-polling?

4. **Функциональность сайта:** Упомянут только раздел "Еще" → "Приложение" → "Скачать APK". Какие ещё страницы/разделы нужны на сайте?

5. **Сборка APK:** Правила `Сборка_и_тестирование.md` требуют команды `//Сборка` или `//FullСборка` для запуска сборки. Пользователь подтверждает, что хочет следовать этим правилам?

---

## Plan Complete

План сохранен в `.kilo/plans/2026-10-17-velopro1-architecture.md`.

Для реализации необходимо переключиться в режим Code (или использовать subagent-driven-development). Перед началом реализации пользователь должен ответить на открытые вопросы выше, особенно про создание GitHub репозитория и хостинг сайта.

**Рекомендуемый подход к выполнению:** Subagent-driven — задачи имеют чёткие интерфейсы и зависимости, независимые сервисы можно реализовывать параллельно (3 агента: auth+api, push+app, site+android).