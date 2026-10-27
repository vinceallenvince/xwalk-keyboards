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
| Build + deploy | `google-github-actions/deploy-cloudrun@v2`, source deploy of service `xwalk-keyboards` in `us-central1` |
| Smoke test | Requests the app's public routes (the homepage, `/realtime`, which redirects to the homepage, `/about`, `/camera-registry`); every one must return < 400 or the run fails. The workflow file holds the current list |

The one-time GCP setup (service account, roles, identity pool/provider) is
documented as commands in the workflow file's header comment.

**Manual `gcloud run deploy` is deprecated.** Use it only as a break-glass path
when Actions itself is down, and confirm the active account and project first.
To verify or roll back a release, use the Actions run history and the Cloud Run
revision list — they are the deployment record.

## Service configuration (env vars and secrets)

The CI deploy passes no env or secret flags, so the existing Cloud Run service
configuration carries forward on every revision. Change environment and secret
bindings in the service configuration, not in the deploy pipeline.

The service needs no environment variables, secrets, or VPC access, and the
project holds no secrets. On 2026-10-27, after the retirement deploy, the
settings for retired features were removed:

- the 13 `ROBOFLOW_*` variables and the `ROBOFLOW_API_KEY` mount of the
  `roboflow-api-key` secret (the Realtime study), in revision
  `xwalk-keyboards-00101-cc8`
- `CROSSWALK_AGENT_URL` and the `CROSSWALK_AGENT_API_KEY` mount of the
  `crosswalk-agent-api-key` secret (the earlier Orchestration study), in
  revision `xwalk-keyboards-00102-md8`
- `CARLA_HLS_BASE_URL`, Direct VPC egress, and `github-deploy`'s
  `roles/compute.networkUser` binding on the `us-central1/default` subnet
  (the private CARLA camera 90014), once the workflow stopped passing VPC
  flags. The CARLA VM, disk, firewall rules, and probe job are torn down from
  the `carla-min-gcp` repository

Both secrets were then deleted, and the Roboflow API key was rolled in the
Roboflow dashboard. Revisions `00101` and earlier mount those deleted secrets
and can no longer start, so `00102-md8` is the oldest revision you can roll
back to. The calibration agent's resources were shut down from its own
repository.

## Local gcloud setup

Routine deploys never touch local gcloud. This is needed only for IAM changes
and Secret Manager operations:

```bash
gcloud auth list
gcloud config set project xwalk-keyboards-01
gcloud config get-value project
```

Do not use a work-account credential or project accidentally. Confirm the
active account and project before any IAM or secret change. If your gcloud
default points at another project, pass `--project xwalk-keyboards-01` (and
`--region us-central1` for Cloud Run) on every command instead of switching.

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
