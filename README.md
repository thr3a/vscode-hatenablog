# vscode-hatenablog

VSCodeからはてなブログへMarkdownファイルを直接投稿できる拡張機能です。

## 機能

- Markdownファイルをはてなブログへ新規投稿・更新
- FrontMatterによるタイトル・カテゴリ・下書きフラグなどのメタデータ管理
- 投稿後にFrontMatterを自動更新（エントリID・公開日時・更新日時）
- 投稿後にブラウザで記事URLを自動表示
- Google Indexing API連携によるインデックス登録通知（オプション）

## 使い方

1. Markdownファイルを作成して記事を書く。
2. コマンドパレット (`Cmd+Shift+P`) から `Post to HatenaBlog` を実行
3. 投稿後、FrontMatterが自動更新されファイルが保存される

### FrontMatterの例

```markdown
---
id: 1234
title: "投稿テスト"
date: "2026-03-11"
categories: ["ubuntu"]
published_at: "2026-03-11T23:47:27+09:00"
updated_at: "2026-03-11T23:47:27+09:00"
draft_flag: false
---

本文をここに書く
```

## 設定

| 設定キー | 必須 | 説明 |
|---|---|---|
| `hatenablog.hatenaId` | ○ | はてなID |
| `hatenablog.blogId` | ○ | ブログID（例: example.hatenablog.com）。独自ドメインの場合もデフォルトのブログIDを指定 |
| `hatenablog.apiKey` | ○ | AtomPub APIキー（はてなブログの詳細設定ページで確認） |
| `hatenablog.google_credentials_path` |  | Google Indexing API用サービスアカウントJSONの絶対パス |

`hatenablog.google_credentials_path` はGoogle Indexing APIを使用しない場合は省略可能

```json
{
  "hatenablog.hatenaId": "your-hatena-id",
  "hatenablog.blogId": "your-blog.hatenablog.com",
  "hatenablog.apiKey": "your-api-key",
  "hatenablog.google_credentials_path": "/absolute/path/to/service-account.json"
}
```

## APIキーの取得方法

1. はてなブログの管理画面を開く
2. 「設定」→「詳細設定」→「AtomPub」セクションへ
3. 表示されているAPIキーをコピー

## Google Indexing API連携（オプション）

記事投稿後にGoogle Indexing APIへURL登録通知を送ることで、Googleへのインデックス登録を促進できます。

1. Google Cloud ConsoleでIndexing APIを有効化
2. サービスアカウントを作成し、JSONキーをダウンロード
3. `hatenablog.google_credentials_path` にそのJSONファイルの絶対パスを設定
