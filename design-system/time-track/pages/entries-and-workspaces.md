# Entries and workspaces

The existing Google Sans design uses square surfaces throughout. Admin workspaces use indigo
(`#4338ca`); organizer workspaces use teal (`#0f766e`). Both use the same navigation, page frame,
form spacing, and responsive content widths. Color supplements visible role labels.

Event covers are uploaded during creation or from the event overview. The server checks the
organizer's ownership, decodes supported raster formats, strips metadata by re-encoding to WebP,
limits dimensions, and stores the result in the public `event-covers` bucket. Client writes to
the bucket are not allowed. Existing covers remain available for cached pages after replacement.

Account entries use the event cover as a background with a dark contrast overlay. The cover links
to the private entry page, which lists each participant's full unique ID and signed QR code after
payment confirmation. Scanning the QR requires a signed-in entry owner, event organizer, or admin;
current payment state is checked again. Verification does not record attendance.

Paid invoices use stored registration totals and matching successful payments. Owners can print
or save PDF through the browser's print dialog. Sandbox invoices and tickets are clearly labeled.
Unpaid, cancelled, and refunded entries do not produce valid tickets or paid invoices.

Usernames are unique, case-insensitive handles of 3–32 letters, digits, or underscores. Changing
a handle does not replace participant names, billing names, passwords, roles, or contact details.

UI UX Pro Max's accessibility, touch-target, contrast, and responsive-layout reference guidance
was applied. Its optional Python search CLI was unavailable in this workspace. Automated tests
cover payment gates, signature tampering, upload validation, ownership, and username constraints.
