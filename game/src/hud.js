// The DOM HUD: health, ammo, money, timer, score, killfeed, crosshair,
// minimap, buy menu and overlays. The sim never touches the DOM; this module
// reads the state store once per frame and writes only what changed.
import { MAP } from './mapdata.js';
import { WEAPONS, GRENADES, ROUNDS } from './config.js';
import { buyCatalog } from './rounds.js';

function el(id) {
  return document.getElementById(id);
}

export function createHud(callbacks) {
  const nodes = {
    healthValue: el('health-value'),
    healthBar: el('health-bar'),
    armorValue: el('armor-value'),
    ammoMag: el('ammo-mag'),
    ammoReserve: el('ammo-reserve'),
    weaponName: el('weapon-name'),
    grenadeLine: el('grenade-line'),
    money: el('money-value'),
    timer: el('timer-value'),
    scoreW: el('score-wardens'),
    scoreE: el('score-embers'),
    roundLabel: el('round-label'),
    killfeed: el('killfeed'),
    banner: el('banner'),
    bannerText: el('banner-text'),
    bannerSub: el('banner-sub'),
    bomb: el('bomb-status'),
    bombLabel: el('bomb-label'),
    bombBar: el('bomb-bar'),
    prompt: el('prompt'),
    crosshair: el('crosshair'),
    hitmarker: el('hitmarker'),
    vignette: el('vignette'),
    flashOverlay: el('flash-overlay'),
    buyMenu: el('buy-menu'),
    buyItems: el('buy-items'),
    buyMoney: el('buy-money'),
    overlay: el('overlay'),
    overlayTitle: el('overlay-title'),
    overlayCopy: el('overlay-copy'),
    playButton: el('play'),
    spectate: el('spectate'),
    minimap: el('minimap'),
  };
  const mapCtx = nodes.minimap.getContext('2d');
  let lastKillfeedLength = -1;
  let lastBuyMoney = -1;
  let hitmarkerUntil = 0;
  let buyBuilt = false;

  nodes.playButton.addEventListener('click', () => callbacks.onPlay());
  nodes.buyMenu.querySelector('#buy-close').addEventListener('click', () => callbacks.onResume());

  function buildBuyMenu() {
    if (buyBuilt) return;
    buyBuilt = true;
    for (const item of buyCatalog()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buy-item';
      button.dataset.id = item.id;
      button.innerHTML = `<span class="buy-name">${item.label}</span><span class="buy-detail">${item.detail}</span><span class="buy-price">$${item.price}</span>`;
      button.addEventListener('click', () => callbacks.onBuy(item.id));
      nodes.buyItems.appendChild(button);
    }
  }

  function drawMinimap(S) {
    const size = 148;
    const scale = size / 64;
    const toX = (x) => (x + 32) * scale;
    const toZ = (z) => (z + 24) * scale;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(20,22,26,0.72)';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.fillStyle = '#6e6a60';
    for (const solid of MAP.solids) {
      mapCtx.fillRect(toX(solid.x0), toZ(solid.z0), (solid.x1 - solid.x0) * scale, (solid.z1 - solid.z0) * scale);
    }
    for (const [id, site] of Object.entries(MAP.sites)) {
      mapCtx.fillStyle = S.bomb.state === 'planted' && S.bomb.site === id ? '#f0a830' : 'rgba(240,168,48,0.25)';
      mapCtx.fillRect(toX(site.x0), toZ(site.z0), (site.x1 - site.x0) * scale, (site.z1 - site.z0) * scale);
      mapCtx.fillStyle = '#e9e6df';
      mapCtx.font = 'bold 11px system-ui, sans-serif';
      mapCtx.textAlign = 'center';
      mapCtx.fillText(id, toX(site.cx), toZ(site.cz) + 4);
    }
    // Sound contacts: recent enemy gunfire shows as fading red dots.
    for (const event of S.events) {
      if (event.team === 'wardens') continue;
      const age = S.time - event.time;
      if (age > 2) continue;
      mapCtx.fillStyle = `rgba(194,80,46,${1 - age / 2})`;
      mapCtx.beginPath();
      mapCtx.arc(toX(event.x), toZ(event.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    for (const bot of S.bots) {
      if (!bot.alive || bot.team !== 'wardens') continue;
      mapCtx.fillStyle = '#2e8f8a';
      mapCtx.beginPath();
      mapCtx.arc(toX(bot.x), toZ(bot.z), 3, 0, Math.PI * 2);
      mapCtx.fill();
    }
    const player = S.player;
    mapCtx.save();
    mapCtx.translate(toX(player.x), toZ(player.z));
    mapCtx.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
    mapCtx.fillStyle = '#e9e6df';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4, 5);
    mapCtx.lineTo(-4, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    hitMarker(head, holdMs) {
      nodes.hitmarker.classList.toggle('head', head);
      nodes.hitmarker.classList.add('on');
      hitmarkerUntil = performance.now() + holdMs;
    },

    showOverlay(mode, S) {
      nodes.overlay.hidden = false;
      if (mode === 'start') {
        nodes.overlayTitle.textContent = 'EMBERLINE';
        nodes.overlayCopy.textContent = 'Round-based tactical FPS in a dusk harbor yard. Hold the sites, stop the charge, or lose the yard. Click to play.';
        nodes.playButton.textContent = 'Click to play';
      } else if (mode === 'paused') {
        nodes.overlayTitle.textContent = 'Paused';
        nodes.overlayCopy.textContent = 'The round waits for no one. Click to jump back in.';
        nodes.playButton.textContent = 'Resume';
      } else if (mode === 'matchEnd') {
        const won = S.wins.wardens > S.wins.embers;
        nodes.overlayTitle.textContent = won ? 'Match won' : 'Match lost';
        nodes.overlayCopy.textContent = `Final score: Wardens ${S.wins.wardens} — ${S.wins.embers} Emberjacks. ${won ? 'The yard holds.' : 'The yard burns.'} Play again?`;
        nodes.playButton.textContent = 'Play again';
      }
    },

    hideOverlay() {
      nodes.overlay.hidden = true;
    },

    update(S, spreadPx, promptText) {
      const player = S.player;
      nodes.healthValue.textContent = Math.max(0, Math.ceil(player.health));
      nodes.healthBar.style.width = `${Math.max(0, player.health)}%`;
      nodes.healthBar.classList.toggle('low', player.health <= 30);
      nodes.armorValue.textContent = Math.ceil(player.armor);
      const def = player.slot === 'primary' && player.primary
        ? WEAPONS[player.primary]
        : player.slot === 'grenade' ? null : WEAPONS[player.side];
      if (def) {
        nodes.weaponName.textContent = def.name;
        nodes.ammoMag.textContent = player.reloading > 0 ? '––' : player.mag[def.id];
        nodes.ammoReserve.textContent = `/ ${player.reserve[def.id]}`;
      } else {
        nodes.weaponName.textContent = GRENADES[player.grenadeKind]?.name ?? 'CHARGE';
        nodes.ammoMag.textContent = player.grenades[player.grenadeKind] ?? 0;
        nodes.ammoReserve.textContent = '';
      }
      nodes.grenadeLine.textContent = `Frag ${player.grenades.frag} · Flash ${player.grenades.flash} · Smoke ${player.grenades.smoke}`;
      nodes.money.textContent = `${player.money}`;
      const seconds = Math.max(0, Math.ceil(S.phase === 'live' && S.bomb.state === 'planted' ? S.bomb.fuse : S.phaseTime));
      nodes.timer.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      nodes.timer.classList.toggle('urgent', seconds <= 10 && S.phase === 'live');
      nodes.scoreW.textContent = S.wins.wardens;
      nodes.scoreE.textContent = S.wins.embers;
      nodes.roundLabel.textContent = `ROUND ${S.round} · FIRST TO ${ROUNDS.winsForMatch}`;

      if (S.killfeed.length !== lastKillfeedLength) {
        lastKillfeedLength = S.killfeed.length;
        nodes.killfeed.innerHTML = '';
        for (const entry of S.killfeed) {
          const line = document.createElement('div');
          line.className = `feed-line ${entry.team ?? ''}`;
          line.textContent = entry.text;
          nodes.killfeed.appendChild(line);
        }
      }

      if (S.banner && S.time < S.banner.until) {
        nodes.banner.hidden = false;
        nodes.bannerText.textContent = S.banner.text;
        nodes.bannerText.className = S.banner.team === 'wardens' ? 'win' : 'lose';
        nodes.bannerSub.textContent = S.banner.sub;
      } else {
        nodes.banner.hidden = true;
      }

      if (S.phase === 'live' && S.bomb.state === 'planted') {
        nodes.bomb.hidden = false;
        nodes.bombLabel.textContent = `CHARGE AT SITE ${S.bomb.site} — DEFUSE IT`;
        nodes.bombBar.style.width = `${(S.bomb.fuse / ROUNDS.fuseTime) * 100}%`;
      } else if (S.phase === 'live' && S.bomb.state === 'dropped') {
        nodes.bomb.hidden = false;
        nodes.bombLabel.textContent = 'CHARGE DROPPED';
        nodes.bombBar.style.width = '100%';
      } else {
        nodes.bomb.hidden = true;
      }

      if (player.defusing > 0) {
        nodes.prompt.hidden = false;
        nodes.prompt.textContent = `DEFUSING… ${Math.round((player.defusing / ROUNDS.defuseTime) * 100)}%`;
      } else if (promptText) {
        nodes.prompt.hidden = false;
        nodes.prompt.textContent = promptText;
      } else {
        nodes.prompt.hidden = true;
      }

      nodes.crosshair.style.setProperty('--gap', `${4 + spreadPx}px`);
      if (performance.now() > hitmarkerUntil) nodes.hitmarker.classList.remove('on');
      nodes.vignette.style.opacity = player.damageFlash > 0 ? String(Math.min(0.75, player.damageFlash)) : '0';
      const blindLeft = S.player.flashUntil - S.time;
      nodes.flashOverlay.style.opacity = blindLeft > 0 ? String(Math.min(1, blindLeft * 1.4)) : '0';
      nodes.spectate.hidden = player.alive || S.phase !== 'live';
      nodes.buyMenu.hidden = !S.buyOpen;
      if (S.buyOpen) {
        buildBuyMenu();
        if (player.money !== lastBuyMoney) {
          lastBuyMoney = player.money;
          nodes.buyMoney.textContent = `$${player.money}`;
          for (const button of nodes.buyItems.children) {
            const item = buyCatalog().find((entry) => entry.id === button.dataset.id);
            button.classList.toggle('poor', player.money < item.price);
          }
        }
      }
      drawMinimap(S);
    },
  };
}
