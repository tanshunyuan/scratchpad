export const DEMO_PROJECT_ID = "demo-project";

export const DEMO_DESIGN_SYSTEM_TEXT = `# Web Steps — Mini Design System

## 1) Design principles
- **Focused:** one primary action per screen.
- **Calm:** low-noise layouts, restrained color, clear hierarchy.
- **Practical:** every element supports task completion.
- **Trustworthy:** consistent patterns, explicit states, readable content.
- **Fast-feeling:** compact flows, immediate feedback, minimal friction.

---

## 2) Foundations

### Color
**Neutrals**
- \`--bg: #F7F8FA\` page background
- \`--surface: #FFFFFF\` cards, panels
- \`--surface-muted: #F1F3F5\` secondary areas
- \`--border: #D9DEE5\`
- \`--text: #17202A\`
- \`--text-muted: #5B6673\`

**Brand / Action**
- \`--primary: #2F6FED\`
- \`--primary-hover: #2459C7\`
- \`--primary-soft: #EAF1FF\`

**Status**
- \`--success: #1F9D68\`
- \`--warning: #C58A16\`
- \`--danger: #C94A4A\`
- \`--info: #3C7BEA\`

**Usage rules**
- Use primary blue only for key actions and active states.
- Prefer neutral surfaces; avoid large saturated areas.
- Status colors support feedback only, never as decoration.

### Typography
**Style**
- Sans-serif, modern, highly legible.

**Scale**
- **Display / Page title:** 28 / 36, semibold
- **H1 / Section title:** 22 / 30, semibold
- **H2 / Panel title:** 18 / 26, semibold
- **Body:** 14 / 22, regular
- **Body strong:** 14 / 22, medium
- **Meta / Label:** 12 / 18, medium
- **Code / structured term:** 13 / 20, medium

**Rules**
- Left-align all text.
- Limit to 3 weights: regular, medium, semibold.
- Use sentence case for UI labels and headings.

### Spacing
**Base unit: 8px**

**Scale**
- 4, 8, 12, 16, 24, 32, 40, 48

**Layout rules**
- Card padding: 16
- Section spacing: 24
- Page gutter: 24
- Form field gap: 12
- Inline icon gap: 8

### Radius & elevation
- **Radius:** 10 for cards/inputs/buttons, 16 for large panels
- **Border:** 1px \`--border\`
- **Shadow:** subtle only
  \`0 1px 2px rgba(16,24,40,.06), 0 4px 12px rgba(16,24,40,.06)\`

---

## 3) Core components

### Button
**Variants**
- **Primary:** filled \`--primary\`, white text
- **Secondary:** white background, border
- **Tertiary:** text-only, muted text
- **Destructive:** \`--danger\`

**Sizes**
- M: height 40, padding 0 14
- S: height 32, padding 0 10

**Rules**
- One primary button per area.
- Buttons use clear verbs: Create project, Save PRD, Generate artifacts.

### Input
Includes text field, textarea, select.
- Height: 40
- Background: \`--surface\`
- Border: \`--border\`
- Label above field, helper text below when needed
- Textarea min height: 96

**States**
- Default, hover, focus, error, disabled

### Card
Used for Project, PRD, Ubiquitous Language, Design System blocks.
- Surface background
- 16 padding
- Optional header, body, footer
- Use for grouping, not decoration

### Tabs
For switching between project artifacts.
- Active tab indicated by blue text + 2px underline
- Max 5 visible top-level tabs

### Stepper
For guided creation flow.
- Horizontal on desktop, vertical on narrow screens
- States: upcoming, current, complete
- Current step highlighted with primary color
- Completed step uses success accent minimally

### Tag
Used for domain terms and artifact labels.
- Small pill, muted background
- Types: neutral, info, success, warning

### List row
For project and artifact indexes.
- Min height 44
- Optional leading icon
- Hover highlights surface-muted
- Row click opens detail; trailing actions stay secondary

### Feedback message
Inline or banner.
- Info, success, warning, danger
- Include concise action-oriented copy

### Modal
Use only for confirmation or short creation tasks.
- Max width 560
- Primary action right-aligned
- Avoid multi-step flows inside modal

---

## 4) Interaction rules
- **Clarity first:** show next best action prominently.
- **Progressive disclosure:** reveal advanced options only when needed.
- **Immediate feedback:** save, generate, and validation states appear instantly.
- **Visible status:** draft, saved, generating, complete, error.
- **Safe actions:** destructive actions require confirmation.
- **Keyboard support:** visible focus ring on all interactive elements.
- **Empty states:** always direct toward creating a Project, PRD, or Ubiquitous Language entry.
- **Loading:** prefer skeletons for panels, spinners only for short inline waits.

---

## 5) State styles
- **Hover:** darken border or background slightly
- **Focus:** 2px ring \`--primary-soft\` + border \`--primary\`
- **Disabled:** lower contrast, no shadow, no hover
- **Error:** border \`--danger\`, helper text in danger color
- **Selected:** primary-soft background + primary text

---

## 6) Page composition
- Use a **two-level hierarchy**:
  1. Page title + primary action
  2. Main content in cards or step sections
- Keep line lengths moderate for PRD reading/editing.
- Prefer **single-column forms**; use two columns only for short metadata.
- For artifact generation, pair **input context** on left/top with **generated result** on right/below.

---

## 7) Product voice in UI
- **Focused:** concise labels
- **Calm:** avoid exclamation marks
- **Practical:** use direct verbs
- **Trustworthy:** explain system actions clearly
- **Fast:** short progress messages, minimal interruption

Example tone patterns:
- Create project
- Save PRD
- Define domain language
- Generate design system`;
