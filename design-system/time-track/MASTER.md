# Time Track homepage design

## Direction

Race-day editorial on a white canvas: a bold split hero, real athletics photography, oversized typography, and clear athlete and organizer paths.

The UI UX Pro Max search recommended a hero-centric pattern, bold asymmetry, a sports-oriented display font, and restrained motion. Its generic red team palette is replaced with Time Track's existing lime identity. Existing Outfit and Inter fonts avoid another font request.

## Tokens and layout

- Brand: existing #ccff00 lime; dark surface #151915; paper #f2f3eb; primary ink #171a16; muted ink #5c6156.
- Homepage tokens are scoped to home.module.css. Other routes retain their design.
- Headlines: Outfit 900. Body: Inter, 16px with generous line height. Timing illustration: tabular monospace.
- Layout: split hero, static discipline strip, real events or an honest empty state, services, organizer CTA.
- Photography: Jonathan Chng, https://unsplash.com/photos/group-of-man-running-on-the-field-_crVhuQyG34. Downloaded locally as public/images/home-race.jpg.

## Behavior

- Primary athlete action: /events. Secondary: /results. Organizer action: /contact.
- Existing English/Bahasa Melayu selection is retained throughout homepage copy.
- Use actual event records, prices, and dates. Do not invent event listings or statistics.
- Hero photo preloads through next/image. Below-fold event photos load lazily.
- No video, continuous animation loops, backdrop blur, artificial loading delay, or pointer tracking on homepage cards.
- Text enters word by word with a short upward movement and a 4px blur (6px on the hero heading), settling fully clear. Stagger delays are capped. A shared IntersectionObserver reveals each group once.
- Header uses an Ascend-inspired upward entrance; no Canva animation preset was exported. On scroll, its black surface expands across the viewport and corners become square.
- Hero and service backgrounds expand via native CSS scroll timelines and clip-path masks. Text and image layouts retain their size. IntersectionObserver provides a threshold fallback.
- Reduced motion shows text immediately and disables reveal and frame animations.
- Preserve visible keyboard focus, a skip link, accessible labels, and stable click targets.
- Validate at 375, 768, 1024, and 1440 CSS pixels, plus landscape and both languages.

## Navigation and branding update

- Homepage canvas is white; dark hero and service surfaces retain scroll expansion and word reveals.
- Official supplied red/blue Time Track logo replaces the TT monogram across navigation, footer, authentication, and loading screens. Asset: public/images/time-track-logo.png.
- Mobile navigation uses a separate portalled dialog, outside the header background mask. Its panel is limited to the dynamic viewport height and scrolls internally in landscape.
- Opening the menu locks page scrolling; Escape and backdrop clicks dismiss it; Tab stays inside the panel; closing restores the trigger focus. Resizing to desktop closes the menu.
