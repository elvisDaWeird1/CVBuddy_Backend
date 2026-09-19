# Admin Operations

CVBuddy does not expose public admin registration. Provision an admin only from a trusted backend host with production database access.

## Create an admin

Run the idempotent command with the admin email as a non-secret argument:

```powershell
npm run provision:admin -- --email admin@example.com
```

Enter the password at the hidden prompt. The script rejects `--password` so the password is not placed in shell history or the process argument list. It writes only the action, account ID, role, status, and completion timestamp to output.

For non-interactive deployment, provide the password on standard input directly from the platform secret manager. Do not use a password literal with `echo`, command arguments, committed files, or deployment logs.

## Promote an existing account

The command refuses to change an Applicant or Company account unless promotion is explicit:

```powershell
npm run provision:admin -- --email existing-account@example.com --promote-existing
```

Promotion changes the account role to `ADMIN`, sets status to `ACTIVE`, and replaces its password with the hidden value entered for this operation. Existing role-specific profile records are retained; verify operational intent before using this option.

## Idempotency and verification

- Re-running the command for an existing Admin returns `already-admin` without changing the account.
- A concurrent create that already produced the same Admin is also treated as `already-admin`.
- Login normally, call `GET /api/auth/me`, then call `GET /api/admin/metrics/overview` with the bearer token.
- Record the safe command result in the deployment change log. Never record the password.

## Metric definitions

- `totalUsers`: Applicant plus Company accounts; Admin accounts are excluded.
- `applicants` and `companies`: role breakdown of total users.
- `activeUsers`: Applicant and Company accounts with `ACTIVE` status.
- `newUsersLast7Days`: Applicant and Company accounts created in the preceding 7 x 24 hours.
