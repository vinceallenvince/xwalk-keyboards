# XWALK KEYBOARDS Deployment Runbook

How XWALK KEYBOARDS deploys today: merging a PR to `main` is a production
deployment, executed by GitHub Actions on Cloud Run.

## Google Cloud project

| Setting | Value |
| --- | --- |
| Project ID | `xwalk-keyboards-01` |
| Runtime | Cloud Run |
| Region | `us-central1` |

## Deployed services

| Service | Repository / runtime | Responsibility | URL |
| --- | --- | --- | --- |
| `xwalk-keyboards` | This repo, Next.js | Public web app; server-side HLS/snapshot/Roboflow/calibration proxies | https://xwalk-keyboards-21826886868.us-central1.run.app |
| `xwalk-camera-calibration-agent` | [xwalk-camera-calibration-agent](https://github.com/vinceallenvince/xwalk-camera-calibration-agent), Python | Publishes crosswalk stripe geometry to GCS; serves on-demand recalibration | https://xwalk-camera-calibration-agent-21826886868.us-central1.run.app |

The calibration agent deploys from its own repository. This runbook covers the
web app; the agent matters here only as the upstream for
`/api/calibration/[cameraId]` (GCS reads) and `/api/calibration/recalibrate`
(identity-token authenticated calls to the agent service).

## How the web app deploys (GitHub Actions)

The pipeline is `.github/workflows/deploy.yml`:

| Step | Detail |
| --- | --- |
| Trigger | Every push to `main` (i.e. every merged PR) |
| Serialization | `deploy-production` concurrency group — deploys queue, never overlap |
| Auth | Workload Identity Federation; impersonates `github-deploy@xwalk-keyboards-01.iam.gserviceaccount.com` (repo secrets `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`) |
| Build + deploy | `google-github-actions/deploy-cloudrun@v2`, source deploy of service `xwalk-keyboards` in `us-central1` |
| Smoke test | `/`, `/realtime`, `/realtime/5056`, `/about`, `/camera-registry` must all return < 400 or the run fails |

The one-time GCP setup (service account, roles, identity pool/provider) is
documented as commands in the workflow file's header comment.

**Manual `gcloud run deploy` is deprecated.** Use it only as a break-glass path
when Actions itself is down, and confirm the active account and project first.
To verify or roll back a release, use the Actions run history and the Cloud Run
revision list — they are the deployment record.

## Service configuration (env vars and secrets)

The CI deploy passes no env or secret flags, so the existing Cloud Run service
configuration carries forward on every revision. Change bindings in the service
configuration, not in the deploy pipeline.

Server-only variables (never `NEXT_PUBLIC_`; see `.env.example`):

| Variable | Source | Purpose |
| --- | --- | --- |
| `ROBOFLOW_API_KEY` | Secret Manager (`roboflow-api-key`) | Authenticates server-side Roboflow workflow and WebRTC initialization |
| `ROBOFLOW_WORKSPACE`, `ROBOFLOW_REALTIME_WORKFLOW_ID` | Env | Selects the Realtime detection workflow |
| `ROBOFLOW_IMAGE_INPUT`, `ROBOFLOW_DATA_OUTPUT`, `ROBOFLOW_CLASSES` | Env | Workflow input/output bindings; class filter (default `person`) |
| `ROBOFLOW_WEBRTC_PLAN`, `ROBOFLOW_WEBRTC_REGION` | Env | WebRTC worker sizing (defaults `webrtc-gpu-medium`, `us`) |
| `CALIBRATION_BUCKET`, `CALIBRATION_GCS_PREFIX` | Env (defaults `xwalk-keyboards-01`, `calibration`) | Where published calibrations are read from |
| `CALIBRATION_AGENT_URL` | Env (defaults to the agent's Cloud Run URL) | Recalibrate proxy target |
| `CALIBRATION_AGENT_API_KEY` | Local dev only | On Cloud Run the web app uses identity tokens instead |

The web app's runtime service account needs read access to the calibration GCS
objects and invoker rights on the calibration agent service.

## Local gcloud setup

Routine deploys never touch local gcloud. This is needed only for IAM changes
and Secret Manager operations:

```bash
gcloud auth list
gcloud config set project xwalk-keyboards-01
gcloud config get-value project
```

Do not use a work-account credential or project accidentally. Confirm the
active account and project before any IAM or secret change.

## Deploy flow

1. Merge the PR to `main`.
2. Watch the Actions run (build, deploy, route smoke test).
3. Spot-check the production URL.

## Post-deployment smoke test

CI already verifies the five routes return non-error statuses on every deploy.
For a functional pass after notable releases:

- Homepage loads with its live camera background.
- Realtime video starts independently from Roboflow inference.
- Realtime camera and inference recovery states work independently.
- The Camera Registry loads snapshots without invoking Roboflow.
- Leaving the study stops its audio and background work.
- Mobile layouts render per the `ui_mobile` Figma frames (spot-check the
  homepage and Realtime on a phone-sized viewport).

## Related references

- [Technical architecture](architecture.md)
- [User scenarios](users-scenarios.md)
- [Manual-deploy era record (retired 2026-08-17)](archive/deployment-record-manual-era.md)
