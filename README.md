# Stock

個人用の株式分析アプリです。RailsとSQLiteを使い、MacBook Pro上のDockerで動かします。

## 技術構成

- Ruby 4.0.5
- Rails 8.1.3
- SQLite
- Turbo（Stimulusは使用しない）
- CSSフレームワークなし
- Docker / Docker Compose

## 初回セットアップ

```bash
make setup
```

## 起動

```bash
make up
```

ブラウザで次のURLを開きます。

```text
http://localhost:3333
```

終了するときは次を実行します。

```bash
make down
```

## ポート

このプロジェクトでは、ほかの開発環境と重なりにくいように3333番台を使用します。

| 用途 | ポート |
|---|---:|
| Rails | 3333 |
| 将来追加する補助サービス | 3334以降 |

変更する場合は `.env` の `WEB_PORT` と `RAILS_PORT` を更新してください。

## よく使うコマンド

```bash
make logs
make console
make shell
make spec
make lint
make security
```

## データ保存

SQLiteデータはGoogle Drive配下へ直接保存せず、Dockerの `stock_storage` volumeへ保存します。
設置用MacBook Proでは、このvolumeを定期的にバックアップしてください。

## Galaxyからのアクセス

設置用MacBook ProとGalaxyを同じTailscaleネットワークへ接続し、Tailscale ServeからRailsの3333番ポートへ転送する予定です。インターネットへ直接ポートを公開しません。

## 既存資料

- `personal-doc/`: Rails化前の静的HTML版
