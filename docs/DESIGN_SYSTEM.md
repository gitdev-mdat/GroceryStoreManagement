# Hải Kiều Design System

This document defines the single visual language for the entire Hải Kiều application. Every future screen and component must follow this Design System to ensure a consistent, professional, and accessible user experience.

## 1. Design Principles

- **Simple**: Interfaces should be intuitive and straightforward.
- **Calm**: Use clean spacing, soft colors, and avoid aggressive visual noise.
- **Fast**: Layouts should load quickly and feel responsive.
- **Built for household-business owners**: Terminology and workflows should match real-world business practices, avoiding overly technical jargon.
- **Large touch targets**: Everything must be easy to tap on mobile devices.
- **Low cognitive load**: Users should instantly understand the primary action on a screen.
- **No unnecessary decoration**: Only use borders, shadows, and colors when they serve a functional purpose.

## 2. Color System

Use existing project colors (Tailwind palette) whenever possible. Do not redesign branding.

- **Primary**: `brand-600` (Blue). Used for primary buttons, active states, and key icons.
- **Success**: `emerald-600`. Used for revenue numbers, positive trends, and success toasts.
- **Warning**: `amber-500`. Used for warnings and pending states.
- **Danger**: `rose-600` / `red-500`. Used for destructive actions (Delete) and error validation messages.
- **Neutral**: `slate`. Forms the backbone of the UI.
- **Border**: `slate-200` (default) / `slate-300` (hover).
- **Surface**: `white` for cards and modals / `slate-50` for secondary surfaces and input backgrounds.
- **Background**: `slate-50` / `gray-50` for the main app background.
- **Text hierarchy**:
  - `slate-900`: Headings and primary text.
  - `slate-700` / `slate-800`: Secondary headings, strong body text.
  - `slate-600`: Standard body text and descriptions.
  - `slate-500`: Captions, placeholders, and metadata.
  - `slate-400`: Disabled text, subtle borders.

## 3. Typography

Specify font sizes using Tailwind's default scale.

- **Page Title**: `text-2xl` or `text-3xl`, `font-bold`, `text-slate-900`, tight tracking.
- **Section Title**: `text-xl`, `font-bold`, `text-slate-900`.
- **Card Title**: `text-base` (mobile) to `text-lg` (desktop), `font-semibold`.
- **Body**: `text-sm`, `font-normal`, `text-slate-600`, relaxed line height.
- **Caption**: `text-[11px]` to `text-xs`, `font-medium` or `font-semibold`, uppercase tracking for stat labels.
- **Statistic Number**: `text-3xl`, `font-bold`, `tracking-tight`, `leading-none`.
- **Button Text**: `text-sm`, `font-semibold`.

## 4. Spacing System

Use a strict 8pt spacing scale (with occasional 4pt half-steps for tight grouping).

- **4px (`gap-1`, `p-1`)**: Micro-adjustments, spacing between an icon and text.
- **8px (`gap-2`, `p-2`)**: Standard small gap between related elements (e.g., input and validation message).
- **12px (`gap-3`, `p-3`)**: Inner padding for standard inputs.
- **16px (`gap-4`, `p-4`)**: Standard card padding and grid gaps.
- **24px (`gap-6`, `p-6`)**: Modal padding and section spacing.
- **32px (`gap-8`, `p-8`)**: Page margins and major structural separation.

## 5. Border Radius

Consistency in border radius is critical for the "calm" aesthetic.

- **Cards**: `rounded-2xl` (16px). Applies to all primary surface containers.
- **Buttons**: `rounded-xl` (12px).
- **Inputs**: `rounded-xl` (12px).
- **Dialogs**: `rounded-2xl` (16px) to match cards.
- **Icon Containers**: `rounded-xl` (12px) inside cards. Small badges can use `rounded-lg` (8px).

## 6. Shadows

Avoid multiple shadow styles. Keep them soft and dispersed.

- **Small (`shadow-sm`)**: Used for flat cards and static top bars to separate from background.
- **Medium (`shadow-md`)**: Used for hover states on clickable cards.
- **Large (`shadow-[0_24px_64px_-12px_rgba(15,23,42,0.25)]`)**: Used exclusively for Modals/Dialogs to create depth and focus.

## 7. Icon System

- **Standard icon size**: 20px or 22px.
- **Container size**: 44px to 48px (`h-11 w-11` or `h-12 w-12`).
- **Container radius**: `rounded-xl`.
- **Stroke width**: `1.75` to `2.5`. Use slightly thicker strokes for smaller chevrons (`2.5`).
- **Primary icon color**: `brand-600` on a `brand-50` background.
- **Disabled/Secondary icon color**: `slate-400` on `slate-100` background.
- **Danger icon color**: `rose-500` on a `red-50` background.

