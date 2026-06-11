import { Game } from './game/Game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

game.restart();

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
