# Design QA — product-wide Evidence Studio

## Comparison target

- Source visual truth: `/Users/ssg/.codex/generated_images/01a081d9-3ea4-7f22-b088-e2b64aeae299/exec-5ba70b4f-f679-48d9-a968-b88efa70c5a5.png`
- Browser-rendered dashboard: `output/playwright/chart-studio-dashboard.png`
- Side-by-side full-view comparison: `output/playwright/design-comparison.png`
- Mapping surface: `output/playwright/mapping.png`
- Mobile dashboard: `output/playwright/chart-studio-mobile.png`
- Comparison viewport: 1487 × 1058 CSS px at device scale factor 1. The source and implementation are both 1487 × 1058 px, so no density normalization or crop adjustment was needed.
- State: the Sales & revenue review demo at its dashboard step. The source is a static dashboard visual; the implementation adds the configurable Chart studio directly below the KPI band.

## Evidence and interactions

- Full-view and focused-region evidence were compared together in `output/playwright/design-comparison.png`; the dashboard headline, side rail, KPI band, chart surface, and right decision column are readable at that scale.
- The mapping screenshot verifies that a non-dashboard product surface carries the same type hierarchy, cobalt field controls, table rhythm, and full workflow context.
- At 390 × 844, the compact workflow rail remains usable as a horizontal control strip; the dashboard cards and chart controls reflow without document-width overflow.
- Primary interactions checked: opened the demo, navigated rail and stepper views, changed the chart type from bars to a real SVG line chart, and exercised mobile layout. The automated suite also selects a different metric and verifies line and donut renderings.
- Browser console inspection contained only the React DevTools informational message; no application console errors were observed.

## Comparison history

### Pass 1 — dashboard direction

- [P2] The initial mobile workspace had document-width overflow.
  - Fix: constrained the studio containers and made the workflow progression its own horizontal scrolling region.
  - Post-fix evidence: `output/playwright/chart-studio-mobile.png` shows a contained 390 px layout with no persistent control clipped.

### Pass 2 — product-wide extension and Chart studio

No actionable P0, P1, or P2 differences remain for the selected editorial direction. The source is a dashboard art direction rather than a specification for every operational screen; the mapping, quality, workflow, AI, export, history, case-study, and privacy pages deliberately reuse its paper, cobalt, persimmon, serif, and evidence-table vocabulary.

## Fidelity surfaces

- Fonts and typography: editorial serif headings and compact uppercase sans labels preserve the intended contrast. The live dashboard maintains readable metric and field-control sizing, while the mobile capture shows no title truncation.
- Spacing and layout rhythm: the left project rail, paper workspace, utility line, decision heading, step strip, and KPI band preserve the source hierarchy. Dense operational tables use a calmer, consistent rhythm rather than copying dashboard spacing mechanically.
- Colors and visual tokens: warm paper, cobalt interaction states, persimmon financial emphasis, pale-blue panels, and fine neutral rules are consistently applied across the product.
- Image quality and asset fidelity: the implementation uses the raster `public/design/evidence-ribbon.png` for the source-inspired ribbon—not a CSS or inline-SVG imitation. It is sharp at the target size. The source's decorative architecture photo is intentionally omitted rather than replaced with unlicensed stock imagery.
- Copy and content: project names, metrics, validation evidence, workflow results, privacy claims, and selectable column labels come from the active run. The new chart controls act on real normalized demo or uploaded rows.

## Follow-up polish

- [P3] A future custom editorial photo commission could fill the source mock's tall right-side image position, but it is not needed for a complete, credible product surface.

final result: passed
