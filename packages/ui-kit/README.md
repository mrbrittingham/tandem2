# @tandem/ui-kit

A lightweight React component library that exposes the Tandem chat widget for embedding across hosts. Components ship as plain TypeScript modules plus CSS modules so apps can consume them without global style collisions.

## Public API surface

### `ChatWidget(props)`
| Prop | Type | Description |
| --- | --- | --- |
| `theme` | `Partial<ThemeTokens>` | Optional token overrides that map to CSS variables (colors, radii, shadows, etc.). When omitted, Tandem’s default palette is used. |
| `initialMessages` | `MessageDescriptor[]` | Optional seed messages for the assistant. Assistant messages may include a CTA button via the `cta` field. |

### Supporting types
| Type | Notes |
| --- | --- |
| `ThemeTokens` | Canonical token contract that is converted into CSS variables. Exported so hosts can cache or persist their themes. |
| `MessageDescriptor` | Serializable representation of a message (`role`, `text`, optional `cta`). |
| `MessageCTA` | `{ label: string; href: string; }`, rendered inside assistant messages when provided. |

Import path example:

```tsx
import {
  ChatWidget,
  type ThemeTokens,
  type MessageDescriptor,
  type MessageCTA,
} from "@tandem/ui-kit";
```

## Theming strategy
- Tokens flow through the `theme` prop, merge with the Tandem defaults, and become CSS variables.
- Presentation lives inside `ChatWidget.module.css`, ensuring a predictable cascade.
- No hardcoded color references remain inside the React component; everything resolves back to the tokens.

## Versioning note
The package currently tracks `0.1.0`. Expect breaking visual/API adjustments while the widget hardens; once the API stabilizes we will adopt semantic versioning with proper release tags.
