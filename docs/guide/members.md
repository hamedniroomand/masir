# Members and roles

Masir has two roles. That is a deliberate choice, and most teams never need a
third.

| | Owner | Member |
|---|---|---|
| Links, tags, campaigns | Yes | Yes |
| Analytics | Yes | Yes |
| Invite and remove people | Yes | |
| Workspace name and logo | Yes | |
| Transfer ownership | Yes | |
| Delete the workspace | Yes | |

Every extra role is another combination that can go wrong. If you find yourself
wanting one, what you usually want is a second workspace.

## Exactly one owner

A workspace has one owner, and Postgres enforces it with a partial unique
index:

```sql
create unique index workspace_members_one_owner_idx
  on workspace_members (workspace_id) where role = 'owner';
```

A second owner cannot be inserted even if application code tries. Rules like
this belong in the database, because the cost of getting them wrong is somebody
losing control of their workspace.

## Inviting people

From **Settings → Members**, the owner invites by email address. Every
invitation:

- joins the workspace as a **member**
- expires after **7 days**
- can be resent, which replaces the token and invalidates the previous link
- can be revoked

Only the invited address can accept. Someone signed in with a different account
who opens the link sees that the invitation belongs to another email address.

The token is stored as a hash. A copy of your database is not enough to forge an
invitation link.

Inviting an address that already has an open invitation answers `409`. Revoke
the first one, or resend it.

## Deactivating a member

Deactivating removes someone's access to **this** workspace and nothing else.

The flag lives on the membership, not on the user. That matters as soon as a
person belongs to two workspaces: removing a contractor from one client's
workspace must not lock them out of another. Their account, password, and other
memberships are untouched. Turn the switch back and they are in again.

## Transferring ownership

An owner cannot be deactivated, removed, or demoted. Each of those would leave
the workspace with nobody able to manage it, so each is refused with a clear
reason.

To hand over, use **Make owner** on another member and confirm in the dialog.
The transfer runs as one transaction that lowers you to member and raises the
target. You land on the dashboard as a member, with your links intact but
without the workspace and member settings. Only the new owner can give the role
back. If you then want to leave, ask the new owner to remove you.

Removing a member asks for the same confirmation.

## What a member sees

Members get links, tags, campaigns, and analytics. They do not get the
workspace or member settings, and those pages are not just hidden. The API
answers `404` for them, the same answer an outsider would get.
