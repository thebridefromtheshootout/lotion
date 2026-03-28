import { Regex } from "../regex";

export type CalloutType = "NOTE" | "TIP" | "WARNING" | "IMPORTANT" | "CAUTION";

export interface CalloutOpenMatch {
  raw: string;
  type: CalloutType;
}

export interface CalloutTokenMatch {
  raw: string;
  type: CalloutType;
  body: string;
}

const CALLOUT_ICONS: Record<CalloutType, string> = {
  NOTE: "ℹ️",
  TIP: "💡",
  WARNING: "⚠️",
  IMPORTANT: "🔥",
  CAUTION: "🛑",
};

export class CalloutParser {
  parseOpenLine(line: string): CalloutOpenMatch | undefined {
    const match = line.match(Regex.calloutOpen);
    if (!match) {
      return undefined;
    }
    return {
      raw: match[0],
      type: this.normalizeType(match[1]),
    };
  }

  parseToken(text: string): CalloutTokenMatch | undefined {
    const match = text.match(Regex.calloutTokenWithText);
    if (!match) {
      return undefined;
    }
    return {
      raw: match[0],
      type: this.normalizeType(match[1]),
      body: (match[2] ?? "").trim(),
    };
  }

  isContinuationLine(line: string): boolean {
    return Regex.calloutContinuation.test(line);
  }

  stripTokenPrefix(text: string): string {
    return text.replace(Regex.calloutTokenStrip, "");
  }

  stripBlockquotePrefix(text: string): string {
    return text.replace(Regex.calloutStripPrefixGlobal, "");
  }

  toLower(type: CalloutType): string {
    return type.toLowerCase();
  }

  titleForType(type: CalloutType): string {
    return type.charAt(0) + type.slice(1).toLowerCase();
  }

  iconForType(type: CalloutType): string {
    return CALLOUT_ICONS[type];
  }

  private normalizeType(rawType: string): CalloutType {
    return rawType.toUpperCase() as CalloutType;
  }
}

export const calloutParser = new CalloutParser();
