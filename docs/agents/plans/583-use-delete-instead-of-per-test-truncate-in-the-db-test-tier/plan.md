# Plan: Use DELETE instead of per-test TRUNCATE in the DB test tier

Issue: [583-use-delete-instead-of-per-test-truncate-in-the-db-test-tier.md](../../issues/583-use-delete-instead-of-per-test-truncate-in-the-db-test-tier.md)

## Overview
Make the DB test tier's per-test cleanup cheaper by emptying tables with `DELETE FROM` instead of `TRUNCATE TABLE`, and by listing the tables once per test file.

See [backend.md](backend.md) for the full plan.
