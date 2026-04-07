---
description: Fretless Training アプリケーションを GCP Cloud Run へデプロイし、本番環境を更新します。
---
1. アプリケーションのビルドとCloud Runへのプッシュを行います。
// turbo
2. 以下のコマンドを実行してデプロイします（リソース制限付き）。
```bash
gcloud run deploy fretless-training \
  --source . \
  --region ${GCP_REGION} \
  --project ${GCP_PROJECT} \
  --cpu 1 \
  --memory 512Mi \
  --max-instances 1 \
  --allow-unauthenticated \
  --quiet
```
3. デプロイ完了後、ターミナルに出力された Service URL を確認してください。
