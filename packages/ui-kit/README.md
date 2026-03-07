# @tandem/ui-kit

Embeddable React UI package for Tandem chat surfaces.

## Exports

- `ChatWidget`
- `resolveWidgetRuntimeConfig`
- Types: `ChatWidgetProps`, `ThemeTokens`, `MessageDescriptor`, `MessageCTA`, `WidgetRuntimeConfig`, `WidgetRuntimeConfigInput`

## `ChatWidget` props

| Prop | Type | Description |
| --- | --- | --- |
| `theme` | `Partial<ThemeTokens>` | Optional theme token overrides. |
| `initialMessages` | `MessageDescriptor[]` | Optional seeded transcript. |
| `config` | `WidgetContentConfig` | Widget content and business-level display config. |
| `initiallyOpen` | `boolean` | Opens panel by default when true. |
| `showLauncher` | `boolean` | Shows launcher button when true. |
| `businessId` | `string` | Business scope for chat and history endpoints. |
| `locationSlug` | `string` | Optional location scope for chat and conversation history. |
| `apiBaseUrl` | `string` | Base URL for API route calls. |

## Runtime behavior

- Hydrates transcript via `GET /api/chat`.
- Sends and streams assistant replies via `POST /api/chat`.
- Resolves runtime configuration through `resolveWidgetRuntimeConfig`.

## Integration note

- This package assumes host APIs are compatible with dashboard chat routes.
- For full app setup and environment requirements, use root docs: `README.md` and `RUNBOOK.md`.

## Contributor Guidance

For repository-level architecture and agent workflow guidance, use:
- `AGENTS.md`
- `docs/architecture.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/REPO_INDEX.md`
