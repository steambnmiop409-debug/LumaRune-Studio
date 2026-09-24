import { Game } from './engine/Game';
import { loadCjkFonts, loadFonts } from './engine/text';
import { host } from './platform/host';
import { loadSettings, onSettings, settings } from './settings';
import { TitleScene } from './scenes/TitleScene';

async function boot(): Promise<void> {
  if (new URLSearchParams(location.search).has('sheet')) {
    const { sheet } = await import('./debug/sheet');
    await sheet();
    return;
  }
  await Promise.all([loadFonts(), loadSettings()]);
  if (settings.lang === 'ja') await loadCjkFonts();
  onSettings((s) => {
    if (s.lang === 'ja') void loadCjkFonts();
  });
  if (host && settings.fullscreen) void host.setFullscreen(true);
  const game = new Game(document.getElementById('screen') as HTMLCanvasElement);
  document.getElementById('boot')?.remove();
  game.setScene(new TitleScene());
  game.start();
  (window as unknown as { __game: Game }).__game = game;
  // The desktop app asks before closing the window: save the world, then let it go.
  host?.onBeforeQuit(() => {
    const pending = game.scene?.save?.() ?? Promise.resolve(true);
    void pending.finally(() => host!.quitReady());
  });
  // Browsers may clear site data under storage pressure unless asked to keep it.
  if (!host) void navigator.storage?.persist?.().catch(() => false);
}

void boot();
