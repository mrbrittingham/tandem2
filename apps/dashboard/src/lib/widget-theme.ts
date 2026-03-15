import type { WidgetThemeSettings } from "@tandem/shared";
import type { ThemeTokens } from "@tandem/ui-kit";

const HEX_3_OR_6 = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function normalizeHexColor(input: string | undefined, fallback: string) {
  const candidate = (input ?? "").trim();
  const match = HEX_3_OR_6.exec(candidate);
  if (!match) {
    return fallback;
  }

  const value = match[1];
  if (value.length === 3) {
    return `#${value
      .split("")
      .map((entry) => `${entry}${entry}`)
      .join("")
      .toUpperCase()}`;
  }

  return `#${value.toUpperCase()}`;
}

function colorToRgb(color: string): [number, number, number] | null {
  const normalized = normalizeHexColor(color, "");
  if (!/^#[0-9A-F]{6}$/.test(normalized)) {
    return null;
  }

  const safe = normalized.slice(1);
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return [r, g, b];
}

function mixWith(color: string, amount: number, mixColor: [number, number, number]) {
  const rgb = colorToRgb(color);
  if (!rgb) {
    return color;
  }

  const [r, g, b] = rgb;
  const safeAmount = Math.max(0, Math.min(1, amount));

  const nextR = Math.round(r * (1 - safeAmount) + mixColor[0] * safeAmount);
  const nextG = Math.round(g * (1 - safeAmount) + mixColor[1] * safeAmount);
  const nextB = Math.round(b * (1 - safeAmount) + mixColor[2] * safeAmount);

  return `#${nextR.toString(16).padStart(2, "0")}${nextG.toString(16).padStart(2, "0")}${nextB.toString(16).padStart(2, "0")}`.toUpperCase();
}

