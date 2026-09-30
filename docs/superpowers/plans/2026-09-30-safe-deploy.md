# Safe local deploy plan

Spec: [Safe local deploy](../specs/2026-09-30-safe-deploy-design.md)

1. Add a failing multi-chunk test in `src/utils/__tests__/static-deploy.test.ts`.
2. Update `writeStaticFiles` to stage every chunk before atomically replacing the entry; run targeted tests.
3. Add `deploy.sh` and point the package deploy script to it. Update the development guide.
4. Run lint and build, commit, review once, then integrate locally and run `deploy.sh` from main. Do not push.
