# XWALK KEYBOARDS Deployment Runbook

This is the evolving deployment runbook for XWALK KEYBOARDS. It intentionally
starts small; add exact commands, service URLs, and configuration values as the
production app is implemented.

## Target Google Cloud project

| Setting | Value |
| --- | --- |
| Project ID | `xwalk-keyboards-01` |
| Primary runtime | Cloud Run |
| Agent runtime | Cloud Run with Google ADK and Vertex AI / Gemini |
| Default region | `us-central1` *(confirm before first deployment)* |

The hackathon eligibility gate requires the **agent** to be deployed on Google
Cloud Run. We will deploy both the web app and the score agent there.

## Planned services

| Service | Repository / runtime | Responsibility | Status |
| --- | --- | --- | --- |
| `xwalk-keyboards` | Next.js | Public web app, server-side camera/Roboflow proxies, batch-score proxy | Deployed |
| `crosswalk-score-agent` | Python, Google ADK | Gemini visual scoring of immutable Orchestration batches | Not deployed to this project |

The existing `crosswalk-agent` prototype was previously deployed to a separate
test project. Its configuration and deployment script are a reference only;
the production deployment must use `xwalk-keyboards-01`.

## Bootstrap checklist

- [x] Create project `xwalk-keyboards-01`.
- [x] Enable the Google ADK-related APIs.
- [ ] Confirm billing is enabled.
- [ ] Select the production Cloud Run region.
- [ ] Enable required runtime APIs if not already enabled:
  - Cloud Run Admin API
  - Cloud Build API
  - Artifact Registry API
  - Secret Manager API
  - Vertex AI API
- [ ] Create least-privilege runtime service accounts for the web app and
  score agent.
- [ ] Create a separate build/deployment identity with only the roles needed
  to build and deploy Cloud Run services.
- [ ] Configure Secret Manager values.

## Local gcloud setup

From each repository, verify the active account and set the project explicitly:

```bash
gcloud auth list
gcloud config set project xwalk-keyboards-01
gcloud config get-value project
```

If Application Default Credentials will be used for local ADK/Vertex AI work,
set their quota project after authenticating with the intended personal account:

```bash
gcloud auth application-default set-quota-project xwalk-keyboards-01
```

Do not use a work-account credential or project accidentally. Confirm the
active account and project before any deployment or IAM change.

## Required secrets

Create secret values before deploying, but never commit them to a repository or
place them in a `NEXT_PUBLIC_` browser variable.

| Secret | Used by | Purpose |
| --- | --- | --- |
| `roboflow-api-key` | Web app | Authenticates server-side Roboflow workflow and WebRTC initialization requests |
| `crosswalk-agent-api-key` | Web app and score agent | Authenticates the web app’s server-to-server score request |
| Additional provider secrets | As needed | Add only when a deployed integration requires them |

The web app receives the agent key and Roboflow key from Secret Manager. The
score agent receives only its own application key and uses its Cloud Run service
account for Vertex AI access.

## Score-agent deployment contract

The score agent requires these runtime settings:

```text
GOOGLE_CLOUD_PROJECT=xwalk-keyboards-01
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true
CROSSWALK_AGENT_MODEL=gemini-2.5-flash
CROSSWALK_AGENT_API_KEY=<Secret Manager reference>
CROSSWALK_RATE_LIMIT_PER_MINUTE=10
```

Before deployment, verify:

- the agent service account can invoke Vertex AI;
- the service can read `crosswalk-agent-api-key` from Secret Manager;
- the container exposes `GET /health` and `POST /api/score-batch`;
- the application key is required for `POST /api/score-batch`.

After deployment, record the Cloud Run URL here:

```text
Score agent URL: pending
```

## Web-app deployment contract

The Next.js app is the public entry point. It needs server-only environment
variables for:

```text
ROBOFLOW_API_KEY
ROBOFLOW_WORKSPACE
ROBOFLOW_REALTIME_WORKFLOW_ID
ROBOFLOW_SNAPSHOT_WORKFLOW_ID
ROBOFLOW_*_INPUT / OUTPUT bindings
CROSSWALK_AGENT_URL
CROSSWALK_AGENT_API_KEY
```

After deployment, record the Cloud Run URL here:

```text
Web app URL: https://xwalk-keyboards-21826886868.us-central1.run.app
```

## Deployment order

1. Deploy and verify `crosswalk-score-agent`.
2. Set `CROSSWALK_AGENT_URL` in the web-app service configuration to that
   deployed URL.
3. Deploy `xwalk-keyboards` with its server-only secrets and Roboflow workflow
   bindings.
4. Open the public web URL and run the smoke tests below.

## Post-deployment smoke test

### Score agent

- `GET /health` returns HTTP 200 and the expected model name.
- An authenticated multipart request with a known valid composite and manifest
  returns twelve schema-valid score events with the same `batchId`.
- An unauthenticated score request is rejected.

### Web app

- Homepage loads with its live camera background.
- Realtime video starts independently from Roboflow inference.
- Realtime camera and inference recovery states work independently.
- Orchestration shows its initial grid, fills queues, and begins a scored
  60-second loop only when a complete batch is ready.
- A known unavailable static camera is replaced by an available fallback
  without changing the grid slot or breaking the loop.
- The Camera Registry loads snapshots without invoking Roboflow.
- Leaving either study stops its audio and background work.

## Deployment record

Add an entry for every production deployment:

| Date | Service | Revision | URL | Deployed by | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-08-07 | `xwalk-keyboards` | `xwalk-keyboards-00005-m82` | https://xwalk-keyboards-21826886868.us-central1.run.app | `vince@vinceallen.com` | Public web app; Roboflow and score-agent keys injected from Secret Manager. |
| 2026-08-09 | `xwalk-keyboards` | `xwalk-keyboards-00006-769` | https://xwalk-keyboards-21826886868.us-central1.run.app | `vince@vinceallen.com` | Figma alignment pass across Homepage, Realtime, and Camera Registry. Source deploy with no env/secret flags, so existing Secret Manager bindings and IAM carried forward. Runtime image now prunes devDependencies. Smoke test: `/api/health` 200, all four routes 200. |
| 2026-08-11 | `xwalk-keyboards` | `xwalk-keyboards-00017-trr` | https://xwalk-keyboards-21826886868.us-central1.run.app | `vince@vinceallen.com` | First-visit Realtime instructions modal plus the keyboard-POV inference status vocabulary. Source deploy with no env/secret flags. Deployed from branch `realtime-instructions-modal` (commit `79cd983`); revisions `00007`–`00016` were deployed without a record entry. Smoke test: all five routes 200; modal renders after hydration with the expected copy, dismissal persists across reload, and the header info icon reopens it. |
| 2026-08-11 | `xwalk-keyboards` | `xwalk-keyboards-00018-lmn` | https://xwalk-keyboards-21826886868.us-central1.run.app | `vince@vinceallen.com` | RECALIBRATE moved out of the feed status line into the Ctrl+Shift+D debug panel. Source deploy with no env/secret flags. Deployed from branch `move-recalibrate-to-debug` (commit `98837d4`). Smoke test: all five routes 200; status bar carries no buttons, debug panel lists RENDER POLYGONS / FORCE UNAVAILABLE / FORCE PAUSE MODAL / RECALIBRATE, and no `.realtime-recalibrate` rules remain in the served CSS. |

## Related references

- [Technical architecture](architecture.md)
- [User scenarios](users-scenarios.md)
- `crosswalk-agent/deploy.sh` — prior prototype deployment reference
