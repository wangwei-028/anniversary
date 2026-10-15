import { el, append, button, clear } from '../systems/ui.js';
import { TEXTS } from '../data/texts.js';
import { UPGRADES, ITEMS, PARTNER, upgradePrice } from '../data/shop.js';
import { SKINS } from '../data/skins.js';
import { buyUpgrade, buyItem, buyPartner, buySkin, equipSkin, skinStatus } from '../systems/economy.js';
import { SPRITES, applySkin, skinPreview } from '../systems/sprites.js';
import { PK, CONFETTI_COLORS } from '../systems/particles.js';

/**
 * 商店（8.2）：A 能力加点 / B 出战道具 / D 伙伴能力（男友酱）。皮肤 C 在 M3。
 * 金币来自每一局（失败也全额入账）→ 在这里变强 → 回去打新关。
 */
export class ShopScene {
  constructor(game) {
    this.game = game;
    this.tab = 'upgrades';
    this.t = 0;
  }

  enter() {
    const g = this.game;
    g.world.hidePlayer = false;
    g.world.targetSpeed = 4;
    g.audio.playMusic('title');
    this.t = 0;
    const root = el('div', 'scene-root');
    root.appendChild(el('div', 'dim'));
    const header = el('div', 'select-header', TEXTS.shop);
    header.style.position = 'relative';
    this.coinsEl = el('span', 'select-coins', '');
    const stats = el('div', 'select-stats');
    stats.appendChild(this.coinsEl);
    const tabs = el('div', 'select-tabs');
    this.tabBtns = {};
    for (const [id, label] of [
      ['upgrades', '能力加点'],
      ['items', '出战道具'],
      ['partner', '男友酱'],
      ['skins', '皮肤'],
    ]) {
      const b = button(g, label, 'small chip' + (this.tab === id ? ' on' : ''), () => {
        this.tab = id;
        for (const k of Object.keys(this.tabBtns)) this.tabBtns[k].classList.toggle('on', k === id);
        this.renderList();
      });
      this.tabBtns[id] = b;
      tabs.appendChild(b);
    }
    this.list = el('div', 'level-list shop-list');
    this.list.style.position = 'relative';
    this.toast = el('div', 'shop-toast', '');
    this.toastT = 0;

    const back = el('button', 'icon-btn', '←');
    back.type = 'button';
    back.style.top = 'calc(var(--px) * 4)';
    back.style.left = 'calc(var(--px) * 4)';
    back.setAttribute('aria-label', TEXTS.back);
    back.addEventListener('click', () => {
      g.audio.play('click');
      g.switchScene('select');
    });
    append(root, header, stats, tabs, this.list, this.toast, back);
    g.ui.appendChild(root);
    this.renderList();
  }

