# Plan: Tune the CI MySQL container for the DB tests job

Issue: [584-tune-the-ci-mysql-container-for-the-db-tests-job.md](../../issues/584-tune-the-ci-mysql-container-for-the-db-tests-job.md)

## Overview
Start the throwaway `mysql:8.4.11` secondary container of the `backend_db_tests` CircleCI job with durability-relaxing flags, document why, and keep the change only if CI timings show a gain of about 10% or more in the median.

See [infra.md](infra.md) for the full plan.
