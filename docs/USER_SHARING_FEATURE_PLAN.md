# User Profiles, Collection Sharing, and Watch-Site Copying

## Purpose

Let users discover profiles, view collections users choose to share, follow one another, and copy reusable watch sites. This document is an implementation handoff plan; it does not itself authorize changing the feature scope or privacy rules below.

## Decisions and defaults

- New and existing accounts default to **public profile**, **collection sharing enabled**, and **watch-site sharing enabled**.
- Users can independently change profile visibility, collection sharing, and watch-site sharing.
- Public profiles may be found through authenticated user search.
- Private profiles are excluded from user search. A user who has a direct profile URL can see the minimum profile information needed to send a follow request, but cannot see the private collection or sites before approval.
- Following a public profile takes effect immediately. Following a private profile creates a request that must be approved.
- Only the profile owner can approve or reject requests and remove followers.
- Follower/following counts are shown on public profiles. For private profiles, show counts only to the owner and approved followers. Do not show follower/following lists in this initial release.
- Shared collections are read-only. Proposed initial shared fields: anime title/cover, status, and episode progress. Keep personal ratings and favorites private unless product requirements later explicitly include them.
- Users can copy **reusable user sites only**. Do not copy anime-specific URL overrides.
- Copied sites have a separate section from official sites and the user's own sites.
- Account creation requires acceptance of the current Terms. Existing users must accept the current Terms at their next login before accessing protected app functionality.
- No posts, likes, comments, activity feed, or public follower lists in this release.

## User experience

### Settings and profile

Add a privacy/sharing section with:

- Profile visibility: Public / Private.
- Share my collection: On / Off.
- Share my reusable watch sites: On / Off.
- A concise explanation that private profiles require approval before collection or site access.

Add a public profile page showing the avatar and username. Never show email or other private account data. For a public profile, show the collection and/or reusable sites only when their corresponding sharing setting is enabled. For a private profile, show the minimal profile view and follow-request action until approved.

### User search and following

Add a **Search Users** navigation item and a paginated search by username. Return only public profiles in search results. Each result may show the avatar, username, and permitted follower count.

Support:

- Follow / unfollow for public profiles.
- Request to follow / cancel request for private profiles.
- Approve / reject incoming requests.
- Remove an existing follower.
- Clear pending-request and already-following states.

Prevent following oneself and duplicate follow/request records.

### Collection viewing

Visitors cannot mutate another user's collection. Respect the profile's visibility, follow approval, and collection-sharing setting on every request. Do not rely on the frontend to enforce privacy.

### Copying reusable watch sites

Offer a copy action for an individual eligible site and a flow to select all or specific sites. Before the first copy, show a confirmation warning that the sites are user-contributed third-party links, can change or be unsafe/unreliable, and users should exercise caution. This warning is a safety notice, not a claim that the application is legally free of liability.

In the copied-sites area:

- Keep copied sites distinct from official sites and sites the user created.
- Show source attribution (source username and site name) where possible.
- Let the user remove a copied site.
- Do not overwrite or silently merge the user's own sites.
- Define duplicate behavior explicitly: avoid duplicate copies of the same source site for the same user and show a clear already-copied state.
- Do not copy anime-specific URL overrides or any data beyond reusable site name/URL and the minimum source attribution.
- Validate copied URLs server-side; allow only `http` and `https`.

If the source disables site sharing, becomes private without the viewer's approval, or removes the relevant site, prevent new copies. Decide whether existing copies are snapshots or are revoked/updated when the source changes; recommended MVP behavior is that existing copies remain snapshots, clearly attributed as copied, and can be removed by the recipient.

## Backend and data design

Adapt names to existing models and conventions; these are logical entities, not mandated class names.

