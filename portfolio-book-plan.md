# The Logbook: Interactive 3D-Book Portfolio, Build Plan

**Owner:** Yassin Benattig, Full Stack Developer (C#/.NET, React, Flutter, ERP and e-invoicing)
**Goal:** A portfolio that opens like a real book on a desk, deployed on Vercel and linked from the résumé, built so a recruiter understands who you are in under 60 seconds.
**Status:** PLAN v2. Updated with your decisions below. Still plan only: nothing gets built until the open questions in section 11 are answered.

### Decisions you've made so far
| Topic | Your decision | Effect on the plan |
|---|---|---|
| Content | All page content lives in a **JSON config** you can edit any time (add, remove, reorder projects) | New section 4.2; the book and the plain version are generated from it |
| Framework | **React** | Vite + React + TypeScript replaces Next.js (section 7) |
| Look and feel | **Unique** theme, logo and colours. The video is inspiration only | New section 3 (three directions plus logo ideas) and section 6 |

---

## 0. How to read this document

Every statement is tagged so you always know how sure I am:

| Tag | Meaning |
|---|---|
| **[OBSERVED]** | I saw it directly in your video (frame-by-frame review). |
| **[PROPOSED]** | My recommendation. Reasoned, but it is a choice, not a fact. |
| **[CONFIRM]** | I will not decide this without you. |
| **[IDEA]** | Optional creative extra. Cut freely. |

Ground rule you set: *don't do anything unless 100% sure, otherwise ask.* So anything not tagged **[OBSERVED]** is open to your veto.

---

## 1. What the video actually shows

**Source:** an Instagram Reel by "Sean - UX Designer", caption "Feels like a book, acts like a book, is a book…", showing a portfolio site whose logo reads approximately *"ubɪnatural"*. It is a phone recording of a laptop screen, 37.7 s, which is the same ~17.5 s sequence played twice (the Reel loops). I reviewed frames at 2 fps. I could not hear the audio and I cannot see the site's code.

### 1.1 Scene (closed state, 0.0 s) [OBSERVED]
- Very dark scene: a dark wood desk seen from above at an angle, lit by one soft pool of cool light under the book. Everything else falls into shadow.
- A **black hardcover book**, landscape, with the brand logo embossed in white on the cover. It sits slightly rotated.
- Props: a **coffee cup with latte art** (right edge), a small **round tin/object** (left), a **pen or pencil** (bottom left), a small **folded card or paper corner** (bottom right).
- UI over the scene: logo top-left, a light **"Get in Touch"** pill button top-right, and the headline **"Interactive Portfolio that you can explore"** with a one-line hint underneath ("click on pages to view works, hover to see how they act in motion").

### 1.2 Sequence [OBSERVED]

| Time | What happens |
|---|---|
| 0.0 s | Closed book on desk, headline visible. |
| ~0.3-1.0 s | Click: the **cover swings open** with a 3D curl and shading. The camera pushes in and re-centres on the book. The headline and props slide out of view. |
| 1.0 s | **Spread 1:** left page is a white **"Contents"** page (two columns of entries); right page is the first project (dark, colourful object, big title). |
| 1.5-2.5 s | **Page turn**, then spread 2: a hero page on the left, an eye close-up project on the right. |
| 3.0-3.5 s | Page turn, then spread 3: a product-style page left, a UI-demo page right. |
| 3.5-7.0 s | **Content inside the pages is alive.** The right page's headline changes by itself, the UI mock animates, and the left page's 3D object rotates while its caption swaps. |
| 7.5-9.5 s | Page turn, then spread 4: a bright blue page left, a "new generation of equipment" page right whose cards animate in. |
| ~10.0-11.5 s | **Several fast page turns in a row** (the pages curl visibly in both directions), landing on spread 5 (a landscape-photo page and a sunset-desert page). Whether this is rapid clicking, dragging, or a jump from the Contents page is not clear from the footage. |
| 13.5-15.5 s | Page turn, then a bright white page on the right with a rotating card object. |
| 16.0-16.5 s | Page turn, then the **last spread**: an image page on the left and a plain **white closing page with the logo** on the right. |
| ~17.0-17.5 s | The book **closes and the camera returns** to the desk. The Reel then loops. |

### 1.3 Key takeaways [OBSERVED]
1. **The book is the navigation.** No menu is needed; the Contents page and the page turns are the whole UX.
2. **Pages are not static images.** Content on them animates (text swaps, 3D objects rotate, cards slide in), and the on-screen hint says hover triggers it.
3. **Each page looks like a miniature website**, with tiny nav bars drawn inside the pages. The original author's projects are web design.
4. **Page turns are physically bent** (a curl, not a flat rotation), with shading on the curling page. This is the main wow factor.
5. **The camera moves with state** (desk view, then book view, then back).
6. **The book ends with a clean white closing page** (the call to action).

### 1.4 What I could NOT verify (so I will not pretend to) [OBSERVED limits]
- The **technology** the original uses (WebGL, CSS 3D, video, something else). From the footage alone I cannot tell.
- Exactly how **hover** behaves on each page (the recording shows the result, not the pointer).
- **Click mechanics** for page turns (click on page, edge, drag, or buttons?).
- Whether there is **sound**, and whether there is a **mobile** version.
- Whether the **close-book** at the end is a real feature or just the Reel's loop cut.

I will design these myself in section 6, tagged **[PROPOSED]**.

---

## 2. Copyright and originality rule [PROPOSED]

The video is **inspiration for the interaction idea** (an interactive book as navigation). Your build must not reuse the original's logo, name, copy, page designs, imagery or desk artwork. Everything visual and every word will be original, built from your own work. This also protects you: recruiters can look up where a "clone" came from.

---

## 3. Creative concept and identity [PROPOSED, **[CONFIRM]** the direction]

You asked for something unique, with the video as inspiration only. So I keep exactly one idea from it (a physical book on a desk *is* the navigation) and change everything else: the world, the colours, the book, the logo, the props.

### 3.1 Concept: "The Logbook", a bound ledger of systems you built
- The book is a **hardcover accounting ledger / engineering logbook**. It fits your domains (finance, audit, HR, logistics) and makes the metaphor *mean* something.
- **Each project is a dated entry**: a ruled-paper story page on the left, a live demo on the right.
- A recruiter should think within seconds: "this person builds serious business software, and has taste."

### 3.2 Three visual directions (pick one, or tell me to mix)

| | **A. Daylight in Tunis** (my pick) | **B. Zellige workshop** | **C. Blueprint table** |
|---|---|---|---|
| Scene | A bright, sunlit desk against a limewashed wall. A carved lattice window throws a **slowly drifting pattern of light and shadow** across the desk and the book. | A desk covered in a glazed geometric tile mosaic, seen from above. | A drafting table with a cyanotype-blue sheet, white system diagrams drawn around the book. |
| Book | Deep **door-blue linen ledger** with brass corner caps and an embossed arch seal. | Emerald leather ledger with a saffron ribbon. | White-bound folio with graphite lettering. |
| Palette | Door blue `#1D4F9F`, Limewash `#E9EDEA`, Brass `#BC9440`, Ink `#15202D`, Oak desk `#B89F7E`, Seal red `#B3261E` (stamp only) | Emerald `#0F6B54`, Saffron `#E0A526`, Tile ivory `#F0EFE8`, Deep ink `#18202B`, Tile blue `#2C6E9B`, Seal red `#B3261E` | Cyanotype `#0E3A78`, Chalk `#F2F5F7`, Graphite `#3A4048`, Annotation orange `#F26B21`, Paper grey `#DDE3E8` |
| Memorable thing | The moving lattice shadow | The tile pattern | The linework diagrams |
| Why it is unique | Bright, not dark like most 3D portfolios, and rooted in where you are | Strong local identity | Directly about engineering |
| Main risk | Daylight and soft shadows are harder to make look good; a bright scene exposes weak art | The busy pattern can fight the book and the text | "Blueprint" is a familiar developer cliché |

**[PROPOSED] A**, because it is the furthest from the video (bright and warm instead of dark and cold), and the lattice shadow can be done cheaply with a light that carries a pattern mask. The plan below uses A's palette as the default until you choose.

### 3.3 Logo ideas [PROPOSED, **[CONFIRM]**]
1. **Arch seal (recommended):** the pointed-arch silhouette of a Tunisian door, with a lowercase "yb" inside, set in the display serif. One asset, used four ways: **embossed on the cover, the stamp in the KGSIGN demo, the favicon, and the closing page.**
2. **Folded-corner Y:** a Y formed by a turned page corner.
3. **Wordmark only:** "Yassin Benattig" with a ledger rule underneath.

I will draw the chosen logo as SVG in Phase 2 and show it to you before it is used anywhere. I will also check it against well-known marks so it is not accidentally similar to one.

### 3.4 Desk props that carry meaning [IDEA]
| Prop | What it does |
|---|---|
| **Mint tea with pine nuts in a small glass** | Gentle steam that drifts toward the cursor. |
| **Rubber stamp and ink pad** (arch seal on the stamp) | Hero of the KGSIGN page: an invoice gets signed and stamped on hover. |
| **Folded invoice or business card** | Click to open contact options (email, LinkedIn, GitHub, CV). |
| **Brass paperweight and pen** | Atmosphere only. |
| **Lattice light, drifting very slowly** (direction A) | The idle motion of the scene. |

> Spend boldness in **one** place: the page turn together with the stamp moment. Everything else stays quiet.

---

## 4. Site map and book content

Content below uses **only facts you've already told me**. Everything marked [CONFIRM] needs your input.

| # | Spread (left page / right page) | Content | Hover motion [PROPOSED] |
|---|---|---|---|
| Cover | Closed book | "Yassin Benattig", a short role line | The light pattern drifts across the cover; the cover tilts very slightly. |
| 1 | **Contents** / **About** | Contents: clickable entries that jump to a spread. About: Full Stack Developer, 3+ years, ERP integrations, e-invoicing compliance, secure APIs; based in Tunisia. | Contents entries underline and the target page peeks. |
| 2 | **KGSIGN** (story) / **KGSIGN** (live demo) | Solo-built, ANCE-certified e-invoice signing platform, used by 8 companies, 1,000+ invoices per month. | An invoice slides in, gets signed, and a stamp lands. |
| 3 | **CRM** (story) / **CRM** (demo) | Solo C#/.NET backend of a CRM for 200+ users across 3 subsidiaries. | A simple dashboard fills and updates with live-feeling data. |
| 4 | **Sage X3 integrations** (story) / (demo) | ERP integrations. [CONFIRM what you can say about them.] | Animated data flow between "systems" nodes. |
| 5 | **Stack and craft** / **Path** | Stack: C#/.NET, React, Flutter/Dart, Node.js, SQL Server, Entity Framework. Path: ESPRIT engineering degree (2022), Kilani Groupe since Dec 2022. Languages: Arabic, French, English. | Tech items "tab" in one at a time. |
| 6 | **Closing**: image / white **Contact** page | Email, LinkedIn, GitHub, CV download, "Get in touch". | Button hover only; keep it calm. |

[CONFIRM] Is there a **Flutter/Dart** project, a **side project**, or an **HR / Logistics / Audit** deliverable you want as its own spread? Flutter is in your stack but I have no project to show for it.

### 4.1 Confidentiality warning [CONFIRM]
KGSIGN, the CRM and the Sage X3 work were built at **Kilani Groupe**. Before anything goes public:
- Is it OK to name the company and the real figures (8 companies, 1,000+ invoices/month, 200+ users)?
- All demos must use **redrawn, anonymised mock data**, never real invoices, names, tax IDs, or screenshots of internal systems.

### 4.2 Content as data: your JSON "database" [your decision, details **[PROPOSED]**]

**One file drives everything:** `src/content/portfolio.json`. The 3D book and the plain version are both generated from it, so they can never disagree.

**Day-to-day workflow**
1. Edit the JSON (and drop any images or videos into `public/media/<project-id>/`).
2. Commit and push. Vercel redeploys automatically, usually within a couple of minutes.
3. To **add** a project: copy a project block and change the fields. To **remove** one: delete the block, or set `"visible": false` to hide it without losing it. To **reorder**: move the block, because array order is book order.

**What the system does for you automatically**
- Every visible project becomes one **spread** (story page + demo page).
- The **Contents** page is built from project titles, and its entries jump to the right spread.
- The page count is kept even (a blank ruled page is added if needed), and the closing contact page is always last.
- **Validation:** a schema (Zod) checks the file. A typo, a missing field or a broken media path makes the *build fail with a readable message* instead of breaking the live site.

**An honest limit:** text, images, videos, links and stats are 100% JSON. A **custom animated demo** (the stamp, the dashboard, the data flow) needs a small React component written once; the JSON then refers to it by id (`"id": "stamp-invoice"`). A new project without a custom component uses an image or a short looping video, so adding a project never requires code.

**Shape of the file (sketch, names can change):**
```json
{
  "site": { "name": "Yassin Benattig", "role": "Full Stack Developer", "theme": "daylight", "language": "en" },
  "contact": { "email": "", "linkedin": "", "github": "", "cv": "/media/cv.pdf" },
  "about": { "headline": "", "summary": "", "languages": ["Arabic", "French", "English"] },
  "projects": [
    {
      "id": "kgsign",
      "visible": true,
      "title": "KGSIGN",
      "period": "to fill in",
      "role": "Solo developer",
      "summary": "One or two plain sentences.",
      "highlights": ["Used by 8 companies", "1,000+ invoices per month"],
      "stack": ["C#", ".NET", "SQL Server"],
      "links": { "live": null, "repo": null },
      "left":  { "layout": "story" },
      "right": { "layout": "demo",
                 "demo": { "type": "component", "id": "stamp-invoice", "poster": "/media/kgsign/poster.webp" } }
    }
  ]
}
```
The figures above come from what you told me; I will not publish any number you haven't confirmed (see 4.1).

**Optional later [CONFIRM]:** if you want to edit *without* redeploying, the JSON can be served from a separate store (for example Vercel Blob or Edge Config) and a small private admin form can edit it. That is a bigger step, so v1 uses the file in the repo.

---

## 5. Experience design

### 5.1 State machine [PROPOSED]

```
 CLOSED --click book / CTA--> OPENING --> OPEN(spread n)
 OPEN(n) --next/prev/jump--> TURNING --> OPEN(m)
 OPEN(any) --close button / Esc--> CLOSING --> CLOSED
```

Each state has its own **camera pose** (desk view versus book view). Camera moves use eased tweens of about 0.9 s [PROPOSED, tune by eye].

### 5.2 Signature moment: the stamp [IDEA]
On the KGSIGN right page, hover triggers a 3-beat sequence: (1) an invoice slides in, (2) a signature line draws itself, (3) a stamp lands with a short screen-shake and a soft thud (if sound is on). It communicates what KGSIGN does without a word of explanation.

### 5.3 Controls [PROPOSED]
- **Click** the right or left page edge to turn.
- **Drag** a page corner to turn (stretch goal).
- **Contents** entries jump directly to a spread (multi-page fast flip, similar to what the video seems to do at ~10 s).
- **Keyboard:** left/right arrows turn, Esc closes, Tab reaches every control.
- **Top bar:** logo, **"Plain version"** link, **"Get in touch"** pill.

### 5.4 Recruiter-first extras [PROPOSED]
- **"Plain version" link** to a normal, fast HTML page with the same content and a CV download. Recruiters on a phone or an ATS-style review will thank you, and it is also the SEO and accessibility fallback.
- **CV download** visible in the first screen.
- A reduced-motion mode: no page curl; pages cross-fade.

### 5.5 Mobile [CONFIRM]
Landscape spreads don't fit a portrait phone. [PROPOSED] On narrow screens: show **one page at a time**, full width, swipe to turn, keep the cover and the closing page. Desktop is the showpiece; mobile is the reliable version.

---

## 6. Visual design system

The video does not dictate the look any more (see section 3). Tokens below follow **direction A** and change if you pick B or C.

### 6.1 Palette [PROPOSED, **[CONFIRM]**]
See the table in 3.2. Rules: door blue is the only accent for links and buttons; seal red appears **only** on the stamp; paper pages use Limewash with faint ledger rules.

### 6.2 Type [PROPOSED, **[CONFIRM]**]
- **Display:** *Fraunces* (variable serif with optical sizing) for the cover, headings and page titles.
- **UI and body:** *Geist* (clean sans).
- **Monospace:** *Geist Mono*, used **only** for real code snippets.
- Sentence case. Plain, specific copy, no buzzwords and no filler.

### 6.3 Layout and principles
- The open spread is centred. The left page is left-aligned text; the right page is the demo. Lines stay under 80 characters.
- No grids of identical cards, no tracked-out all-caps labels, no gradient washes. The paper, the arch seal, the stamp and the moving light are the identity.
- Hover motion shows what the work does. Idle motion is limited to the drifting light and the tea steam.

### 6.4 Copy tone
Specific over clever, active verbs. Example: *"Signs and submits e-invoices to Tunisian compliance standards. Built solo, used by 8 companies."* [CONFIRM the compliance wording before publishing.]

---

## 7. Technical architecture

### 7.1 Framework and rendering [React is your decision; the rest is **[CONFIRM]**]

You chose **React**. That settles the framework. What is still open is *how the book is drawn*:

| | **A. React Three Fiber (WebGL)** | **B. CSS 3D + HTML pages** |
|---|---|---|
| Page curl | True bending curl | Rigid flip, unless faked |
| Hover demos | Video or canvas textures on pages | Real HTML/CSS/Lottie, crisp and simple |
| Text sharpness | Depends on texture resolution | Perfect |
| Lighting and shadows | Real lights (needed for the lattice shadow in direction A) | Fake gradients |
| Risk and effort | Higher | Lower |

**[PROPOSED] A.** Both are React, and the curl plus real lighting is the whole point of the concept. I would still prove it in a short Phase 1 spike; if it looks wrong we switch to B without wasting work.

### 7.2 Proposed stack [CONFIRM]
- **Vite + React + TypeScript.** A single-page app; no server rendering is needed because the JSON is static. (This replaces my earlier Next.js suggestion now that you chose React.)
- **three + @react-three/fiber + @react-three/drei** for the scene.
- **GSAP** (or Framer Motion) for camera and UI tweens.
- **Zustand** for the small state machine (book state, current spread).
- **Zod** to validate the JSON; **Tailwind** for the 2D chrome only.
- **Plain version and SEO:** a **build script reads the JSON and writes a static `/plain` HTML page**, so it is fast, indexable, and always in sync. Meta tags and the social-share image are set in `index.html`.
- **Vercel** for hosting, with automatic deploys from your Git repository.

### 7.3 How the page curl works [PROPOSED]
- Each page is a plane **subdivided into many vertical strips** and driven by a chain of bones (a skinned mesh) that bends progressively around the spine as the turn progresses. This is a well-known approach for R3F books.
- Pages have a front and back texture and tiny z-offsets to avoid flicker.
- Shading on the bent page comes from real lighting, which gives the soft darkening seen in the video.
- Validate in **Phase 1** with plain grey pages before any art is made.

### 7.4 Making pages "alive" [PROPOSED]
- Each demo page = a **short looping video or canvas animation** used as a texture. Hovering the page (raycast hit) plays or advances it; leaving pauses it.
- Contents links and the contact buttons are **hotspots in page UV space**, not real DOM buttons.
- Keep media light: each clip ≤ ~2 MB, with a still poster frame shown until hover.
- I do **not** plan to render live HTML inside the 3D texture; it is fragile and I'm not certain it holds up across browsers.

### 7.5 Desk scene [CONFIRM]
- **Option 1 (code only):** build the desk from simple 3D shapes plus baked-looking lights, with free CC0 models for props. No external artist needed; slightly stylised look.
- **Option 2 (art plate):** a rendered or generated desk image as the background, with the real 3D book matched to it. More photoreal but needs good source art, and a mismatch in lighting is the main risk.
- **[PROPOSED]** Option 1, because it is fully in your control and has no licensing surprises. Check each prop's license before use.

### 7.6 Suggested repo structure
```
/src
  content/   portfolio.json   schema.ts   loadContent.ts     # the JSON "database"
  scene/     Desk.tsx  Book.tsx  Page.tsx  Props.tsx  Lights.tsx  CameraRig.tsx
  demos/     StampInvoice.tsx  ...                           # registered by id, referenced from JSON
  ui/        TopBar.tsx  Hint.tsx  PlainLink.tsx
  state/     bookState.ts  hotspots.ts
/scripts     build-plain.ts  validate-content.ts             # plain page + JSON check
/public      /media/<project-id>/  /textures  /models  cv.pdf
index.html   vercel.json
```
Because everything reads `portfolio.json`, the book, the Contents page and the plain version never drift apart.

### 7.7 Performance budget [PROPOSED]
- Shell loads fast: the 3D bundle is **lazy-loaded** after first paint; a still image of the closed desk shows immediately.
- Target: interactive within ~3 s on a mid-range laptop; 60 fps on desktop; textures capped at 2048 px; only the current and neighbouring spreads' video preloaded.
- Auto-lower quality (pixel ratio, shadows) if the frame rate drops.
- Fallback to the plain version if WebGL is unavailable.

### 7.8 Accessibility [PROPOSED]
Keyboard navigation, visible focus, `prefers-reduced-motion` honoured, text alternatives for every page's content (via the plain version), sufficient colour contrast on UI chrome, sound off by default.

---

## 8. Phases and acceptance criteria

| Phase | Scope | Done when |
|---|---|---|
| **0. Decisions** | Answer section 11. Gather assets. | All [CONFIRM] items resolved. |
| **1. Spike** | Grey book, one spread, working curl in both directions. | Curl looks believable; 60 fps; a keep-or-fall-back decision on React Three Fiber (7.1, option A) is made. |
| **2. Scene** | Desk, props, light, logo (SVG), camera moves (closed to open to closed). | The closed-to-open moment feels good with placeholder pages. |
| **3. Content system and content** | JSON schema, validation, the generator (JSON to spreads and Contents), the plain-page build script, then the real content. | Adding, hiding, removing and reordering a project by editing only the JSON works; a broken JSON fails the build with a clear message. |
| **4. Motion** | Hover demos (stamp, dashboard, data flow), posters, preload logic. | Every demo plays on hover and is under budget. |
| **5. Polish** | Mobile mode, reduced motion, a11y pass, sound toggle (optional), perf tuning. | Lighthouse and manual keyboard and phone checks pass. |
| **6. Ship** | Vercel deploy, domain, OG image, analytics, résumé update. | Live URL works on desktop and phone; link added to the résumé. |

Rough effort (relative): spike **S**, scene **M**, content **M**, motion **L**, polish **M**, ship **S**. Phase 4 is the biggest because every demo is custom.

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Curl looks fake or glitchy | Phase 1 spike; fall back to CSS 3D (7.1, option B). |
| Heavy load on weak devices | Lazy loading, quality scaler, plain version link. |
| Recruiters don't want to "play" with it | Plain version, visible CV button, TL;DR in the first screen. |
| Employer confidentiality | Anonymised mock data; get your OK on naming Kilani Groupe and the numbers. |
| Looks like a clone | Original concept, palette, copy and art (sections 2 and 3). |
| Too much scope | Ship with 3 strong spreads first, add more after launch. |

---

## 10. Things I need from you (assets checklist)

- [ ] Email, LinkedIn, GitHub, and any live link for each project
- [ ] Current CV as PDF
- [ ] Short bio sentence you actually like (or I draft, you edit)
- [ ] Which projects to feature, and what you are allowed to show
- [ ] Any screenshots or diagrams you can share (I'd still redraw them anonymised)
- [ ] A domain name, if you have one in mind
- [ ] Photo of yourself, **optional**

---

## 11. Open questions (my default if you don't answer)

Already decided by you: JSON-driven content, React, a unique identity. Still open, ordered by impact:

1. **Visual direction:** A (Daylight in Tunis), B (Zellige workshop), C (Blueprint table), or a mix? And the **logo idea** (arch seal is my pick). *(Default: A with the arch seal.)*
2. **Which projects may be shown publicly**, and may I name Kilani Groupe and use the real figures? *(Default: KGSIGN, CRM and Sage X3 with anonymised demos, no company name.)*
3. **Editing workflow:** is "edit the JSON, push, auto-redeploy in a couple of minutes" enough, or do you need to edit without redeploying? *(Default: the Git workflow in 4.2.)*
4. **Rendering:** React Three Fiber with the curl (with a Phase 1 spike to prove it), or simpler CSS 3D? *(Default: R3F.)*
5. **Language:** English only, or English + French toggle? *(Default: English only for v1; the JSON can later hold both languages.)*
6. **Desk art:** a scene built in code (my default) or a rendered or generated image plate?
7. **Mobile:** a simplified phone version, one page at a time? *(Default: yes.)*
8. **Any Flutter, HR, Logistics or Audit work** you want as its own spread? *(Default: none.)*
9. **Sound:** opt-in page-turn and stamp sounds? *(Default: skip for v1.)*
10. **Fonts:** happy with Fraunces + Geist? *(Default: yes.)*

---

## 12. Definition of done

- A live Vercel URL where the book opens, turns, closes, and plays hover demos smoothly on desktop.
- A phone-friendly version and a plain, accessible, SEO-friendly version from the same content.
- Original visuals and copy; no confidential data; every claim on the pages is true and checkable.
- You can add, hide, remove and reorder projects by editing only `portfolio.json`.
- The URL is on your résumé, and the site makes your best three projects obvious within 60 seconds.
