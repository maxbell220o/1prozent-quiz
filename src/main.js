import { renderAdmin } from './views/admin.js';
import { renderPlayer } from './views/player.js';
import { renderDisplay } from './views/display.js';

const app = document.querySelector('#app');

function renderHome() {
  app.innerHTML = `
    <main class="shell home">
      <section class="hero">
        <div>
          <p class="eyebrow">Realtime Unterrichtsquiz</p>
          <h1>1% Quiz</h1>
          <p>Starte eine Gameshow-Runde, lass Spieler per Raumcode beitreten und zeige den Spielstand live auf der Tafel.</p>
        </div>
        <nav class="quick-actions" aria-label="Ansichten">
          <a class="button primary" href="#/admin">Admin</a>
          <a class="button" href="#/player">Teilnehmer</a>
          <a class="button" href="#/display">Anzeige</a>
        </nav>
      </section>
    </main>
  `;
}

function router() {
  const route = location.hash.replace('#', '') || '/';

  if (route.startsWith('/admin')) renderAdmin(app);
  else if (route.startsWith('/player')) renderPlayer(app);
  else if (route.startsWith('/display')) renderDisplay(app);
  else renderHome();
}

window.addEventListener('hashchange', router);
router();