## 8. Cards

### Navigation Card
- **Layout**: Horizontal (`flex-row`), full width.
- **Padding**: `p-4` (16px).
- **Typography**: Card Title + Description (1-2 lines max).
- **Icon placement**: Left side, 48x48px container.
- **Interaction**: Entire card is a tap target. Chevron on the right indicates navigation. Hover state raises shadow and tints border.

### Statistic Card
- **Layout**: Flex container, vertical stack for individual metrics.
- **Typography**: Large Statistic Number + Uppercase Caption label.
- **Padding**: `px-5 py-5`.

### List Card
- **Layout**: Space-between top row (Date | Amount + Actions), followed by divider, then Description text.
- **Padding**: `p-4`.

### Empty State Card
- **Layout**: Centered flex column.
- **Visuals**: Dashed border (`border-dashed`), muted icon in center, subtle caption text.

## 9. Forms

- **Labels**: `text-xs`, `font-semibold`, uppercase, tracking-wide, `text-slate-500`.
- **Inputs**: `h-[42px]` or equivalent padding, `rounded-xl`, `border-slate-200`, `bg-white` (or `bg-slate-50` transitioning to `bg-white` on focus). Focus state: `ring-2 ring-brand-100 border-brand-400`.
- **Readonly fields**: Cursor not-allowed, `bg-slate-50`, text slightly muted (`slate-600`).
- **Currency inputs**: Right-aligned "đ" suffix.
- **Primary button**: Gradient (`from-brand-600 to-brand-700`), white text, `shadow-sm`, hover translates Y.
- **Secondary button**: White background, `border-slate-200`, `text-slate-600`, hover `bg-slate-50`.
- **Danger button**: `bg-rose-600`, white text, hover `bg-rose-700`.
- **Validation messages**: `text-xs`, `font-medium`, `text-red-500`, positioned directly under the input.

## 10. Lists

- **Date**: Primary anchor for lists. `text-sm font-bold text-slate-800`.
- **Description**: `text-sm leading-relaxed text-slate-600`, allows line breaks.
- **Amount**: `text-sm font-bold text-emerald-600`, with `đ` suffix.
- **Actions**: Icon buttons (`h-8 w-8 rounded-lg`). Placed inline with the amount.
- **Pagination**: Simple Previous/Next buttons with current page indicator. `h-12` for large tap targets.
- **Empty state**: Clear icon and message explaining why no data exists.

## 11. Dialogs

- **Backdrop**: `bg-slate-900/40 backdrop-blur-sm`.
- **Confirmation dialog**: Standard form modal. Header with close button, body with inputs, footer with Cancel/Save actions.
- **Delete dialog**: Warning icon header. Red primary action button. Explicit warning text.
- **Success/Error messages**: Handled via Toast notifications centered at the top of the screen.

## 12. Responsive Rules

- **Mobile first**: Design assuming a ~360px width viewport.
- **Below md (< 768px)**:
  - Prefer one-column layouts for navigation cards and lists.
  - All cards should be full width (`w-full`).
- **Desktop (>= 768px)**:
  - May use multiple columns (e.g., 2 or 3 columns) when readability is preserved.
  - Prevent orphaned cards by balancing grid layouts (e.g., if there are 3 main actions, use a 3-column grid).

## 13. Accessibility

- **Touch target**: Minimum 44px height for primary buttons and interactive cards (`min-h-[44px]` or `min-h-[88px]` for large cards).
- **Contrast**: Ensure text colors meet readability standards (e.g., `slate-500` minimum for standard size, `slate-400` only for very large or non-critical decorative text).
- **Focus**: Maintain visible focus rings (`focus:ring-2 focus:ring-brand-100`) on all inputs and buttons.
- **Keyboard**: Ensure all interactive elements (Cards, Buttons, Inputs) are accessible via Tab.

## 14. Component Consistency Checklist

Before merging any screen, verify the following:

- [ ] **Typography matches**: Headings, body text, and captions use correct Tailwind sizes/weights.
- [ ] **Radius matches**: Cards (`2xl`), buttons (`xl`), inputs (`xl`).
- [ ] **Shadow matches**: Only use standard `shadow-sm`, `shadow-md`, or the specific large modal shadow. No custom blurry box-shadows.
- [ ] **Icon style matches**: Consistent stroke width and container backgrounds.
- [ ] **Card layout matches**: Mobile uses single-column horizontal layouts; avoid horizontal scrolling or squeezed text.
- [ ] **Button hierarchy matches**: Only one Primary button per context. Use Secondary for cancel/back actions.
- [ ] **Spacing matches**: Uses the 8pt system (4, 8, 12, 16, 24, 32). No arbitrary padding values.
