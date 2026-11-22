# U10 on the edit form

- The edit form keeps the `updatedAt` it loaded.
- On window focus, throttled to 30 s through `useFocusReread`, it calls `IssuesClient.show` without touching the fields.
- If the returned `updatedAt` is newer, it shows a warning banner "This issue changed since you opened it" with "Discard my changes and reload". That action resets the fields to the fresh issue, through the dirty-form guard's clean path so no U11 prompt appears, and takes the new `updatedAt`.
- Save stays allowed, because edit is last-write-wins.
- A `404` on the focus read shows "Issue not found" (U1). Errors other than `404` are ignored.
- The new-issue form has no U10.

## Files to Change
- `frontend/assets/js/components/resources/issues/pages/form/useIssueForm.js`, `IssueFormController.js`, `IssueFormHelper.jsx`
- `frontend/assets/js/components/resources/issues/pages/form/IssueChangedBannerHelper.jsx` (new)
- specs: no banner when `updatedAt` is unchanged, the banner when it is newer, discard-and-reload resetting the fields without the U11 prompt, the fields untouched by the read, Save still enabled, the 30 s throttle (tagged U10)
