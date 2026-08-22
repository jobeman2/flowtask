# Telegram Integration & Mini App Specification

## 1. Authentication via Telegram WebApp `initData`
Telegram Mini Apps pass signed `initData` query string to the web app.
The backend cryptographically verifies the authenticity using HMAC-SHA256:
1. `secret_key = HMAC_SHA256("WebAppData", bot_token)`
2. `data_check_string = key=value pairs sorted alphabetically`
3. `calculated_hash = HMAC_SHA256(secret_key, data_check_string)`
4. `assert(calculated_hash === hash)`

## 2. Webhook & Long Polling
- Production uses Webhook mode with `x-telegram-bot-api-secret-token` validation.
- Development supports direct long polling using the Grammy bot worker (`apps/bot`).
