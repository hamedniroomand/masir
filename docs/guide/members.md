# Members and roles

> Give each person the smallest role that supports their work.

A workspace has one owner and any number of members and viewers.

## Compare roles

| Action | Owner | Member | Viewer |
|---|:---:|:---:|:---:|
| Read links | Yes | Yes | Yes |
| Read analytics | Yes | Yes | Yes |
| Create and change links | Yes | Yes | No |
| Manage the workspace | Yes | No | No |
| Manage members | Yes | No | No |

The database permits exactly one owner.

## Invite a person

The owner opens workspace members, enters an email address, and chooses
**Member** or **Viewer**.

Masir sends a single-use invitation link. The link opens the invite page. The
page shows the workspace name, the invited email, and the role.

- A new person sets a password on the page. Masir creates the account and
  signs the person in.
- A person who already has an account signs in first. Masir returns them to
  the invitation. The account must use the invited email address.

An invitation proves the email address. Masir does not send a separate
verification message.

Only one open invitation can exist for the same workspace and email address.

## Change access

The owner can move a member between Member and Viewer. Role changes take effect
on the next request.

The owner can also deactivate a member. A deactivated membership stays in the
workspace record but grants no access.

## Remove a member

Removing a member deletes the membership. It does not delete links or history
that the person created.

The owner cannot remove or deactivate the current owner.

## Transfer ownership

Select an active member and transfer ownership. Masir demotes the current owner
and promotes the new owner in one transaction.

The database rejects any state with zero or two owners.

## Use Viewer for read-only access

A viewer can open the dashboard, link details, QR codes, analytics, campaigns,
and tags where read access applies. A viewer cannot create, edit, rename, or
delete workspace content.

<ReadMore to="/guide/authentication" title="Configure account sign-in" />

