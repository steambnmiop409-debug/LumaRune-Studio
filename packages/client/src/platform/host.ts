/**
 * What the desktop app offers the page (see packages/desktop/preload.cjs). In a browser this is
 * null and the game falls back to IndexedDB saves and localStorage settings.
 */
export interface DesktopHost {
  platform: string;
  saves: {
    load(slot: number): Promise<string | null>;
    save(slot: number, json: string): Promise<void>;
    remove(slot: number): Promise<void>;
    /** Absolute path of the save folder, for the settings screen. */
    dir(): Promise<string>;
    /** Opens the save folder in the OS file manager. */
    open(): Promise<string>;
  };
  settings: {
    load(): Promise<string | null>;
    save(json: string): Promise<void>;
  };
  setFullscreen(on: boolean): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  onBeforeQuit(fn: () => void): void;
  quitReady(): void;
  quit(): void;
}

export const host: DesktopHost | null = (window as unknown as { luminaHost?: DesktopHost }).luminaHost ?? null;
