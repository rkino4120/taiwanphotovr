# Netlify にデプロイする際の API キー設定

このプロジェクトでは MicroCMS の API キーを環境変数 `VITE_MICROCMS_API_KEY` で読み込みます。
クライアント側で環境変数を使うため、Vite では `VITE_` プレフィックスが必要です。

**重要**: API キーをリポジトリに直接コミットしないでください。

## 手順（Netlify 管理画面経由）

1. Netlify にログインして対象サイトを選択
2. サイト設定 -> Build & deploy -> Environment -> Environment variables の順に開く
3. `Key` に `VITE_MICROCMS_API_KEY` を、`Value` にあなたの MicroCMS API キーを入力して保存
4. サイトを再デプロイ

## 手順（netlify-cli を使う方法）

事前に `netlify-cli` をインストールし、`netlify login` でログインしてください。

プロジェクトルートで以下を実行すると環境変数を設定できます（サイト指定がない場合は現在のディレクトリに紐づくサイトに設定されます）：

```bash
# 例: 直接キーを設定する（注意: 端末の履歴に残ります）
netlify env:set VITE_MICROCMS_API_KEY vQPQlm8xpK1PlL8foIoq1HdWhfkuP94BLrKD

# サイトを明示する場合（site-id は Netlify のサイト設定画面で確認）
netlify env:set VITE_MICROCMS_API_KEY vQPQlm8xpK1PlL8foIoq1HdWhfkuP94BLrKD --site your-site-id
```

実行後、Netlify は自動的にサイトを再ビルドしない場合があるため、管理画面から再デプロイしてください。

## ローカルでの動作確認

開発時に環境変数を設定して動作確認する場合、プロジェクトルートに `.env.local` を作成して次を追加できます（このファイルは `.gitignore` に追加してコミットしないでください）：

```text
VITE_MICROCMS_API_KEY=vQPQlm8xpK1PlL8foIoq1HdWhfkuP94BLrKD
```

その後、開発サーバーを再起動します:

```bash
npm run dev
```

## フックの使い方（参考）
プロジェクト内の `src/hooks/useWorks.ts` を使用してデータを取得します。コンポーネント内での例：

```tsx
import useWorks from './hooks/useWorks';

function WorksList() {
  const { works, loading, error } = useWorks();
  // ...レンダリング処理
}
```

## セキュリティ上の注意
- クライアント側で API キーを使うと、キーはエンドユーザーに見えてしまいます。公開して問題ないキーであるかを確認してください。
- 機密キーを安全に扱いたい場合は、サーバーサイド（Netlify Functions など）でプロキシを作成し、クライアントはそのプロキシを叩く形にしてください。
