# Members and roles

Masir has two roles. That is a deliberate choice, not an unfinished one.

| | Owner | Member |
|---|---|---|
| Links, tags, campaigns | Yes | Yes |
| Analytics | Yes | Yes |
| Invite and remove people | Yes | — |
| Workspace settings | Yes | — |
| Transfer ownership | Yes | — |
| Delete the workspace | Yes | — |

Most teams do not need a middle tier, and every extra role is another
combination to get wrong. If you find yourself wanting one, the thing you
usually want is a second workspace.

## Exactly one owner

A workspace has one owner, and Postgres enforces it with a partial unique
index:

```sql
CREATE UNIQUE INDEX workspace_members_single_owner_idx
  ON workspace_members (workspace_id)
  WHERE role = 'OWNER';
```

A second owner cannot be inserted even if application code tries. That is the
kind of rule worth pushing into the database, because the cost of it being
wrong is somebody losing control of their workspace.

## Inviting people

The owner invites by email address. Every invitation joins as a member, expires
after seven days, and can be resent or revoked.

Only the invited address can accept. Signing in as somebody else and opening the
link gives you:

> This invitation belongs to another email address.

The invitation token is stored as a hash, so somebody with a copy of your
database still cannot forge an invitation link. Resending replaces the token,
which invalidates the previous link.

## Deactivating without deleting

Deactivating a member revokes their access to that workspace and nothing else.

The flag lives on the membership, not on the user, which matters the moment
somebody belongs to two workspaces. Removing a contractor from one client's
workspace must not lock them out of another — so it does not.

Their account, their password, and their other memberships are untouched. Flip
the switch back and they are in again.

## Transferring ownership

Owners cannot be deactivated, removed, or demoted. Each of those is refused with
a clear reason, because each of them would leave the workspace with nobody able
to manage it.

To hand over, use **Make owner** on another member. The transfer runs as one
transaction that lowers the current owner to member and raises the target,
which is also the only order the single-owner index allows.

After transferring, you are a member. If you then want to leave entirely, ask
the new owner to remove you.

## What a member sees

A member gets the links, tags, campaigns, and analytics. They do not get the
workspace or members settings, and those pages are not merely hidden — the API
answers `404` for them, the same answer an outsider gets.
