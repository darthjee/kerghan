# Plan: Frontend: "Keep me signed in" checkbox

Issue: [320-frontend-keep-me-signed-in-checkbox.md](../../issues/320-frontend-keep-me-signed-in-checkbox.md)

## Overview

Add an unchecked-by-default "Keep me signed in" checkbox to the login modal's Password and
Authorize-with-logged-device tabs. Send it as `keepSignedIn` on login and on authorization-request
create, and show a "Keep signed in" badge on flagged open requests on the approver's Authorization
Requests page. The work is frontend-only and consumes the backend contract that #319 already merged.

See [frontend.md](frontend.md) for the full plan.
