FROM node:18-alpine
WORKDIR /app
<<<<<<< HEAD
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
ENV PORT=3000
EXPOSE 3000
=======

# 安裝依賴（沒有 package-lock.json 也可）
COPY package.json package-lock.json* ./
RUN npm install --production

# 拷貝程式碼
COPY . .

# 必要環境與埠
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# 啟動服務
>>>>>>> origin/main
CMD ["npm","start"]
