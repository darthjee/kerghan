# Add e2e coverage for forged and legitimate requests
Add an e2e spec using `useTestApp`/`buildAuthTestApp` that checks through the real HTTP stack:

- `POST /auth/login.json` with `Sec-Fetch-Site: cross-site` and `Origin: https://evil.example` gets `403` and sets no cookie (login CSRF is blocked).
- An authenticated mutating route (e.g. `PATCH /auth/account.json` or `DELETE /auth/logoff.json`) called with the session cookie **and** cross-site headers gets `403`.
- The same requests with `Sec-Fetch-Site: same-origin` succeed.
- A request from an allowlisted origin (set `KERGHAN_ALLOWED_ORIGINS` through `configOverrides`) with `Sec-Fetch-Site: same-site` succeeds.
- A request with neither header (the non-browser client case) still succeeds.

## Files to Change
- `backend/src/auth/tests/auth.controller.csrf.e2e-spec.ts` — new: e2e coverage for the cases above.
