# Shutabug frontend recreation

A Next.js / React Three Fiber recreation based on the reference's publicly served HTML, scene bundles, styles, and assets.

## Run

From `web`, install dependencies with `npx pnpm@11.28.13 install`, then run `npm run dev`. Open the printed localhost URL.

Validate with `npm run typecheck` and `npm run build -- --webpack`.

## Implemented

- Circular R3F gallery with the reference's wall radii, camera orbit, artwork proportions, fog, light pools, entrance motion, wheel and drag navigation, keyboard movement, click-to-approach and click-again-to-open behavior.
- Shared poster-to-product transitions from HTML lists, saved work, search, related products, and projected WebGL paintings. Reduced-motion preferences skip the animation.
- R3F hanging-print shop rail with looping collections, drag inertia, sway toggle, and list view.
- Artist page with the original GLB portrait and pointer/scroll response.
- Eighteen collections, full publicly supplied catalog entries, product detail routes, product option controls, quantity selection, bag, saved items, search, theme controls and INR-only prices.
- Project galleries, account forms, auction empty state, supporting pages, responsive navigation, and newsletter postcard.
- Locally stored artwork previews, fonts, portrait model, project images, and video. The display font loads through the reference's Adobe stylesheet.

## Source map

- `components/rotunda.tsx`: gallery room and camera controls.
- `components/print-line.tsx`: hanging print rail.
- `components/artist-head.tsx`: model loading and portrait material.
- `components/studio.tsx`: page layouts, bag, search, saved work and forms.
- `lib/collections.json`: reference homepage collection selections.
- `lib/catalog.json`: full supplied product catalog.
- `lib/projects.json`: selected project content.
- `app/globals.css`: styling and responsive rules.

## Backend boundary and fidelity

Bag, saved work and theme preference persist locally in the browser. Forms do not send email or authenticate. Payments, live auction bidding, delivery quotes, tax, inventory and account services require backend integration. Prices are denominated directly in INR, with no exchange-rate selector or conversion. The base print price is ₹5,000 and can be edited in `lib/pricing.ts`; size surcharges remain frontend demonstration amounts.

The gallery geometry and core motion are reconstructed from inspected values. The room uses a dark ceiling and floor with warm wall washes and floor light pools independently of the surrounding UI theme. Shop cloth deformation, portrait carving, all transition shaders, and every secondary-page layout are not guaranteed pixel-identical. Policy pages describe this demo rather than making the reference store's legal promises. Reference artwork and branding should be replaced or cleared for your intended use before launch.

## See it on your wall

Every print's **View In Room** link opens a centered QR modal on desktop, leaving the product page in place. On phones and tablets it opens the `/ar` page directly. The QR code includes the selected artwork, frame, and size. The preview supports interactive orbit/zoom, size and frame changes, a QR handoff, and a back link that restores product options. Legacy size labels in the reference URL are supported.

`components/wall-preview.tsx` uses Google's model-viewer with wall placement and fixed physical scale. `lib/ar-options.ts` defines A3–A0 paper dimensions. `lib/ar-piece.ts` builds the print and frame geometry in metres. The read-only `/api/ar-model` route embeds the local artwork in a GLB served at a fetchable URL for native mobile viewers. This does not require accounts, a database, or a commerce backend.

Supported devices can use WebXR, Android Scene Viewer, or iOS Quick Look. Phone AR needs a reachable HTTPS deployment; another device cannot use this computer's localhost URL. Unsupported devices retain the 3D preview and phone handoff. Browser rendering, exported dimensions, option changes, and navigation have been checked; physical wall placement still requires an AR-capable device test.

## List views and gallery entrance

Index, shop, and collection list views share `components/artwork-list.tsx`. Large, proportionally sized thumbnails, metadata, prices, section headings and row rules follow the inspected reference layout. `components/list-motion.tsx` overlays accessible DOM links with orthographic WebGL images and text: staggered noisy reveals, zoom settling, scroll-speed image bowing, RGB separation, image parallax and text leaning. Reduced motion and unavailable WebGL keep a readable HTML list. Shared poster transitions continue to work from those rows.

The room camera now starts on the 9.7-metre walkway orbit and remains clamped to that orbit while walking. The old flythrough from inside the inner wall has been removed. A framed S monogram and SHUTABUG wordmark replace the reference header mascot. Visible collection and artwork display titles have English replacements; original titles remain in data as metadata, and original routes/asset names stay intact.

## Timing, list startup, and reverse poster transitions

The pinned R3F 9.8.2 dependency has a tracked pnpm patch at `patches/@react-three__fiber@9.8.2.patch`. It preserves R3F v9’s clock-shaped store API using `THREE.Timer`, so mounting a canvas no longer constructs the deprecated Clock. Use pnpm to reinstall dependencies so the patch is applied. No console warning filters are used.

Lists start in a hidden pending-renderer state. The WebGL layer exclusively controls animated reveals; HTML becomes visible only in DOM/reduced-motion/context-loss fallback. This avoids showing the complete HTML picture before replaying its shader reveal.

Poster transitions now run in both directions. Product links to Prints, Shop, or Index, plus browser Back, resolve matching list or projected WebGL destinations. Lists restore/centre the selected row, rails select the returned print, and the index room positions the returned painting in view. Existing image proportions are preserved.

## Vercel

The project pins pnpm 11.28.13 in `package.json`. Keep `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `patches/` committed together. The lockfile uses pnpm 11’s patch format; pnpm 10 cannot install it with a frozen lockfile.

Use the project directory as the Vercel Root Directory. Leave Install Command on automatic detection so Vercel uses the package manager pin. If an explicit install override is needed, use `npx --yes pnpm@11.28.13 install --frozen-lockfile`.
