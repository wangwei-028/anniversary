import { CAMERA, JUICE } from '../data/constants.js';

/**
 * 伪 3D 透视镜头。
 * 坐标约定（单位：米）：x 向右，y 向上，z 向前（主角脚下 z = 0）。
 * 镜头位于主角身后 back 米、离地 height 米处；焦距 focal。
 * 主角脚底永远固定在画面 feetY 处：镜头抬高 → 地平线上移、看到更多路面（扶梯"镜头抬高"效果）。
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.height = CAMERA.height;
    this.targetHeight = CAMERA.height;
    this.back = CAMERA.back;
    this.focal = CAMERA.focal;
    this.W = 180;
    this.H = 320;
    this.cx = 90;
    this.feetY = 260;
    this.hz = 0;
    // project() 的输出（避免每次返回新对象）
    this.px = 0;
    this.py = 0;
    this.ps = 0;
    // 震动
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.kick = 0; // 冲刺时轻微"推镜"
  }

  setViewport(W, H) {
    this.W = W;
    this.H = H;
    this.cx = W / 2;
    this.feetY = H - CAMERA.feetFromBottom;
    this.updateHorizon();
  }

  updateHorizon() {
    this.hz = this.feetY - (this.height * this.focal) / this.back;
  }

  reset() {
    this.x = 0;
    this.height = CAMERA.height;
    this.targetHeight = CAMERA.height;
    this.shakeMag = 0;
    this.updateHorizon();
  }

  /** dt：游戏时间；targetX：主角 x */
  follow(dt, targetX) {
    const k = 1 - Math.exp(-CAMERA.followSpeed * dt);
    this.x += (targetX * CAMERA.followX - this.x) * k;
    const kh = 1 - Math.exp(-CAMERA.heightLerp * dt);
    this.height += (this.targetHeight - this.height) * kh;
    this.updateHorizon();
  }

  /** 震动更新用真实时间（顿帧时也要震） */
  updateShake(dtReal) {
    if (this.shakeMag > 0.05) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeMag;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeMag;
      this.shakeMag *= Math.exp(-JUICE.shakeDecay * dtReal);
    } else {
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  shake(mag) {
    if (mag > this.shakeMag) this.shakeMag = mag;
  }

  /** 投影：成功返回 true，结果在 this.px / this.py（屏幕坐标）/ this.ps（每米像素数） */
  project(x, y, z) {
    const dz = z + this.back;
    if (dz < 0.6) return false;
    const s = this.focal / dz;
    this.ps = s;
    this.px = this.cx + (x - this.x) * s;
    this.py = this.hz + (this.height - y) * s;
    return true;
  }
}
