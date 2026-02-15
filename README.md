# Railway 記帳服務

## 結構
- apps/backend：NestJS API（Prisma、R2簽名上傳）
- apps/frontend：Next.js PWA 表單

## 環境變數
參考 `.env.example`，在 Railway 分別設定：
- PORT
- DATABASE_URL（Postgres）
- R2_ENDPOINT、R2_BUCKET、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY
- NEXT_PUBLIC_API_URL（前端指向後端）

## 部署步驟
1. 建立 Railway 專案與 Postgres 外掛
2. 後端服務：指向 `apps/backend`，啟動命令 `npm run start -w apps/backend`
3. 前端服務：指向 `apps/frontend`，啟動命令 `npm run start -w apps/frontend`
4. 設定環境變數並重新部署

## 資料庫
Prisma Schema 位於 `apps/backend/prisma/schema.prisma`，在本地或部署前執行：
```
npx prisma migrate deploy
```
（Railway 可於啟動前執行 Migration Script）

## 上傳流程
前端向 `/api/uploads/sign` 取得簽名，直傳至 R2，完成後呼叫 `/api/uploads/complete` 寫入附件記錄。

## GitHub 連接與 CI
- 推送到 GitHub 後，Actions 會執行基本建置（`.github/workflows/ci.yml`）
- Railway 建議以「Connect to GitHub」方式建立服務，選擇 monorepo 子目錄
- 提交到 main 分支會自動重新部署

### 快速推送指引（本機）
```
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<你的倉庫>.git
git push -u origin main
```

## 機器人（OpenClaw）整合
- 建議開啟 API Key 保護：在後端環境變數加入 `API_KEY=你自訂的字串`
- 機器人呼叫：
  - 單筆入帳：`POST /api/entries`，附帶 `Idempotency-Key` header（避免重複）
  - 批次入帳：`POST /api/entries/batch`，附帶 `x-api-key: <API_KEY>`
  - 簽名上傳：`POST /api/uploads/sign` → 直傳 R2 → `POST /api/uploads/complete`
- OpenAPI 規格：`apps/backend/docs/openapi.json`
- 範例（cURL）：
```
curl -X POST "$API/api/entries" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: 8c1c..." \
  -d '{"content":"午餐","amount":-85,"categoryId":1,"companyId":2}'

curl -X POST "$API/api/entries/batch" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '[{"content":"工資","amount":10000,"idempotencyKey":"k1"},{"content":"交通","amount":-20,"idempotencyKey":"k2"}]'
```
