// The first-person body: acceleration, friction, crouch, jump and wall
// collision. Stopping to aim pays because spread (weapons.js) reads the
// speed this module reports; movement itself never touches the camera.
import { SIM } from './config.js';
import { moveCircle } from './collision.js';

export function createPlayerController() {
  return {
    look(player, dx, dy, sensitivity) {
      player.yaw -= dx * sensitivity;
      player.pitch -= dy * sensitivity;
      const limit = Math.PI / 2 - 0.01;
      if (player.pitch > limit) player.pitch = limit;
      if (player.pitch < -limit) player.pitch = -limit;
    },

    recoil(player, pitchKick, yawKick) {
      player.recoilPitch += pitchKick;
      player.recoilYaw += yawKick;
      player.pitch += pitchKick;
      player.yaw += yawKick;
    },

    step(player, keys, dt, frozen) {
      // Recoil recovery: the view settles back toward where the player aimed.
      const recover = Math.min(player.recoilPitch, 1.6 * dt);
      player.recoilPitch -= recover;
      player.pitch -= recover;
      player.recoilYaw *= Math.max(0, 1 - 8 * dt);

      if (frozen || !player.alive) {
        player.vx = 0;
        player.vz = 0;
        player.speed2d = 0;
        return;
      }
      const crouchKey = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
      player.crouched = crouchKey;
      const sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = player.crouched ? SIM.crouchSpeed : sneak ? SIM.sneakSpeed : SIM.walkSpeed;

      let forward = 0;
      let strafe = 0;
      if (keys.has('KeyW')) forward += 1;
      if (keys.has('KeyS')) forward -= 1;
      if (keys.has('KeyD')) strafe += 1;
      if (keys.has('KeyA')) strafe -= 1;
      const length = Math.hypot(forward, strafe) || 1;
      forward /= length;
      strafe /= length;

      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const wishX = (-sin * forward + cos * strafe) * speed;
      const wishZ = (-cos * forward - sin * strafe) * speed;
      const accel = player.onGround ? SIM.accelGround : SIM.accelAir;
      player.vx += clamp(wishX - player.vx, -accel * dt, accel * dt);
      player.vz += clamp(wishZ - player.vz, -accel * dt, accel * dt);
      if (forward === 0 && strafe === 0 && player.onGround) {
        const drag = Math.max(0, 1 - SIM.friction * dt);
        player.vx *= drag;
        player.vz *= drag;
      }
      if (keys.has('Space') && player.onGround) {
        player.vy = SIM.jumpSpeed;
        player.onGround = false;
      }
      player.vy -= SIM.gravity * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
        player.onGround = true;
      }
      const pos = { x: player.x, z: player.z };
      moveCircle(pos, player.vx * dt, player.vz * dt, SIM.playerRadius);
      player.x = pos.x;
      player.z = pos.z;
      player.speed2d = Math.hypot(player.vx, player.vz);
    },

    eyeHeight(player) {
      const target = player.crouched ? SIM.eyeCrouch : SIM.eyeStanding;
      return target;
    },
  };
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
