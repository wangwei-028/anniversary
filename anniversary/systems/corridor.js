import { WORLD } from '../data/constants.js';
import { packColor, mixHex } from './pixel.js';

/**
 * 商场走廊渲染器（逐像素伪 3D）：
 * - 地面 / 天花板：Mode-7 式按行透视，地砖、车道虚线、天窗灯带随前进距离滚动 → 强烈的速度感
 * - 两侧墙面：按列求交（类似 Wolfenstein），贴店铺立面贴图（招牌写着 config 里的梗店名）
 * - 远处雾化：10 级雾 + 4×4 Bayer 抖动，像素风过渡
 * - 扶梯区段：地面变成金属台阶 + 扶手
 * - Boss 战车道警示：整条车道在障碍压到前最后一刻泛红常亮
 * 每帧只写一次 ImageData（Uint32 直写），不产生垃圾。
 */
const FOG_LEVELS = 10;
const LMAX = FOG_LEVELS - 1;
const BAYER = new Float32Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16));

const PAL_KEYS = ['tileA', 'tileB', 'divider', 'trim', 'side', 'sideGrid', 'escA', 'escB', 'escEdge', 'rail', 'warnA', 'warnB', 'ceil', 'ceilLight', 'sky', 'skyFrame', 'fog'];
const PAL_N = PAL_KEYS.length;
const TILE_A = 0;
const TILE_B = 1;
const DIVIDER = 2;
const TRIM = 3;
const SIDE = 4;
const SIDE_GRID = 5;
const ESC_A = 6;
const ESC_B = 7;
const ESC_EDGE = 8;
const RAIL = 9;
const WARN_A = 10;
const WARN_B = 11;
const CEIL = 12;
const CEIL_LIGHT = 13;
const SKY = 14;
const SKY_FRAME = 15;

const WALL_PERIOD = 12; // 一段店铺墙 12 米

export class CorridorRenderer {
  constructor() {
    this.W = 0;
    this.H = 0;
    this.img = null;
    this.pix = null;
    this.pal = new Uint32Array(PAL_N * FOG_LEVELS);
    this.tex = [];
    this.texW = 128;
    this.texH = 96;
    this.nTex = 0;
    this.colK = null;
    this.colFogW = null;
    this.colU = null;
    this.colTex = null;
    this.colVA = null;
    this.colVB = null;
    this.ceiling = true;
    this.wallH = WORLD.ceilingHeight;
    this.floorStyle = 0;
    this.sky = null;
    this.skyW = 256;
    this.skyH = 128;
  }

  /**
   * 切换关卡：生成带雾的调色板与墙面贴图。
   * env：{ ceiling 是否有天花板, wallHeight 墙高, floor 'tiles'|'path'|'asphalt' }
   * assets：{ walls: [canvas], sky: canvas|null }（墙面透明像素 = 露出天空）
   */
  setLevel(palette, assets, env) {
    const fog = palette.fog;
    this.ceiling = env.ceiling !== false;
    this.wallH = env.wallHeight || WORLD.ceilingHeight;
    this.floorStyle = env.floor === 'path' ? 1 : env.floor === 'asphalt' ? 2 : 0;
    for (let l = 0; l < FOG_LEVELS; l++) {
      const t = l / LMAX;
      for (let i = 0; i < PAL_N; i++) {
        this.pal[l * PAL_N + i] = packColor(mixHex(palette[PAL_KEYS[i]] || fog, fog, t));
      }
    }
    const fr = parseInt(fog.slice(1, 3), 16);
    const fg = parseInt(fog.slice(3, 5), 16);
    const fb = parseInt(fog.slice(5, 7), 16);
    this.tex = [];
    for (const c of assets.walls) {
      const w = c.width;
      const h = c.height;
      this.texW = w;
      this.texH = h;
      const data = c.getContext('2d').getImageData(0, 0, w, h).data;
      const size = w * h;
      const out = new Uint32Array(size * FOG_LEVELS);
      for (let l = 0; l < FOG_LEVELS; l++) {
        const t = l / LMAX;
        for (let i = 0; i < size; i++) {
          if (data[i * 4 + 3] < 128) continue; // 透明 = 0，渲染时露出天空
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          const rr = (r + (fr - r) * t) | 0;
          const gg = (g + (fg - g) * t) | 0;
          const bb = (b + (fb - b) * t) | 0;
          out[l * size + i] = ((255 << 24) | (bb << 16) | (gg << 8) | rr) >>> 0;
        }
      }
      this.tex.push(out);
    }
    this.nTex = this.tex.length;
    this.sky = null;
    if (assets.sky) {
      const c = assets.sky;
      this.skyW = c.width;
      this.skyH = c.height;
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      this.sky = new Uint32Array(data.buffer.slice(0));
    }
  }

