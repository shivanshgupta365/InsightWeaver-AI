# Design QA — Evidence Studio redesign

## Comparison target

- Source visual truth: `/Users/ssg/.codex/generated_images/01a081d9-3ea4-7f22-b088-e2b64aeae299/exec-5ba70b4f-f679-48d9-a968-b88efa70c5a5.png`
- Implementation capture: `.playwright-cli/page-2026-09-10T09-49-02-962Z.png`
- Desktop state: Sales & revenue review, dashboard step selected.
- Source pixels: 1487 × 1058. Implementation pixels / CSS viewport: 1440 × 1024 at device scale factor 1. Both were judged as full desktop application surfaces; no density normalization was required.
- Focused mobile capture: `.playwright-cli/page-2026-09-10T09-49-24-279Z.png`, 390 × 844 CSS pixels.
- Primary interaction tested: open the three-minute sales sample, navigate to the dashboard, and move between workflow steps. Console errors: none.

## Comparison history

### Pass 1

- [P2] Mobile viewport had horizontal document overflow (685 px content width at a 390 px viewport).
  - Fix: constrained the studio shell and workspace, and moved the workflow step strip into its own horizontal scroll surface.
  - Post-fix evidence: `scrollWidth` and `clientWidth` both measure 390 px after reload.

### Pass 2

No actionable P0/P1/P2 differences remain for the selected direction.

## Fidelity surfaces

- Fonts and typography: the implementation uses an editorial serif display scale for project and decision titles, with compact uppercase sans labels for workflow and evidence. It matches the source’s intentional contrast while preserving readable responsive sizes.
- Spacing and layout rhythm: the left project rail, full-width paper workspace, top utility line, dashboard heading, workflow strip, and metric rhythm match the target structure. The implementation deliberately omits the target’s decorative architecture photo to avoid adding unsupported stock imagery.
- Colors and visual tokens: warm paper, cobalt action/analysis states, persimmon financial highlights, pale blue selection states, and neutral rules align to the selected source. Contrast remains strong for dashboard data and interactive controls.
- Image quality and asset fidelity: `public/design/evidence-ribbon.png` is a generated custom ribbon asset used at the workspace header and landing hero. It is crisp at the rendered dimensions and uses the source’s intended motion cue. Standard control icons remain from the existing accessible icon library.
- Copy and content: all source-backed project names, metrics, validation evidence, workflow steps, and privacy claims are real application content; no mock data was added only for decoration.

## Follow-up polish

- [P3] The selected mock includes a tall editorial side image. The implemented right-side decision mantra preserves its hierarchy without introducing a non-product stock image.

final result: passed
