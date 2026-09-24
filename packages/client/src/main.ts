import { Game } from './engine/Game';
import { loadFonts } from './engine/text';
import { TitleScene } from './scenes/TitleScene';

async function boot(): Promise<void> {
  if (new URLSearchParams(location.search).has('sheet')) {
    const { sheet } = await import('./debug/sheet');
    await sheet();
    return;
  }
  await loadFonts();
  const game = new Game(document.getElementById('screen') as HTMLCanvasElement);
  document.getElementById('boot')?.remove();
  game.setScene(new TitleScene());
  game.start();
  (window as unknown as { __game: Game }).__game = game;
}

void boot();