function relativeLuminance(color: string) {
  const rgb = colorToRgb(color);
  if (!rgb) {
    return 0;
  }

  const toLinear = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  const [r, g, b] = rgb;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function getReadableTextColor(backgroundColor: string) {
  return relativeLuminance(backgroundColor) > 0.55 ? "#0F172A" : "#FFFFFF";
}

function darken(hex: string, amount = 0.14) {
  return mixWith(hex, amount, [0, 0, 0]);
}

function lighten(hex: string, amount = 0.16) {
  return mixWith(hex, amount, [255, 255, 255]);
}

function normalizeAngle(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 135;
  }
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function normalizeWidgetTheme(theme: WidgetThemeSettings): WidgetThemeSettings {
  const primaryColor = normalizeHexColor(theme.primaryColor, "#3170FC");
  const accentColor = normalizeHexColor(theme.accentColor, "#9E4770");
  const surfaceColor = normalizeHexColor(theme.surfaceColor, "#FFFFFF");
  const textPrimaryColor = normalizeHexColor(theme.textPrimaryColor, "#0F172A");
  const textSecondaryColor = normalizeHexColor(theme.textSecondaryColor, "#475569");
  const quickActionColor = normalizeHexColor(theme.quickActions?.color, accentColor);
  const sendButtonColor = normalizeHexColor(theme.sendButton?.color, primaryColor);

  const headerMode = theme.headerBackground?.mode === "gradient" ? "gradient" : "solid";
  const headerSolidColor = normalizeHexColor(theme.headerBackground?.solidColor, primaryColor);
  const headerGradientFrom = normalizeHexColor(theme.headerBackground?.gradient?.from, primaryColor);
  const headerGradientTo = normalizeHexColor(theme.headerBackground?.gradient?.to, accentColor);
  const headerGradientAngle = normalizeAngle(theme.headerBackground?.gradient?.angle);

  return {
    ...theme,
    primaryColor,
    accentColor,
    surfaceColor,
    textPrimaryColor,
    textSecondaryColor,
    fontFamily: (theme.fontFamily || "'Inter', sans-serif").trim(),
    logoUrl: theme.logoUrl?.trim() || undefined,
    headerBackground: {
      mode: headerMode,
      solidColor: headerSolidColor,
      gradient: {
        from: headerGradientFrom,
        to: headerGradientTo,
        angle: headerGradientAngle,
      },
    },
    quickActions: {
      color: quickActionColor,
      variant: theme.quickActions?.variant === "outline" ? "outline" : "solid",
    },
    sendButton: {
      color: sendButtonColor,
      textColor: normalizeHexColor(theme.sendButton?.textColor, getReadableTextColor(sendButtonColor)),
    },
  };
}

export function resolveHeaderBackground(theme: WidgetThemeSettings) {
  const normalized = normalizeWidgetTheme(theme);
  const header = normalized.headerBackground;
  if (header?.mode === "gradient") {
    return `linear-gradient(${header.gradient?.angle ?? 135}deg, ${header.gradient?.from ?? normalized.primaryColor} 0%, ${header.gradient?.to ?? normalized.accentColor} 100%)`;
  }
  return header?.solidColor ?? normalized.primaryColor;
}

export function widgetThemeToChatTheme(theme: WidgetThemeSettings): Partial<ThemeTokens> {
  const normalized = normalizeWidgetTheme(theme);
  const headerBackground = resolveHeaderBackground(normalized);
  const headerTextColor = getReadableTextColor(
    normalized.headerBackground?.mode === "gradient"
      ? normalized.headerBackground.gradient?.to ?? normalized.primaryColor
      : normalized.headerBackground?.solidColor ?? normalized.primaryColor,
  );

  const quickActionsColor = normalized.quickActions?.color ?? normalized.accentColor;
  const quickActionsVariant = normalized.quickActions?.variant ?? "solid";
  const quickActionsText = getReadableTextColor(quickActionsColor);

  const sendButtonColor = normalized.sendButton?.color ?? normalized.primaryColor;
  const sendButtonTextColor = normalized.sendButton?.textColor || getReadableTextColor(sendButtonColor);

  return {
    primaryColor: normalized.primaryColor,
    primaryHoverColor: darken(normalized.primaryColor, 0.14),
    primaryPressedColor: darken(normalized.primaryColor, 0.24),
    accentColor: normalized.accentColor,
    accentLightColor: lighten(normalized.accentColor, 0.78),
    surfaceColor: normalized.surfaceColor,
    surfaceElevatedColor: lighten(normalized.surfaceColor, 0.04),
    surfaceHoverColor: lighten(normalized.surfaceColor, 0.1),
    surfaceMutedColor: lighten(normalized.surfaceColor, 0.08),
    textPrimaryColor: normalized.textPrimaryColor,
    textSecondaryColor: normalized.textSecondaryColor,
    textTertiaryColor: lighten(normalized.textSecondaryColor, 0.32),
    userBubbleBg: normalized.primaryColor,
    userBubbleText: "#FFFFFF",
    assistantBubbleBg: lighten(normalized.surfaceColor, 0.08),
    assistantBubbleText: normalized.textPrimaryColor,
    systemBubbleBg: lighten(normalized.surfaceColor, 0.06),
    systemBubbleText: normalized.textSecondaryColor,
    ctaBg: normalized.primaryColor,
    ctaText: "#FFFFFF",
    logoUrl: normalized.logoUrl,
    fontBody: normalized.fontFamily,
    fontDisplay: normalized.fontFamily,
    headerBackground,
    headerTextColor,
    quickActionColor: quickActionsVariant === "outline" ? "transparent" : quickActionsColor,
    quickActionTextColor: quickActionsVariant === "outline" ? quickActionsColor : quickActionsText,
    quickActionBorderColor: quickActionsColor,
    quickActionHoverColor:
      quickActionsVariant === "outline" ? lighten(quickActionsColor, 0.9) : darken(quickActionsColor, 0.08),
    sendButtonColor,
    sendButtonHoverColor: darken(sendButtonColor, 0.12),
    sendButtonPressedColor: darken(sendButtonColor, 0.2),
    sendButtonTextColor,
  };
}
