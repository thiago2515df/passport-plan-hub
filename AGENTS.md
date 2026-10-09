<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Transport data travels with the existing encoded proposal so old hotel-only links remain compatible.
- Ticket attachments use a private Cloud bucket, insert-only uploads and two-random-UUID bearer capabilities; server-generated short-lived URLs disclose one file only, never list files.
- Keep transport editing and customer viewing in TransportPanel to share itinerary rendering and validation.
- Share city suggestions through useCitySuggestions with session caching and stale-response guards so origin and destination behave consistently.
- Keep seller identity in profiles, roles in user_roles, and permissions in seller_permissions; validate administrative actions server-side to prevent privilege escalation.
- Store proposal ownership from the authenticated request, and serve shared proposals only through exact-code lookup so sellers cannot browse each other's work.
- Keep a single AccessProvider for session transitions and permission-driven UI; private workspace pages live under the managed client-only authenticated layout, while login, password recovery and customer proposals remain public.
- Provision the first administrator only through trusted out-of-band administration; seller creation validates the administrator server-side and emails a password-setup link.
- Use one shared ManagementNav sidebar on all workspace screens, preserving icon navigation when collapsed.
- Persist Kanban status and timestamps on proposals; only explicit sending confirmation marks awaiting, with three grouped columns and server-authorized owner/admin updates.
- Hydrate proposal editing through authenticated exact-code reads and update the same code without replacing ownership; preserve guest counts and destination IDs in the encoded search metadata.
- Generate proposal-sharing text through one browser-safe formatter for clipboard and WhatsApp so both actions always use identical personalized content.
- Share versioned public proposal-preview artwork and absolute social-image metadata across short and legacy proposal routes so crawlers see the same branded preview without authentication.
- Keep flight comparison cards container-responsive in a wider result track and hotel results compact and paginated through a shared pagination helper, so neither result type squeezes or clips the other.