1. **User privacy preferences:** profile visibility and independent collection/site sharing booleans. Database defaults and migration backfill must make existing and new users public with both sharing flags enabled.
2. **Follow relationship:** follower ID, followed-user ID, state (`pending` or `accepted`), timestamps, and uniqueness on the directed pair. Public follows can be recorded as accepted immediately; private follows start pending.
3. **Copied site:** recipient ID, source user ID, source site identifier if durable, copied site name/URL snapshot, and timestamps. Enforce a uniqueness constraint to prevent duplicate copies from the same source site.
4. **Terms acceptance:** accepted terms version and timestamp (or a related acceptance record if existing account architecture requires audit history). Keep the current terms version in one authoritative place.

Use additive, reversible migrations. Preserve existing users' library and site data. Ensure models are registered with Alembic and test metadata using the repository's established patterns.

### Authorization rules

Centralize access checks and apply them to every profile, collection, and site endpoint:

- Public profile: accessible to authenticated users.
- Private profile details, collection, and shared sites: accessible only to the owner and approved followers.
- Collection access additionally requires collection sharing enabled.
- Site listing/copy additionally requires site sharing enabled.
- Search returns public profiles only.
- Never return email, credentials, tokens, private notes, or other fields not explicitly part of the public profile schema.
- Reject self-follow, duplicate requests, unauthorized approvals/rejections, unauthorized copies, and invalid site URLs with appropriate status codes.
- Apply pagination and input validation to search and collection endpoints.

Suggested endpoint shape (align with the existing API versioning and response conventions):

- Search users by username.
- Read a profile and its permitted public summary.
- Read a permitted user's shared collection.
- Follow, unfollow, request, cancel, approve, reject, and remove follower.
- List permitted reusable shared sites and copy selected site IDs.
- List and remove the current user's copied sites.
- Read/update the current user's privacy preferences.
- Read current Terms version and submit acceptance.

Do not expose a site's URL through a search result or profile response if site sharing/access checks fail.

## Terms acceptance

- Add a readable Terms page or dialog with a version identifier.
- Require an explicit, unchecked-by-default acceptance control at registration.
- Record acceptance server-side; do not trust a client boolean alone.
- On login or protected API access, compare the account's accepted version to the current version and gate app access until accepted.
- Provide an acceptance screen and submit endpoint for existing users; record version and timestamp.
- Keep recovery, logout, and terms acceptance routes accessible while gated.
- Do not represent the brief site-copy warning as a substitute for Terms or jurisdiction-specific legal review.

## Implementation phases

1. **Confirm product details:** approve collection fields shared (especially ratings/favorites), Terms text/version, copy-snapshot behavior, and profile discovery behavior for private profiles.
2. **Database and models:** preferences, follows/requests, copied-site records, terms acceptance, migration defaults and backfill.
3. **Backend APIs and tests:** implement centralized privacy checks, follow transitions, copy validation, terms gating, pagination, and authorization-denial tests.
4. **Profile and user search UI:** settings controls, search navigation/results, profile view, follow/request controls, and read-only shared collection.
5. **Site-copy UI:** warning/confirmation, select-all and per-site selection, copied-sites section, attribution, duplicate handling, and removal.
6. **Terms flow:** registration checkbox, current terms presentation, login gate for existing users, and server-recorded acceptance.
7. **End-to-end verification:** run migrations against an isolated test database, test fresh and existing users, verify privacy boundaries as owner/follower/non-follower, and run relevant backend/frontend checks.

## Acceptance criteria

- Existing and newly created users default to public with collection and site sharing enabled.
- Turning off collection or site sharing hides only that resource and is enforced by the API.
- Private profiles are absent from search; direct access permits only the minimum profile/request view until follow approval.
- Approved followers can see only the resources currently enabled by the owner.
- Public follow and private follow-request state transitions are correct; self-follow and duplicates are rejected.
- Visitors can view but never edit another user's collection.
- Email and private account data are never exposed in search/profile responses.
- Only eligible reusable sites are copyable; all-selected and individually selected copies work.
- Invalid URLs and unauthorized copy attempts are rejected server-side.
- Copied sites are separate, attributable, removable, and duplicate-safe.
- Registration requires Terms acceptance; existing users are gated until they accept the current version.
- Migration defaults/backfill preserve existing data and can be safely rolled back.
- The initial release contains no posts, likes, comments, or follower lists.
