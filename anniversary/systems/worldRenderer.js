import { WORLD, PLAYER, COMBAT, JUICE } from '../data/constants.js';
import { SPRITES } from './sprites.js';
import { makeCanvas } from './pixel.js';

/**
 * 世界渲染：走廊 → 地面贴花（影子 / 红圈）→ 立体物体（远到近排序）→ 粒子 → 屏幕特效。
 * 所有绘制都在低分辨率像素缓冲上进行。
 */
const PXM = WORLD.spritePxPerMeter;
const K_HAZ = 1;
const K_COIN = 2;
const K_PICK = 3;
const K_DECOR = 4;
const K_PLAYER = 5;
const K_BOSS = 6;

function fogAlpha(z) {
  if (z <= 50) return 1;
  const a = 1 - (z - 50) / (WORLD.spawnZ - 50);
  return a < 0 ? 0 : a;
}

/** 按透视画一个立在地上的精灵（底边中点在 (x, y, z)） */
function billboard(ctx, cam, img, x, y, z, alpha) {
  if (!cam.project(x, y, z)) return;
  const k = cam.ps / PXM;
  const w = img.width * k;
  const h = img.height * k;
  if (w < 1) return;
  ctx.globalAlpha = alpha * fogAlpha(z);
  ctx.drawImage(img, Math.round(cam.px - w / 2), Math.round(cam.py - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** 拉伸到指定世界尺寸（米） */
function stretched(ctx, cam, img, x, yBottom, z, wM, hM, alpha) {
  if (!cam.project(x, yBottom, z)) return;
  const w = wM * cam.ps;
  const h = hM * cam.ps;
  if (w < 1) return;
  ctx.globalAlpha = alpha * fogAlpha(z);
  ctx.drawImage(img, Math.round(cam.px - w / 2), Math.round(cam.py - h), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** 地面贴花（影子、红圈），中心在 (x, 0, z) */
function decal(ctx, cam, img, x, z, wM, alpha, yOff = 0) {
  if (!cam.project(x, yOff, z)) return;
  const w = wM * cam.ps;
  const h = (w * img.height) / img.width;
  if (w < 1) return;
  ctx.globalAlpha = alpha * fogAlpha(z);
  ctx.drawImage(img, Math.round(cam.px - w / 2), Math.round(cam.py - h / 2), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

// 障碍描边颜色 = 应对动作：黄 = 跳过去，蓝 = 下铲钻过去，红 = 跳不过也铲不过（必须变道）
const GLOW_JUMP = '#ffd23f';
const GLOW_SLIDE = '#4dd2ff';
const GLOW_BLOCK = '#ff4d5e';

/** 给精灵生成 2px 彩色描边版本（按精灵画布缓存，一次性生成） */
function glowSprite(img, color) {
  const key = '__glow_' + color;
  if (img[key]) return img[key];
  const pad = 2;
  const c = makeCanvas(img.width + pad * 2, img.height + pad * 2);
  const ctx = c.getContext('2d');
  // 本体的纯色剪影
  const tint = makeCanvas(img.width, img.height);
  const tctx = tint.getContext('2d');
  tctx.drawImage(img, 0, 0);
  tctx.globalCompositeOperation = 'source-in';
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, img.width, img.height);
  for (let dy = -pad; dy <= pad; dy++) {
    for (let dx = -pad; dx <= pad; dx++) {
      if (dx === 0 && dy === 0) continue;
      ctx.drawImage(tint, pad + dx, pad + dy);
    }
  }
  ctx.drawImage(img, pad, pad);
  img[key] = c;
  return c;
}

/** 跳跃抛物线中，脚底保持在 height 以上的时长（顶点 1.8m、滞空 0.6s 反推） */
function airTimeAbove(height) {
  if (height >= PLAYER.jumpHeight) return 0;
  return PLAYER.jumpAirTime * Math.sqrt(Math.max(0, 1 - height / PLAYER.jumpHeight));
}

/** 障碍描边颜色（返回 null = 不描边）。跳不过也铲不过的给红，与红色车道预警同一套规则 */
function outlineFor(world, h) {
  if (h.kind === 'high') return GLOW_SLIDE;
  if (h.kind === 'low') {
    if (h.walkable) return GLOW_JUMP; // 购物车顶能踩上去，多长都算"跳"
    // 通行时间比"跳起后保持在障碍高度以上的时间"还长 → 跳不过（如 8m 香蕉地毯）
    const approach = (h.anchored ? world.speedNow : 0) + (h.vz || 0);
    if (approach > 0 && h.len / approach > airTimeAbove(h.height)) return GLOW_BLOCK;
    return GLOW_JUMP;
  }
  if (h.kind === 'full') return h.height >= PLAYER.jumpHeight ? GLOW_BLOCK : GLOW_JUMP;
  return null;
}

function pushItem(world, z, kind, ref) {
  if (world.renderCount >= world.renderList.length) return;
  const it = world.renderList[world.renderCount++];
  it.z = z;
  it.kind = kind;
  it.ref = ref;
}

export function renderWorld(world, ctx, W, H) {
  const cam = world.camera;
  const s = world.session;
  if (cam.W !== W || cam.H !== H) cam.setViewport(W, H);
  world.corridor.ensure(ctx, W, H);
  world.corridor.render(ctx, cam, s.trackPos, world.time, world.zones, world.laneWarn);

  ctx.imageSmoothingEnabled = false;
  const S = SPRITES;
  const p = world.player;

  // ---- 地面贴花：影子 & 预警红圈 ----
  const hz = world.hazards.items;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    if (!h.active) continue;
    drawHazardDecal(world, ctx, cam, h);
  }
  const coins = world.coins.items;
  for (let i = 0; i < world.pickups.items.length; i++) {
    const it = world.pickups.items[i];
    if (it.active) decal(ctx, cam, S.shadow, it.x, it.z, 0.9, 0.8);
  }
  if (world.boss && world.boss.visible) {
    const b = world.boss;
    decal(ctx, cam, S.shadow, b.x, b.z, 5 * Math.max(0.2, b.scale), 0.6);
  }
  // 主角影子（跳得越高影子越小）
  if (!p.dead && !world.hidePlayer) {
    const shrink = Math.max(0.45, 1 - p.y * 0.25);
    decal(ctx, cam, S.shadow, p.x, 0, 1.3 * shrink, 1, groundUnder(world));
  }
  // 冲刺型还击：绿箭头指向跪地的 Boss
  if (world.dashLane !== null && S.dashArrow) {
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 10);
    for (let z = 1.5; z < 7.5; z += 1.5) decal(ctx, cam, S.dashArrow, world.dashLane * WORLD.laneWidth, z, 1.5, pulse * (1 - z / 10));
  }
  // 反弹进阶：Boss 所在的道亮金圈
  if (world.aimLane !== null && world.aimLane !== undefined) {
    const pulse = 1 + 0.15 * Math.sin(world.time * 20);
    decal(ctx, cam, S.ringGold, world.aimLane * WORLD.laneWidth, 10, 2.6 * pulse, 1);
  }
  ctx.globalAlpha = 1;

  // ---- 收集立体物体并排序（远 → 近） ----
  world.renderCount = 0;
  for (let i = 0; i < hz.length; i++) {
    const h = hz[i];
    // 已经跑到身后太远的不再画（贴脸会变得巨大，只会挡视线）
    if (h.active && (h.reflected || h.z + h.len > -2.5)) pushItem(world, hazardSortZ(h), K_HAZ, h);
  }
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.active && c.z < WORLD.spawnZ + 2 && c.z > -1.2) pushItem(world, c.z, K_COIN, c);
  }
  for (let i = 0; i < world.pickups.items.length; i++) {
    const it = world.pickups.items[i];
    if (it.active && it.z > -1.2) pushItem(world, it.z, K_PICK, it);
  }
  for (let i = 0; i < world.decor.items.length; i++) {
    const d = world.decor.items[i];
    if (d.active) pushItem(world, d.z, K_DECOR, d);
  }
  if (world.boss && world.boss.visible) pushItem(world, world.boss.z, K_BOSS, world.boss);
  if (!world.hidePlayer) pushItem(world, 0.01, K_PLAYER, p);

  const list = world.renderList;
  const n = world.renderCount;
  // 插入排序（数量少、基本有序，且不产生垃圾）
  for (let i = 1; i < n; i++) {
    const it = list[i];
    const z = it.z;
    const kind = it.kind;
    const ref = it.ref;
    let j = i - 1;
    while (j >= 0 && list[j].z < z) {
      list[j + 1].z = list[j].z;
      list[j + 1].kind = list[j].kind;
      list[j + 1].ref = list[j].ref;
      j--;
    }
    list[j + 1].z = z;
    list[j + 1].kind = kind;
    list[j + 1].ref = ref;
  }

  for (let i = 0; i < n; i++) {
    const it = list[i];
    switch (it.kind) {
      case K_HAZ:
        drawHazard(world, ctx, cam, it.ref);
        break;
      case K_COIN: {
        const c = it.ref;
        billboard(ctx, cam, S.coin[Math.floor(c.phase) & 3], c.x, c.y - 0.35, c.z, 1);
        break;
      }
      case K_PICK: {
        const pk = it.ref;
        const img = S[pk.id];
        const bob = Math.sin(pk.phase) * 0.15;
        // 光晕闪烁
        if (cam.project(pk.x, pk.y + bob + 0.45, pk.z)) {
          ctx.globalAlpha = 0.35 + 0.2 * Math.sin(pk.phase * 2);
          ctx.fillStyle = pk.id === 'heart' ? '#ff6fa5' : '#ffffff';
          const r = Math.max(1, Math.round(cam.ps * 0.6));
          ctx.fillRect(Math.round(cam.px - r), Math.round(cam.py - r), r * 2, r * 2);
        }
        billboard(ctx, cam, img, pk.x, pk.y + bob, pk.z, 1);
        break;
      }
      case K_DECOR: {
        const d = it.ref;
        billboard(ctx, cam, d.sprite, d.x, d.y, d.z, 1);
        break;
      }
      case K_BOSS:
        drawBoss(world, ctx, cam, it.ref);
        break;
      case K_PLAYER:
        drawPlayer(world, ctx, cam, p);
        break;
    }
  }
  ctx.globalAlpha = 1;

  world.particles.render(ctx);
  drawScreenEffects(world, ctx, W, H);
}

function groundUnder(world) {
  const p = world.player;
  if (p.grounded) return p.y;
  return world.groundHeight();
}

function hazardSortZ(h) {
  if (h.behavior === 'lob' || h.behavior === 'return') {
    const t = Math.min(1, h.t / h.T);
    return h.z0 + (h.z1 - h.z0) * t;
  }
  return h.z + Math.min(h.len, 1.5) * 0.5;
}

/** 取精灵：多车道版本 / 动画帧 */
function spriteOf(world, h) {
  const img = SPRITES[h.sprite];
  if (!Array.isArray(img)) return img;
  if (h.spanSprite) return img[h.lanes] || img[img.length - 1];
  return img[Math.floor(world.time * h.fps) % img.length];
}

function drawHazardDecal(world, ctx, cam, h) {
  const S = SPRITES;
  if (h.behavior === 'drop') {
    if (!h.locked) return;
    const tau = h.z / Math.max(1, world.speedNow);
    const warn = world.session.params.warning;
    decal(ctx, cam, S.shadow, h.x, h.z, 1.2 * (1 - Math.min(1, tau / h.appear) * 0.6), 0.7);
    if (tau <= warn) {
      const pulse = 1 + 0.12 * Math.sin(world.time * 30);
      const img = tau <= COMBAT.perfectWindow ? S.ringGold : S.ringRed;
      decal(ctx, cam, img, h.x, h.z, 2.2 * pulse, 1);
    }
    return;
  }
  if (h.behavior === 'lob') {
    const pulse = 1 + 0.12 * Math.sin(world.time * 30);
    const gold = h.landHit && h.T - h.t <= COMBAT.perfectWindow;
    decal(ctx, cam, gold ? S.ringGold : S.ringRed, h.x1, h.z1, 2.4 * pulse, 1);
    return;
  }
  if (h.behavior === 'return') return;
  if (h.reflectable) {
    // 收缩的时机圈：金色 = 现在按 J / 点击就是完美反击
    const tti = world.timeToImpact(h);
    if (tti < 0) return;
    const win = world.reflectWindow || COMBAT.perfectWindow;
    const ring = 1 + Math.min(3, tti * 1.6);
    const gold = tti <= win;
    decal(ctx, cam, gold ? S.ringGold : S.ringPink, h.x, 0.6, 2.2, 1);
    if (!gold) decal(ctx, cam, S.ringHollow, h.x, 0.6, 2.2 * ring, 0.9);
    decal(ctx, cam, S.shadow, h.x, h.z, 2, 0.7);
    return;
  }
  if (h.kind === 'high' || h.kind === 'slip' || h.kind === 'spring' || h.draw === 'stretch' || h.draw === 'strip') return;
  decal(ctx, cam, S.shadow, h.x, h.z + 0.6, h.halfW * 2 + 0.6, 0.6);
}

function drawHazard(world, ctx, cam, h) {
  const S = SPRITES;
  const LW = WORLD.laneWidth;
  if (h.behavior === 'drop') {
    if (!h.locked) return;
    const tau = h.z / Math.max(1, world.speedNow);
    const k = Math.min(1, tau / h.appear);
    // 从路边扔过来（猴子香蕉）或从天而降（礼盒 / 招牌）
    const x = h.sideX ? h.x + (h.sideX - h.x) * k : h.x;
    const y = h.sideX ? 3 * 4 * k * (1 - k) + 1.2 * k : h.fallH * k * k;
    billboard(ctx, cam, spriteOf(world, h), x, y, h.z, 1);
    return;
  }
  if (h.behavior === 'lob') {
    const t = Math.min(1, h.t / h.T);
    const x = h.x0 + (h.x1 - h.x0) * t;
    const z = h.z0 + (h.z1 - h.z0) * t;
    const y = h.y0 * (1 - t) + h.arcH * 4 * t * (1 - t);
    billboard(ctx, cam, spriteOf(world, h), x, y, z, 1);
    return;
  }
  if (h.behavior === 'return') {
    const t = Math.min(1, h.t / h.T);
    const x = h.x0 + (h.x1 - h.x0) * t;
    const z = h.z0 + (h.z1 - h.z0) * t;
    const y = h.y0 + (h.y1 - h.y0) * t + 3 * 4 * t * (1 - t);
    billboard(ctx, cam, S[h.sprite + 'Glow'] || spriteOf(world, h), x, y, z, 1);
    if (cam.project(x, y + 0.8, z)) world.particles.spawn(2, cam.px + (Math.random() - 0.5) * 8, cam.py, 0, 10, 0.3, 1, '#fff');
    return;
  }
  // 高低 / 能否通过一目了然的彩色描边（潮汐 / 塌陷坑这类平铺地面的 strip 不描）
  const outline = h.draw === 'strip' ? null : outlineFor(world, h);
  const img = outline ? glowSprite(spriteOf(world, h), outline) : spriteOf(world, h);
  const by = h.bob ? h.bob * (1 + Math.sin(world.time * 3 + h.z * 0.4)) : 0;
  switch (h.draw) {
    case 'train': {
      const gap = h.cfg.carGap;
      const n = Math.max(1, Math.round(h.len / gap));
      for (let i = n - 1; i >= 0; i--) billboard(ctx, cam, img, h.x, 0, h.z + i * gap, 1);
      break;
    }
    case 'center':
      billboard(ctx, cam, img, h.x, by, h.z, 1);
      break;
    case 'strip': {
      // 潮水：沿长度平铺的水面贴花（远 → 近）
      const w = h.halfW * 2 + 0.4;
      const z0 = Math.max(h.z, -1);
      const z1 = Math.min(h.z + h.len, WORLD.spawnZ);
      for (let z = z1 - 1; z >= z0; z -= 2) decal(ctx, cam, img, h.x, z, w, 0.92);
      break;
    }
    case 'stretch': {
      const flutter = Math.sin(world.time * 14 + h.z) * 0.05;
      if (h.kind === 'high') stretched(ctx, cam, img, h.x, h.clearance, h.z, h.halfW * 2 + 0.6, h.top - h.clearance + flutter, 1);
      else stretched(ctx, cam, img, h.x, 0, h.z, h.halfW * 2 + 0.6, h.height + 0.3 + flutter, 1);
      break;
    }
    case 'decal': {
      const w = Math.max(h.halfW * 2 + 0.4, 1);
      decal(ctx, cam, img, h.x, h.z + h.len / 2, w, 1);
      break;
    }
    case 'giant': {
      const tti = world.timeToImpact(h);
      const win = world.reflectWindow || COMBAT.perfectWindow;
      const glow = tti >= 0 && tti <= win;
      const wob = Math.sin(world.time * 20) * 0.08;
      billboard(ctx, cam, glow ? S[h.sprite + 'Glow'] : img, h.x, 0.15 + wob, h.z, 1);
      break;
    }
    default: {
      for (let d = h.deep - 1; d >= 0; d--) {
        for (let l = 0; l < h.lanes; l++) billboard(ctx, cam, img, (h.lane + l) * LW, by, h.z + d * 1.2, 1);
      }
    }
  }
}

function drawBoss(world, ctx, cam, b) {
  const S = SPRITES;
  if (!cam.project(b.x, b.y, b.z)) return;
  const set = b.flash > 0 ? S.bossesFlash[b.sprite] : S.bosses[b.sprite];
  const img = set[b.expr] || set.normal;
  const sc = b.scale;
  const w = Math.round(img.width * sc * b.sx);
  const h = Math.round(img.height * sc * b.sy);
  const x = Math.round(cam.px - w / 2);
  const y = Math.round(cam.py - h);
  ctx.globalAlpha = b.alpha;
  ctx.drawImage(img, x, y, w, h);
  // 眩晕星星
  if (b.stunned) {
    const t = world.time * 5;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3;
      const sx = Math.round(cam.px + Math.cos(a) * 18 * sc);
      const sy = Math.round(y + 4 + Math.sin(a) * 4);
      ctx.drawImage(S.pStar, sx - 2, sy - 2);
    }
  }
  ctx.globalAlpha = 1;
  b.screenX = cam.px;
  b.screenY = y + h * 0.4;
  b.screenTop = y;
}

function drawPlayer(world, ctx, cam, p) {
  const S = SPRITES;
  const s = world.session;
  const boy = s.character === 'boy';
  const set = boy ? S.boy : S.girl;
  const key = p.frameKey();
  // 完美闪避残影
  const ghosts = boy ? S.boyGhost : S.girlGhost;
  for (let i = 0; i < p.ghosts.length; i++) {
    const g = p.ghosts[i];
    if (g.life <= 0) continue;
    if (!cam.project(g.x, g.y, 0)) continue;
    ctx.globalAlpha = (g.life / 0.22) * 0.55;
    ctx.drawImage(ghosts[g.key] || ghosts.run0, Math.round(cam.px - 16), Math.round(cam.py - 31));
  }
  ctx.globalAlpha = 1;
  if (!cam.project(p.x, p.y, 0)) return;
  const px = cam.px;
  const py = cam.py;

  // 守护换人"接力"：被挡的一方向后轻跃离场，守护者滑铲 / 翻转入场
  if (world.swapT < world.swapDur) {
    const k = world.swapT / world.swapDur;
    const outSet = world.swapFrom === 'boy' ? S.boy : S.girl;
    ctx.globalAlpha = 1 - k;
    ctx.drawImage(outSet.jump, Math.round(px - 16 + k * 18), Math.round(py - 31 - k * 22));
    ctx.globalAlpha = 1;
    if (world.swapTo === 'boy') {
      ctx.drawImage(S.boy.slide, Math.round(px - 16 - (1 - k) * 70), Math.round(py - 31));
    } else {
      ctx.drawImage(S.girl.jump, Math.round(px - 16), Math.round(py - 31 - (1 - k) * 46));
    }
    if (k > 0.4 && k < 0.7) ctx.drawImage(S.pStarWhite, Math.round(px - 2), Math.round(py - 26));
    return;
  }

  // 无敌闪烁：半透明脉动（不再整帧消失，手机低帧率下不会"频闪不见"）；技能无敌不闪
  const blinkHide = p.invincible > 0 && !p.dead && p.skillInvT <= 0 && Math.floor(p.invincible * 14) % 2 === 0;
  if (blinkHide) ctx.globalAlpha = 0.45;
  const img = p.flash > 0 ? (boy ? S.boyFlash : S.girlFlash)[key] : set[key];
  const sq = p.squash;
  const w = Math.round((32 * (1 + sq * 0.22)) / 2) * 2;
  const h = Math.round(32 * (1 - sq * 0.22));
  ctx.drawImage(img, Math.round(px - w / 2), Math.round(py - h + 1), w, h);
  if (blinkHide) ctx.globalAlpha = 1;
  // 打滑：头顶冒问号
  if (p.slipTimer > 0) ctx.drawImage(S.pStar, Math.round(px - 2 + Math.sin(world.time * 20) * 4), Math.round(py - 38));
  // 护盾泡泡
  if ((s.shield > 0 || (world.mode === 'boss' && s.bossShield > 0)) && !p.dead) {
    const wob = Math.sin(world.time * 6) * 1.5;
    const bw = 34 + wob;
    ctx.globalAlpha = 0.75;
    ctx.drawImage(S.bubble, Math.round(px - bw / 2), Math.round(py - 16 - bw / 2), Math.round(bw), Math.round(bw));
    ctx.globalAlpha = 1;
  }
  // 磁铁：周围小火花
  if (s.powerups.magnet > 0 && Math.random() < 0.3) {
    world.particles.spawn(0, px + (Math.random() - 0.5) * 30, py - 10 - Math.random() * 20, 0, -8, 0.25, 1, '#ffd23f');
  }
  // 星光礼服：星尘拖尾
  if (s.trail === 'stars' && !p.dead && Math.random() < 0.7) {
    const col = Math.random() < 0.5 ? '#ffe066' : Math.random() < 0.5 ? '#ffffff' : '#b9a6ff';
    world.particles.spawn(Math.random() < 0.4 ? 3 : 0, px + (Math.random() - 0.5) * 12, py - 6 - Math.random() * 18, (Math.random() - 0.5) * 14, 18 + Math.random() * 20, 0.6, 1, col);
  }
}

function drawScreenEffects(world, ctx, W, H) {
  const cam = world.camera;
  // 速度线：高速 / 冲刺 / 子弹时间
  const fast = world.speedNow > JUICE.speedLineMinSpeed;
  if (fast || world.bulletTime > 0) {
    const n = world.bulletTime > 0 ? 14 : Math.min(12, Math.round((world.speedNow - JUICE.speedLineMinSpeed) * 4) + 3);
    ctx.globalAlpha = world.bulletTime > 0 ? 0.55 : 0.35;
    ctx.fillStyle = '#ffffff';
    const seed = Math.floor(world.time * 30);
    for (let i = 0; i < n; i++) {
      const r = hash(seed * 31 + i * 17);
      const a = r * Math.PI * 2;
      const dist = 0.62 + hash(seed * 7 + i * 13) * 0.35;
      const R = Math.max(W, H) * 0.75;
      const x0 = cam.cx + Math.cos(a) * R * dist;
      const y0 = cam.hz + Math.sin(a) * R * dist;
      const len = 10 + hash(i * 3 + seed) * 16;
      const x1 = x0 + Math.cos(a) * len;
      const y1 = y0 + Math.sin(a) * len;
      line(ctx, x0, y0, x1, y1);
    }
    ctx.globalAlpha = 1;
  }

  // 香港关霓虹夜雨（纯视觉）：斜雨丝 + 偶尔的霓虹闪烁
  if (world.rainLevel > 0.02) {
    const rl = world.rainLevel;
    const t = world.time;
    ctx.globalAlpha = 0.1 * rl;
    ctx.fillStyle = '#140a2a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.55 * rl;
    ctx.fillStyle = '#c9d8ff';
    const n = Math.round(46 * rl);
    for (let i = 0; i < n; i++) {
      const sp = 260 + hash(i * 3.1) * 120;
      const x0 = hash(i * 7.3) * (W + 40);
      const y = ((hash(i * 1.7) * (H + 20) + t * sp) % (H + 20)) - 10;
      const x = x0 - (y + 10) * 0.25;
      for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(x - k * 0.25), Math.round(y - k), 1, 1);
    }
    // 落在地上的小水花
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8 * rl; i++) {
      const s = Math.floor(t * 9) * 13 + i * 31;
      ctx.fillRect(Math.round(hash(s) * W), Math.round(cam.hz + 8 + hash(s + 5) * (H - cam.hz - 10)), 2, 1);
    }
    if (hash(Math.floor(t * 10)) > 0.93) {
      ctx.globalAlpha = 0.08 * rl;
      ctx.fillStyle = hash(Math.floor(t * 10) + 3) > 0.5 ? '#ff3d8b' : '#3df2ff';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
  }

  // 子弹时间：冷色调 + 暗角
  if (world.bulletTime > 0) {
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#7fb8ff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  // LOVE FEVER：粉色边缘流光
  if (world.fever) {
    const v = getVignette(world, W, H);
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(world.time * 5);
    ctx.drawImage(v, 0, 0);
    ctx.globalAlpha = 1;
  }

  if (world.rainLevel > 0.02) drawRain(world, ctx, W, H);
  if (world.sandLevel > 0.02) drawSand(world, ctx, W, H);
  // 遗忘之墨：紫黑墨幕 + 边缘晕染（左右颠倒期间）
  if (world.inkLevel > 0.02) drawInk(world, ctx, W, H);
  // 潮汐预警：屏幕两侧泛蓝
  if (world.tideWarn > 0) {
    const a = 0.35 + 0.2 * Math.sin(world.time * 12);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#3d8bff';
    const ew = Math.round(W * 0.07);
    ctx.fillRect(0, 0, ew, H);
    ctx.fillRect(W - ew, 0, ew, H);
    ctx.globalAlpha = a * 0.5;
    ctx.fillRect(ew, 0, ew, H);
    ctx.fillRect(W - ew * 2, 0, ew, H);
    ctx.globalAlpha = 1;
  }

  // 守护换人：一道斜着扫过屏幕的白光（击掌接力）
  if (world.swapT < world.swapDur) {
    const k = world.swapT / world.swapDur;
    const cx = -W * 0.4 + k * W * 1.8;
    const bw = W * 0.22;
    const slant = H * 0.35;
    ctx.globalAlpha = 0.55 * (1 - k * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - bw / 2 + slant, 0);
    ctx.lineTo(cx + bw / 2 + slant, 0);
    ctx.lineTo(cx + bw / 2 - slant, H);
    ctx.lineTo(cx - bw / 2 - slant, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.18 * (1 - k);
    ctx.fillStyle = '#ff6fa5';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  if (world.flashWhite > 0) {
    ctx.globalAlpha = Math.min(0.6, world.flashWhite);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (world.flashRed > 0) {
    ctx.globalAlpha = Math.min(0.45, world.flashRed);
    ctx.fillStyle = '#ff2d55';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  // 守护换人：一道斜向白光扫过屏幕
  if (world.swapT < world.swapDur + 0.12) {
    const k = Math.min(1, world.swapT / (world.swapDur + 0.12));
    const band = W * 0.32;
    const slant = H * 0.5;
    const off = -band - slant + k * (W + band + slant * 2);
    ctx.globalAlpha = 0.75 * (1 - k * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(Math.round(off), H);
    ctx.lineTo(Math.round(off + band), H);
    ctx.lineTo(Math.round(off + band + slant), 0);
    ctx.lineTo(Math.round(off + slant), 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 * (1 - k);
    ctx.fillStyle = '#ffb3cf';
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
    ctx.globalAlpha = 1;
  }
}

function line(ctx, x0, y0, x1, y1) {
  // 像素风直线：沿主轴逐点画 1×1 方块
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + dx * t), Math.round(y0 + dy * t), 1, 1);
  }
}

function hash(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** 遗忘之墨（纯视觉）：紫黑墨幕从两侧晕开 + 缓慢流动的墨丝（左右颠倒期间） */
function drawInk(world, ctx, W, H) {
  const lv = world.inkLevel;
  ctx.globalAlpha = 0.22 * lv;
  ctx.fillStyle = '#241a33';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5 * lv;
  ctx.fillStyle = '#4a3566';
  const t = world.time;
  const n = Math.round(26 * lv);
  for (let i = 0; i < n; i++) {
    const y = hash(i * 5.19) * H;
    const sp = 30 + hash(i * 2.71) * 50;
    const x = (hash(i * 1.13) * W + t * sp) % (W + 8) - 4;
    ctx.fillRect(Math.round(x), Math.round(y), 3 + Math.floor(hash(i * 9.1) * 3), 1);
  }
  ctx.globalAlpha = 0.35 * lv;
  ctx.fillStyle = '#241a33';
  const ew = Math.round(W * 0.16);
  ctx.fillRect(0, 0, ew, H);
  ctx.fillRect(W - ew, 0, ew, H);
  ctx.globalAlpha = 1;
}

/** 蟹老板吐沙暴（纯视觉）：黄褐色尘雾 + 横飞的沙粒 */
function drawSand(world, ctx, W, H) {
  const lv = world.sandLevel;
  ctx.globalAlpha = 0.28 * lv;
  ctx.fillStyle = '#d9b26b';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.6 * lv;
  ctx.fillStyle = '#f2d59a';
  const t = world.time;
  const n = Math.round(70 * lv);
  for (let i = 0; i < n; i++) {
    const y = hash(i * 3.17) * H;
    const sp = 120 + hash(i * 7.7) * 160;
    const x = (hash(i * 1.3) * W + t * sp) % (W + 10) - 5;
    ctx.fillRect(Math.round(x), Math.round(y), 2, 1);
  }
  ctx.globalAlpha = 1;
}

/** 香港关夜雨（纯视觉）：压暗 + 斜雨丝 + 霓虹闪烁 */
function drawRain(world, ctx, W, H) {
  const lv = world.rainLevel;
  ctx.globalAlpha = 0.14 * lv;
  ctx.fillStyle = '#140c2a';
  ctx.fillRect(0, 0, W, H);
  // 霓虹闪烁：每 0.12s 随机一次，偶尔泛起一层粉紫光
  const tick = Math.floor(world.time / 0.12);
  const fl = hash(tick * 3.7);
  if (fl > 0.82) {
    ctx.globalAlpha = 0.07 * lv;
    ctx.fillStyle = fl > 0.92 ? '#3df2ff' : '#ff3d8b';
    ctx.fillRect(0, 0, Math.round(W), Math.round(world.camera.hz));
  }
  ctx.globalAlpha = 0.5 * lv;
  ctx.fillStyle = '#b9c8ff';
  const n = Math.round(46 * lv);
  const t = world.time;
  for (let i = 0; i < n; i++) {
    const sx = hash(i * 7.13) * (W + 40);
    const speed = 260 + hash(i * 3.31) * 120;
    const y = ((hash(i * 1.91) * H + t * speed) % (H + 20)) - 10;
    const x = (sx - y * 0.25 + W) % (W + 40) - 20;
    const len = 5 + Math.floor(hash(i * 5.7) * 4);
    for (let j = 0; j < len; j++) ctx.fillRect(Math.round(x - j * 0.25), Math.round(y - j), 1, 1);
  }
  ctx.globalAlpha = 1;
}

function getVignette(world, W, H) {
  const key = W + 'x' + H;
  if (world.feverVignette && world.feverVignetteKey === key) return world.feverVignette;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, Math.max(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  grad.addColorStop(0, 'rgba(255,111,165,0)');
  grad.addColorStop(1, 'rgba(255,79,154,0.8)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  world.feverVignette = c;
  world.feverVignetteKey = key;
  return c;
}
