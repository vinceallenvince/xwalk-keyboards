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
| `xwalk-keyboards` | This repo, Next.js | Public web app; server-side HLS proxy | https://xwalk-keyboards-21826886868.us-central1.run.app |

The calibration agent (`xwalk-camera-calibration-agent`) served the retired
Realtime study and is being shut down from its own repository. The web app no
longer calls it.

## How the web app deploys (GitHub Actions)

The pipeline is `.github/workflows/deploy.yml`:

| Step | Detail |
| --- | --- |
| Trigger | Every push to `main` (i.e. every merged PR) |
| Serialization | `deploy-production` concurrency group — deploys queue, never overlap |
| Auth | Workload Identity Federation; impersonates `github-deploy@xwalk-keyboards-01.iam.gserviceaccount.com` (repo secrets `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`) |
| Build + deploy | `google-github-actions/deploy-cloudrun@v2`, source deploy of service `xwalk-keyboards` in `us-central1`, with Direct VPC egress through the `default` subnet for private ranges |
| Network verification | Confirms every deployed revision retains the expected network, subnet, network tag, `private-ranges-only` egress mode, and server-only CARLA origin configuration |
| Smoke test | Requests the app's public routes (the homepage, `/realtime`, which redirects to the homepage, `/about`, `/camera-registry`); every one must return < 400 or the run fails. The workflow file holds the current list |

The one-time GCP setup (service account, roles, identity pool/provider) is
documented as commands in the workflow file's header comment.

The GitHub deploy service account has `roles/compute.networkUser` on only the
`us-central1/default` subnet. That subnet-level binding lets deployments retain
Direct VPC egress without granting project-wide network use.

**Manual `gcloud run deploy` is deprecated.** Use it only as a break-glass path
when Actions itself is down, and confirm the active account and project first.
To verify or roll back a release, use the Actions run history and the Cloud Run
revision list — they are the deployment record.

## Service configuration (env vars and secrets)

The CI deploy passes no env or secret flags, so the existing Cloud Run service
configuration carries forward on every revision. It does explicitly pass the
Direct VPC flags and verifies them after deployment so the private CARLA origin
route cannot be dropped silently. Change environment and secret bindings in the
service configuration, not in the deploy pipeline.

Server-only variables (never `NEXT_PUBLIC_`; see `.env.example`):

| Variable | Source | Purpose |
| --- | --- | --- |
| `CARLA_HLS_BASE_URL` | Env | Private HLS directory for registered CARLA camera 90014; resolved only by the server-side proxy |

The `ROBOFLOW_*` and `CALIBRATION_*` variables, the `roboflow-api-key` secret,
and the runtime service account's calibration-bucket read and agent-invoker
grants served the retired Realtime study. Nothing reads them now; remove them
from the service configuration once the retirement deploy is confirmed.

## Local gcloud setup

Routine deploys never touch local gcloud. This is needed only for IAM changes
and Secret Manager operations, such as removing the retired Roboflow secret:

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

CI already verifies the smoke-test routes return non-error statuses on every deploy.
For a functional pass after notable releases:

- Homepage loads with its live camera background, and the introduction video
  plays with sound.
- `/realtime/5059` redirects to the homepage.
- The Camera Registry plays every registered camera's preview.
- Mobile layouts render per the `ui_mobile` Figma frames (spot-check the
  homepage on a phone-sized viewport).

## Related references

- [Technical architecture](architecture.md)
- [User scenarios](users-scenarios.md)
- [Manual-deploy era record (retired 2026-08-17)](archive/deployment-record-manual-era.md)
