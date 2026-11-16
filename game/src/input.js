// Keyboard, mouse and pointer lock. The sim reads `state` once per frame;
// look deltas are consumed exactly once via takeLook, so nothing is lost or
// double-applied when the frame rate and the sim rate differ.
export function createInput(canvas, onLockChange) {
  const state = {
    keys: new Set(),
    firing: false,
    aiming: false,
    locked: false,
    pressed: new Set(), // edge-triggered keys, cleared by the sim each frame
  };
  let lookX = 0;
  let lookY = 0;

  document.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    state.keys.add(event.code);
    state.pressed.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  });
  document.addEventListener('keyup', (event) => {
    state.keys.delete(event.code);
  });
  document.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    lookX += event.movementX;
    lookY += event.movementY;
  });
  document.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.aiming = true;
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.aiming = false;
  });
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      state.firing = false;
      state.aiming = false;
    }
    onLockChange(state.locked);
  });
  window.addEventListener('blur', () => {
    state.keys.clear();
    state.firing = false;
    state.aiming = false;
  });

  return {
    state,
    takeLook() {
      const look = { x: lookX, y: lookY };
      lookX = 0;
      lookY = 0;
      return look;
    },
    requestLock() {
      canvas.requestPointerLock();
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
  };
}