  ensure(bctx, W, H) {
    if (this.W === W && this.H === H && this.img) return;
    this.W = W;
    this.H = H;
    this.img = bctx.createImageData(W, H);
    this.pix = new Uint32Array(this.img.data.buffer);
    this.colK = new Float32Array(W);
    this.colFogW = new Float32Array(W);
    this.colU = new Int32Array(W);
    this.colTex = new Int32Array(W);
    this.colVA = new Float32Array(W);
    this.colVB = new Float32Array(W);
  }

  /**
   * @param zones 扶梯区段数组 [{active, start, end, kind(1上/2下)}]（世界绝对距离）
   * @param laneWarn 长度 3 的数组，>0 表示该车道警示中
   */
  render(bctx, cam, trackPos, time, zones, laneWarn) {
    const W = this.W;
    const H = this.H;
    const pix = this.pix;
    const pal = this.pal;
    const F = cam.focal;
    const camH = cam.height;
    const camX = cam.x;
    const back = cam.back;
    const hz = cam.hz;
    const cx = cam.cx;
    const Xw = WORLD.wallX;
    const ceilH = WORLD.ceilingHeight;
    const wallH = this.wallH;
    const hasCeil = this.ceiling;
    const style = this.floorStyle;
    const sky = this.sky;
    const skyW = this.skyW;
    const skyH = this.skyH;
    const skyShift = Math.floor(camX * 6 + time * 2);
    const roadHalf = WORLD.roadHalfWidth;
    const laneHalf = WORLD.laneWidth / 2;
    const fogStart = WORLD.fogStart;
    const fogSpan = WORLD.fogEnd - fogStart;
    const texW = this.texW;
    const texH = this.texH;
    const texSize = texW * texH;
    const nTex = this.nTex;
    const tex = this.tex;
    const colK = this.colK;
    const colFogW = this.colFogW;
    const colU = this.colU;
    const colTex = this.colTex;
    const colVA = this.colVA;
    const colVB = this.colVB;
    // 车道警戒与障碍物同进同出：障碍物出现在路上 → 该道红线亮起，一直亮到它压过去。
    // 各攻击在"障碍物生成"那一刻写入飞行时长（见 bossAttacks / bossDirector），这里只管亮。
    const w0 = laneWarn[0] > 0;
    const w1 = laneWarn[1] > 0;
    const w2 = laneWarn[2] > 0;
    const anyWarn = w0 || w1 || w2;

    // ---- 每列：墙面求交 ----
    for (let x = 0; x < W; x++) {
      const k = (x + 0.5 - cx) / F;
      colK[x] = k;
      let dzw = 1e6;
      if (k > 1e-6) dzw = (Xw - camX) / k;
      else if (k < -1e-6) dzw = (-Xw - camX) / k;
      if (dzw > 1e6 || dzw < 0) dzw = 1e6;
      let f = (dzw - fogStart) / fogSpan;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      colFogW[x] = f * LMAX;
      const wz = trackPos + dzw - back;
      const seg = Math.floor(wz / WALL_PERIOD);
      let u = (wz - seg * WALL_PERIOD) / WALL_PERIOD;
      if (k > 0) u = 1 - u; // 右墙镜像，让招牌字正着读
      let ui = (u * texW) | 0;
      colU[x] = ui < 0 ? 0 : ui >= texW ? texW - 1 : ui;
      colTex[x] = nTex ? ((seg % nTex) + nTex) % nTex : 0;
      const kk = (dzw / F) * (texH / wallH);
      colVA[x] = ((wallH - camH) * texH) / wallH + (0.5 - hz) * kk;
      colVB[x] = kk;
    }

    let p = 0;
    for (let y = 0; y < H; y++) {
      let dy = y + 0.5 - hz;
      const by = (y & 3) << 2;
      const isFloor = dy >= 0;
      // 天空贴图：底边对齐地平线
      let skyRow = skyH - 1 - Math.floor(hz - y);
      skyRow = skyRow < 0 ? 0 : skyRow >= skyH ? skyH - 1 : skyRow;
      const skyBase = skyRow * skyW;

      if (!isFloor && !hasCeil) {
        // 露天关卡：地平线以上只有墙（树 / 楼）和天空
        for (let x = 0; x < W; x++, p++) {
          const v = (colVA[x] + y * colVB[x]) | 0;
          if (v >= 0 && v < texH) {
            let wl = (colFogW[x] + BAYER[by + (x & 3)]) | 0;
            if (wl > LMAX) wl = LMAX;
            const c = tex[colTex[x]][wl * texSize + v * texW + colU[x]];
            if (c) {
              pix[p] = c;
              continue;
            }
          }
          pix[p] = sky[skyBase + ((x + skyShift) & (skyW - 1))];
        }
        continue;
      }

      let dz;
      if (isFloor) {
        if (dy < 0.25) dy = 0.25;
        dz = (camH * F) / dy;
      } else {
        if (dy > -0.25) dy = -0.25;
        dz = ((ceilH - camH) * F) / -dy;
      }
      let f = (dz - fogStart) / fogSpan;
      f = f < 0 ? 0 : f > 1 ? 1 : f;
      const fl = f * LMAX;
      const wz = trackPos + dz - back;

      // 本行的地面 / 天花板特征
      let tile = 0;
      let dash = false;
      let sideRow = false;
      let esc = 0;
      let escIdx = 0;
      let lightRow = false;
      let frameRow = false;
      let rowHash = 0;
      if (isFloor) {
        if (style === 1) {
          tile = Math.floor(wz / 1.2) & 1;
          dash = wz - Math.floor(wz / 3) * 3 < 1.4;
          sideRow = (Math.floor(wz / 3) & 1) === 1;
        } else if (style === 2) {
          dash = wz - Math.floor(wz / 6) * 6 < 3;
          sideRow = wz - Math.floor(wz / 1.6) * 1.6 < 0.12;
          rowHash = Math.floor(wz * 3);
        } else {
          tile = Math.floor(wz / 2) & 1;
          dash = wz - Math.floor(wz / 4.8) * 4.8 < 2.6;
          sideRow = wz - Math.floor(wz / 3) * 3 < 0.16;
        }
        for (let i = 0; i < zones.length; i++) {
          const zn = zones[i];
          if (zn.active && wz >= zn.start && wz < zn.end) {
            esc = zn.kind;
            break;
          }
        }
        if (esc === 3) {
          // 弹床区：静止的蓝黄条纹
          const step = Math.floor(wz / 1.2);
          escIdx = wz - step * 1.2 < 0.12 ? ESC_EDGE : step & 1 ? ESC_A : ESC_B;
        } else if (esc === 4) {
          // 回忆走廊：红地毯
          escIdx = ESC_A;
        } else if (esc) {
          const ew = wz + (esc === 1 ? -time * 1.6 : time * 1.6);
          const step = Math.floor(ew / 0.55);
          escIdx = ew - step * 0.55 < 0.09 ? ESC_EDGE : step & 1 ? ESC_A : ESC_B;
        }
      } else {
        lightRow = wz - Math.floor(wz / 6) * 6 < 0.7;
        frameRow = wz - Math.floor(wz / 4) * 4 < 0.35;
      }

      for (let x = 0; x < W; x++, p++) {
        const wx = camX + colK[x] * dz;
        const bayer = BAYER[by + (x & 3)];
        if (wx > Xw || wx < -Xw) {
          // 墙面（超出墙顶 / 透明处露出天空）
          let v = (colVA[x] + y * colVB[x]) | 0;
          if (hasCeil) v = v < 0 ? 0 : v >= texH ? texH - 1 : v;
          else if (v >= texH) v = texH - 1;
          if (v >= 0) {
            let wl = (colFogW[x] + bayer) | 0;
            if (wl > LMAX) wl = LMAX;
            const c = tex[colTex[x]][wl * texSize + v * texW + colU[x]];
            if (c || hasCeil) {
              pix[p] = c;
              continue;
            }
          }
          pix[p] = sky[skyBase + ((x + skyShift) & (skyW - 1))];
          continue;
        }
        let lvl = (fl + bayer) | 0;
        if (lvl > LMAX) lvl = LMAX;
        const ax = wx < 0 ? -wx : wx;
        let idx;
        if (isFloor) {
          if (ax < roadHalf) {
            const lane = wx < -laneHalf ? 0 : wx > laneHalf ? 2 : 1;
            if (esc) {
              idx = ax > roadHalf - 0.3 ? RAIL : escIdx;
            } else {
              const d = ax - laneHalf;
              if (dash && d < 0.08 && d > -0.08) idx = DIVIDER;
              else if (style === 2) {
                // 柏油路：稀疏的亮点颗粒
                const hsh = (rowHash * 73856093) ^ (Math.floor(wx * 3) * 19349663);
                idx = (hsh & 15) === 0 ? TILE_B : TILE_A;
              } else if (style === 1) {
                idx = tile ^ (Math.floor((wx + 3.6) / 0.8) & 1) ? TILE_B : TILE_A;
              } else idx = tile ^ (lane & 1) ? TILE_B : TILE_A;
            }
            if (anyWarn && idx !== DIVIDER && idx !== RAIL) {
              if ((lane === 0 && w0) || (lane === 1 && w1) || (lane === 2 && w2)) {
                idx = idx === TILE_B || idx === ESC_B ? WARN_B : WARN_A;
              }
            }
          } else if (ax < roadHalf + 0.22) {
            idx = TRIM;
          } else if (style === 1) {
            idx = sideRow ? SIDE_GRID : SIDE;
          } else {
            const gm = ax - Math.floor(ax / (style === 2 ? 1.6 : 3)) * (style === 2 ? 1.6 : 3);
            idx = sideRow || gm < 0.12 ? SIDE_GRID : SIDE;
          }
        } else {
          if (ax < 2) idx = frameRow || ax > 1.8 ? SKY_FRAME : SKY;
          else idx = lightRow || (ax > 4.4 && ax < 4.7) ? CEIL_LIGHT : CEIL;
        }
        pix[p] = pal[lvl * PAL_N + idx];
      }
    }
    bctx.putImageData(this.img, 0, 0);
  }
}
