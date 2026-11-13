# CircleCI backend_db_tests job

1. Add a job **`backend_db_tests`**. It can be a new job; it should not be a `yarn_project` instance, because that job's `docker:` takes only one image.

   ```yaml
   backend_db_tests:
     docker:
       - image: darthjee/circleci_kerghan-base:0.1.0
         environment:
           KERGHAN_MYSQL_HOST: 127.0.0.1
           KERGHAN_MYSQL_PORT: "3306"
           KERGHAN_MYSQL_USER: kerghan
           KERGHAN_MYSQL_PASSWORD: kerghan
           KERGHAN_MYSQL_NAME: kerghan_test
       - image: mysql:8.4.11
         environment:
           MYSQL_DATABASE: kerghan_test
           MYSQL_USER: kerghan
           MYSQL_PASSWORD: kerghan
           MYSQL_ROOT_PASSWORD: kerghan
     steps:
       - checkout
       - setup_project: { dir: backend }
       - run: { name: DB tests, command: npm run test:db }
   ```

   Alternatively, add an optional `db_service` boolean parameter to `yarn_project`. Pick whichever keeps the file simplest. No coverage upload.
2. **Workflow:** add `backend_db_tests` with `requires: [release-circleci_kerghan-base, release-circleci_kerghan-base-arm64]` and `filters: *all_tags`, matching `backend_tests`.
3. **Gating:** add `backend_db_tests` to `requires` everywhere `backend_tests` is required for release and deploy:
   - `build-and-release`;
   - `release-kerghan`;
   - `upload_proxy_files`;
   - `upload_fe_files`.

   It stays out of `coverage-final`, because the job reports no coverage.
4. Replace the stale comment above `backend_tests` ("No DB service container yet … Add a cimg/mysql:8.0 service …") with a pointer to `backend_db_tests`.
5. Validate the config through docker.

## Files to Change
- `.circleci/config.yml`: the new job, the workflow entry, the gating, and the comment.