  renderList() {
    const g = this.game;
    const save = g.save;
    this.coinsEl.textContent = TEXTS.coinsLabel + ' ' + save.data.coins;
    clear(this.list);
    if (this.tab === 'upgrades') {
      for (const u of UPGRADES) {
        const lvl = save.upgradeLevel(u.id);
        const max = lvl >= u.max;
        const locked = u.requires === 'partner' && !save.data.partner.unlocked;
        const price = upgradePrice(u, lvl);
        const pips = el('div', 'pips');
        for (let i = 0; i < u.max; i++) pips.appendChild(el('span', i < lvl ? 'pip on' : 'pip'));
        const label = max ? '满级' : locked ? '需男友酱' : price + ' 金币';
        this.list.appendChild(this.row(u.name, u.desc, pips, label, max || locked, save.data.coins < price, () => this.result(buyUpgrade(save, u.id))));
      }
    } else if (this.tab === 'items') {
      for (const it of ITEMS) {
        const n = save.itemCount(it.id);
        const own = el('div', 'pips', '库存 ' + n);
        this.list.appendChild(this.row(it.name, it.desc + ' · 进关前在准备页勾选（最多 2 个）', own, it.price + ' 金币', false, save.data.coins < it.price, () => this.result(buyItem(save, it.id))));
      }
    } else if (this.tab === 'skins') {
      for (const sk of SKINS) {
        const st = skinStatus(save, sk);
        const equipped = save.data.skins.equipped === sk.id;
        const pv = skinPreview(sk.id);
        const icon = el('canvas', 'skin-preview');
        icon.width = 64;
        icon.height = 32;
        const ctx = icon.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pv.girl, 0, 0, 32, 32);
        ctx.drawImage(pv.boy, 32, 0, 32, 32);
        const desc = sk.desc + ' · 加成：' + sk.bonus + (st.lockText ? ' · ' + st.lockText : '');
        let label;
        let disabled = false;
        let onClick;
        if (equipped) {
          label = '穿着中 ♥';
          disabled = true;
        } else if (st.owned) {
          label = '换上';
          onClick = () => {
            equipSkin(save, sk.id);
            applySkin(sk.id);
            this.result({ ok: true, msg: '换上「' + sk.name + '」啦！' });
          };
        } else if (st.canBuy) {
          label = sk.price + ' 金币';
          onClick = () => {
            const res = buySkin(save, sk);
            if (res.ok) applySkin(sk.id);
            this.result(res);
          };
        } else {
          label = '未解锁';
          disabled = true;
        }
        this.list.appendChild(this.row(sk.name, desc, icon, label, disabled, st.canBuy && save.data.coins < sk.price, onClick || (() => {})));
      }
    } else {
      const has = save.data.partner.unlocked;
      const icon = el('canvas', 'shop-boy');
      icon.width = 64;
      icon.height = 64;
      const ctx = icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(SPRITES.boyFront.wave0, 0, 0);
      this.boyCtx = ctx;
      const desc =
        '守护换人：受击时（没有护盾的情况下）男友酱自动换上来挡下这次伤害，两人击掌接力。' +
        '冷却 ' + PARTNER.cdRun + ' 秒（守护羁绊每级 -' + PARTNER.cdPerBond + ' 秒，最低 ' + PARTNER.cdMin + ' 秒）；Boss 战 LOVE FEVER 期间冷却减半。' +
        '男友酱在场时完美闪避判定 +0.02 秒。';
      const card = this.row('男友酱', desc, icon, has ? '已在身边 ♥' : PARTNER.price + ' 金币', has, save.data.coins < PARTNER.price, () => this.result(buyPartner(save)));
      card.classList.add('partner');
      this.list.appendChild(card);
      if (has) this.list.appendChild(el('div', 'memo shop-note', '在「能力加点」里升级「守护羁绊」可以缩短冷却。'));
    }
  }

  row(name, desc, extra, priceLabel, disabled, poor, onBuy) {
    const g = this.game;
    const card = el('div', 'level-card shop-card');
    const info = el('div', 'info');
    append(info, el('div', 'name', name), el('div', 'memo', desc), extra);
    const b = button(g, priceLabel, 'small' + (poor && !disabled ? ' ghost' : ''), onBuy);
    if (disabled) b.disabled = true;
    append(card, info, b);
    return card;
  }

  result(res) {
    const g = this.game;
    this.toast.textContent = res.msg;
    this.toast.classList.toggle('bad', !res.ok);
    this.toast.classList.add('show');
    this.toastT = 2.2;
    if (res.ok) {
      g.audio.play('shieldGet');
      g.world.particles.burst(PK.CONFETTI, g.world.camera.cx, g.world.camera.H * 0.4, 16, 90, 0.8, CONFETTI_COLORS, 60);
    } else g.audio.play('bump');
    const scroll = this.list.scrollTop;
    this.renderList();
    this.list.scrollTop = scroll;
  }

  exit() {
    this.boyCtx = null;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    g.world.updateDemo(dt);
    while (g.input.next() !== null) {
      /* 商店不处理游戏动作 */
    }
    g.input.consumeConfirm();
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toast.classList.remove('show');
    }
  }

  render() {
    const g = this.game;
    g.world.render(g.screen);
    g.screen.present(0, 0);
    g.screen.endFrame();
    if (this.boyCtx) {
      const F = SPRITES.boyFront;
      this.boyCtx.clearRect(0, 0, 64, 64);
      this.boyCtx.drawImage(Math.floor(this.t * 2) & 1 ? F.idle1 : F.wave0, 0, 0);
    }
  }
}
