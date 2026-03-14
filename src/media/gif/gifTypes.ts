import type { QuickPickItem } from "../../hostEditor/EditorTypes";

export interface GifItem extends QuickPickItem {
  downloadUrl: string;
  previewUrl: string;
  gifId: string;
}

export type GifProvider = "giphy" | "klipy";

export interface GifProviderPick extends QuickPickItem {
  provider: GifProvider;
}

export interface GiphyGif {
  id: string;
  title: string;
  images: {
    original: { url: string };
    downsized: { url: string };
    fixed_height: { url: string };
  };
}

export interface GiphyResponse {
  data: GiphyGif[];
}

export interface KlipyMediaVariant {
  url: string;
  width: number;
  height: number;
  size: number;
}

export interface KlipySizeTier {
  gif?: KlipyMediaVariant;
  webp?: KlipyMediaVariant;
  jpg?: KlipyMediaVariant;
  mp4?: KlipyMediaVariant;
}

export interface KlipyGif {
  id: number;
  slug: string;
  title?: string;
  file: {
    hd?: KlipySizeTier;
    md?: KlipySizeTier;
    sm?: KlipySizeTier;
    xs?: KlipySizeTier;
  };
}

export interface KlipyResponse {
  result: boolean;
  data: { data: KlipyGif[] };
}

export const GIF_PROVIDER_INFO: Record<GifProvider, { label: string; apiKeySettingKey: string; signupUrl: string }> = {
  giphy: {
    label: "Giphy",
    apiKeySettingKey: "giphyApiKey",
    signupUrl: "https://developers.giphy.com/",
  },
  klipy: {
    label: "Klipy",
    apiKeySettingKey: "klipyApiKey",
    signupUrl: "https://developer.klipy.com/",
  },
};
