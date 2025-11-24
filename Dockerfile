# Dockerfile
FROM node:20-alpine

# 作業ディレクトリの設定
WORKDIR /app

# package.json と package-lock.json をコピー
COPY package*.json ./

# 依存関係のインストール
RUN npm install

# ソースコードをコピー
COPY . .

# Vite のデフォルトポート
EXPOSE 5173

# 開発サーバー起動
CMD ["npm", "run", "dev"]