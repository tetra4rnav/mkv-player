# wranglerなしセットアップ手順

## Cloudflare ダッシュボードでのセットアップ

### R2バケット作成

- Cloudflare ダッシュボード → R2 → バケットを作成 → 名前: `my-mkv-files`

### D1データベース作成

- Workers & Pages → D1 → データベースを作成 → 名前: `mkv-library`
- 作成後、D1コンソールで `migrations/0001_init.sql` の内容を貼り付けて実行

### Cloudflare Pages プロジェクト作成

- Workers & Pages → Pages → Git に接続 → リポジトリを選択
- ビルド設定:
  - フレームワーク: なし
  - ビルドコマンド: `npm run build`
  - 出力ディレクトリ: `dist`
- バインディング (設定 → 関数):
  - R2: 変数名 `MEDIA_BUCKET` → バケット `my-mkv-files`
  - D1: 変数名 `DB` → データベース `mkv-library`
- 環境変数 (設定 → 環境変数):
  - `AUTH_PASSWORD`: ログインパスワード
  - `JWT_SECRET`: ランダム文字列（パスワードマネージャー等で32文字以上生成）

## GitHub Actions Secrets の設定

リポジトリ → Settings → Secrets → Actions で以下を追加:

- `CLOUDFLARE_API_TOKEN`:
  Cloudflare → マイプロフィール → APIトークン → トークンを作成
  → 「Cloudflare Pages を編集する」テンプレートを使用
- `CLOUDFLARE_ACCOUNT_ID`:
  Cloudflare ダッシュボード右サイドバーの「アカウントID」

## R2への動画アップロード (rclone)

rclone の設定:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <R2アクセスキー>
secret_access_key = <R2シークレットキー>
endpoint = https://<アカウントID>.r2.cloudflarestorage.com
```

R2アクセスキーの発行: Cloudflare → R2 → APIトークンを管理

アップロード:

```bash
./scripts/convert.sh movie.mkv output/
rclone copy output/movie r2:my-mkv-files/movie --progress
```

## デプロイ

```bash
git add .
git commit -m "update"
git push
```

`main` への push 後、GitHub Actions が自動でビルドと Cloudflare Pages デプロイを実行します。
