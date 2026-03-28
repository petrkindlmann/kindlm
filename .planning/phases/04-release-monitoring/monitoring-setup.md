# UptimeRobot Monitoring Setup

**Plan:** 04-02 — Monitoring + E2E Verification
**Requirement:** MON-02
**Status:** Pending manual action

---

## What to configure

Monitor `GET https://api.kindlm.com/health` every 5 minutes using UptimeRobot.

Expected healthy response:
```json
{"status":"ok"}
```
Expected HTTP status: `200`

Degraded response (D1 database unreachable):
```json
{"status":"degraded","error":"Database unreachable"}
```
HTTP status for degraded: `503`

---

## Steps

1. Go to https://uptimerobot.com and sign up or log in.

2. Click **Add New Monitor** and configure:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** `KindLM API Health`
   - **URL:** `https://api.kindlm.com/health`
   - **Monitoring Interval:** 5 minutes
   - **Monitor Timeout:** 30 seconds

3. Under **Alert Contacts**, add your team email so you receive down/up notifications.

4. (Recommended) Enable **Keyword Monitoring**:
   - Keyword: `"status":"ok"`
   - This catches degraded states that return 200 but are unhealthy.

5. Click **Create Monitor**.

6. Wait up to 5 minutes. The monitor should show a green badge if the endpoint is healthy.

---

## Verification

Once created:
- [ ] Monitor shows green (up) status in UptimeRobot dashboard
- [ ] Test an alert by temporarily pointing URL at a bad path, confirm email arrives
- [ ] Restore URL to `https://api.kindlm.com/health`
- [ ] 5-minute interval confirmed in monitor settings

---

## Alternative services

| Service | Free tier | Min interval |
|---------|-----------|-------------|
| UptimeRobot | 50 monitors | 5 minutes |
| Better Uptime | 10 monitors | 1 minute |
| Freshping | 50 checks | 1 minute |

---

## Notes

- The `/health` endpoint performs a live D1 database probe (`SELECT 1`) before returning `{"status":"ok"}`.
- A `503` response means the database is unreachable — this warrants immediate investigation.
- The endpoint bypasses all auth and secret-validation middleware so it is always reachable even if secrets are misconfigured.
