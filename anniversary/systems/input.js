import { TOUCH } from '../data/constants.js';

/**
 * 输入系统：把键盘 / 触摸 / 鼠标统一成"动作"，放进一个固定大小的环形队列。
 * 动作：left right up down counter skill pause
 * - 触摸滑动：超过阈值立即触发（不用等松手）；一次按住只触发一个动作，想再来一次要抬手重滑
 * - 点击（短按且几乎没移动）：counter（反击）
 * - 双击（两次点击间隔 ≤ TOUCH.doubleTapTime）：skill（释放技能，第一击照常作为 counter）
 * - 输入缓冲（提前按下、稍后执行）在 entities/player.js 里实现
 */
export const ACTION = {
  LEFT: 'left',
  RIGHT: 'right',
  UP: 'up',
  DOWN: 'down',
  COUNTER: 'counter',
  SKILL: 'skill',
  PAUSE: 'pause',
};

const KEY_MAP = {
  ArrowLeft: ACTION.LEFT,
  KeyA: ACTION.LEFT,
  ArrowRight: ACTION.RIGHT,
  KeyD: ACTION.RIGHT,
  ArrowUp: ACTION.UP,
  KeyW: ACTION.UP,
  Space: ACTION.UP,
  ArrowDown: ACTION.DOWN,
  KeyS: ACTION.DOWN,
  KeyJ: ACTION.COUNTER,
  KeyL: ACTION.SKILL,
  Escape: ACTION.PAUSE,
  KeyP: ACTION.PAUSE,
};

const QUEUE_SIZE = 16;

export class Input {
  constructor(touchTarget) {
    this.queueAction = new Array(QUEUE_SIZE).fill(null);
    this.queueTime = new Float64Array(QUEUE_SIZE);
    this.head = 0;
    this.count = 0;
    this.lastTime = 0;
    this.lastTapTime = -9; // 上一次点击（tap）的时间，用于双击 → 技能判定
    this.confirmPressed = false; // 菜单用：Enter / 空格
    this.anyPressed = false; // 菜单用：任意键 / 点击
    this.debugHandler = null; // 调试快捷键回调
    this.gestureEnabled = true;

    // 当前触点
    this.pointerId = -1;
    this.startX = 0;
    this.startY = 0;
    this.originX = 0;
    this.originY = 0;
    this.startTime = 0;
    this.fired = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    touchTarget.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e, true));
    // 禁止长按菜单、双指缩放、iOS 回弹
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener(
      'touchmove',
      (e) => {
        if (!e.target.closest || !e.target.closest('.level-list, .prep, .theater-letter, .result-panel, .scrollable')) e.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener('dblclick', (e) => e.preventDefault());
  }

  push(action) {
    const now = performance.now() / 1000;
    if (this.count === QUEUE_SIZE) {
      // 满了就丢掉最旧的
      this.head = (this.head + 1) % QUEUE_SIZE;
      this.count--;
    }
    const idx = (this.head + this.count) % QUEUE_SIZE;
    this.queueAction[idx] = action;
    this.queueTime[idx] = now;
    this.count++;
  }

  /** 取出下一个动作（没有则返回 null），对应的按下时间放在 this.lastTime */
  next() {
    if (this.count === 0) return null;
    const a = this.queueAction[this.head];
    this.lastTime = this.queueTime[this.head];
    this.head = (this.head + 1) % QUEUE_SIZE;
    this.count--;
    return a;
  }

  clear() {
    this.count = 0;
    this.confirmPressed = false;
    this.anyPressed = false;
  }

  consumeConfirm() {
    const v = this.confirmPressed;
    this.confirmPressed = false;
    return v;
  }

  consumeAny() {
    const v = this.anyPressed;
    this.anyPressed = false;
    return v;
  }

  onKeyDown(e) {
    const tag = e.target && e.target.tagName;
    const action = KEY_MAP[e.code];
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      this.confirmPressed = true;
    }
    if (!e.repeat) this.anyPressed = true;
    if (this.debugHandler && !e.repeat) this.debugHandler(e.code);
    if (!action) return;
    // 方向键 / 空格不要滚动页面，也不要触发聚焦按钮的点击
    e.preventDefault();
    if (tag === 'BUTTON' && e.target.blur) e.target.blur();
    if (e.repeat) return;
    this.push(action);
  }

  onPointerDown(e) {
    this.anyPressed = true;
    if (this.pointerId !== -1) return;
    this.pointerId = e.pointerId;
    this.startX = this.originX = e.clientX;
    this.startY = this.originY = e.clientY;
    this.startTime = performance.now() / 1000;
    this.fired = false;
  }

  onPointerMove(e) {
    if (e.pointerId !== this.pointerId || !this.gestureEnabled) return;
    // 一次按住只允许滑出一个动作：不管行程多长，都不重复触发（否则快甩一次会连移两格）
    if (this.fired) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    const th = TOUCH.swipeThreshold;
    if (dx * dx + dy * dy < th * th) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.push(dx > 0 ? ACTION.RIGHT : ACTION.LEFT);
    } else {
      this.push(dy > 0 ? ACTION.DOWN : ACTION.UP);
    }
    this.fired = true;
  }

  onPointerUp(e, cancelled) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = -1;
    if (cancelled || this.fired || !this.gestureEnabled) return;
    const dt = performance.now() / 1000 - this.startTime;
    const dx = e.clientX - this.originX;
    const dy = e.clientY - this.originY;
    if (dt <= TOUCH.tapMaxTime && dx * dx + dy * dy <= TOUCH.tapMaxMove * TOUCH.tapMaxMove) {
      // 双击 → 技能；第一击已经作为 counter 入队（没有反击上下文时它是空操作，不影响手感）
      const now = performance.now() / 1000;
      if (now - this.lastTapTime <= TOUCH.doubleTapTime) {
        this.lastTapTime = -9;
        this.push(ACTION.SKILL);
        return;
      }
      this.lastTapTime = now;
      this.push(ACTION.COUNTER);
    }
  }
}
