/**
 * 对象池：预先创建固定数量的对象，用 active 标记是否在用。
 * 局内的障碍、弹幕、金币、粒子全部从池里取，避免每帧产生垃圾、触发 GC 卡顿。
 * 用法：
 *   const pool = new Pool(() => ({ x: 0 }), 64);
 *   const o = pool.obtain();   // 拿一个（active = true）
 *   o.active = false;          // 用完直接置 false 即可归还
 *   for (const o of pool.items) if (o.active) ...
 */
export class Pool {
  constructor(factory, capacity) {
    this.factory = factory;
    this.items = [];
    this.cursor = 0;
    for (let i = 0; i < capacity; i++) {
      const o = factory();
      o.active = false;
      this.items.push(o);
    }
  }

  obtain() {
    const items = this.items;
    const n = items.length;
    for (let k = 0; k < n; k++) {
      const i = (this.cursor + k) % n;
      if (!items[i].active) {
        this.cursor = (i + 1) % n;
        items[i].active = true;
        return items[i];
      }
    }
    // 池满：扩容（只会在极端情况下发生，正常数值下不会走到这里）
    const o = this.factory();
    o.active = true;
    items.push(o);
    return o;
  }

  releaseAll() {
    for (let i = 0; i < this.items.length; i++) this.items[i].active = false;
  }

  countActive() {
    let c = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].active) c++;
    return c;
  }
}
