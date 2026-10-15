import { Screen } from './systems/screen.js';
import { Input } from './systems/input.js';
import { AudioSystem } from './systems/audio.js';
import { SaveSystem } from './systems/save.js';
import { buildCommonSprites, buildMallSprites, applySkin, applyCoinMark, SPRITES } from './systems/sprites.js';
import { buildZooSprites } from './systems/spritesZoo.js';
import { buildHkSprites } from './systems/spritesHk.js';
import { buildParkSprites } from './systems/spritesPark.js';
import { buildMarketSprites } from './systems/spritesMarket.js';
import { buildBeachSprites } from './systems/spritesBeach.js';
import { buildHomeSprites } from './systems/spritesHome.js';
import { World } from './systems/world.js';
import { getLevel } from './data/levels.js';
import { getItem } from './data/shop.js';
import { ECONOMY } from './data/economy.js';
import { CONFIG } from './config.js';
import { TitleScene } from './scenes/TitleScene.js';
import { MapSelectScene } from './scenes/MapSelectScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { GalleryScene } from './scenes/GalleryScene.js';
import { RunScene } from './scenes/RunScene.js';
import { BossScene } from './scenes/BossScene.js';
import { ResultScene } from './scenes/ResultScene.js';
import { EndlessScene } from './scenes/EndlessScene.js';
import { BossRushScene } from './scenes/BossRushScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { TheaterScene } from './scenes/TheaterScene.js';
import { StarryScene } from './scenes/StarryScene.js';
import { clear } from './systems/ui.js';

/**
 * 入口：创建各系统、生成像素素材、管理场景切换与主循环。
 * 场景：title 标题 → select 选关（→ shop 商店 / gallery 图鉴）→ run 跑酷段 → boss Boss 战 → result 结算
 *       第 7 关通关 → ending 回家演出 → result → theater 回忆放映厅
 *       endless 无尽模式 / rush Boss Rush「回忆风暴」→ starry 群星之夜
 * 调试：网址后加 ?debug=1 → 显示 FPS 等信息，并启用快捷键（见 README）
 */
class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ui = document.getElementById('ui');
    this.screen = new Screen(this.canvas, this.ui);
    this.input = new Input(this.canvas);
    this.audio = new AudioSystem();
    this.save = new SaveSystem(CONFIG.devMode);
    this.audio.setMuted(!!this.save.data.settings.muted);
    this.debug = /[?&]debug(=|&|$)/.test(location.search);

    buildCommonSprites();
    buildMallSprites(CONFIG.memes.shopNames);
    buildZooSprites(getLevel(2), CONFIG.memes.zooSigns);
    buildHkSprites(getLevel(3), CONFIG.memes.hkSigns);
    buildParkSprites(getLevel(4), CONFIG.memes.parkSigns);
    buildMarketSprites(getLevel(5), CONFIG.memes.marketSigns);
    buildBeachSprites(getLevel(6));
    buildHomeSprites(getLevel(7), CONFIG.photos);
    applySkin(this.save.data.skins.equipped);
    applyCoinMark(CONFIG.coinMark);
    this.world = new World(this);
    this.useLevel(1);

    this.scenes = {
      title: new TitleScene(this),
      select: new MapSelectScene(this),
      shop: new ShopScene(this),
      gallery: new GalleryScene(this),
      run: new RunScene(this),
      boss: new BossScene(this),
      result: new ResultScene(this),
      endless: new EndlessScene(this),
      rush: new BossRushScene(this),
      ending: new EndingScene(this),
      theater: new TheaterScene(this),
      starry: new StarryScene(this),
    };
    this.scene = null;
    this.sceneName = '';

    // 浏览器要求用户交互后才能播放声音（iOS 需要 touchend / click 才算有效手势）
    const unlock = () => {
      if (!(this.scene && this.scene.paused)) this.audio.unlock();
    };
    for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, unlock);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.scene && this.scene.onHidden) this.scene.onHidden();
        this.audio.suspend();
      } else if (!(this.scene && this.scene.paused)) {
        this.audio.resume();
      }
    });
    // 局内直接关掉页面：本局金币 / 照片照样入账（bfcache 暂存的页面还会回来，不结算）
    window.addEventListener('pagehide', (e) => {
      if (!e.persisted && this.scene && this.scene.bankCoins) this.scene.bankCoins();
    });

    if (this.debug) {
      this.input.debugHandler = (code) => this.onDebugKey(code);
      window.__game = this;
    }

    this.fps = 60;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.switchScene('title');
    requestAnimationFrame(this.frame);
  }

  switchScene(name, params) {
    if (this.scene && this.scene.exit) this.scene.exit();
    clear(this.ui);
    this.input.clear();
    this.scene = this.scenes[name];
    this.sceneName = name;
    this.scene.enter(params || {});
  }

  setMuted(m) {
    this.audio.setMuted(m);
    this.save.data.settings.muted = m;
    this.save.save();
  }

  /** 切换世界的关卡素材（调色板 / 墙面 / 天空 / 地面样式），同一关不重复处理 */
  useLevel(id) {
    const level = getLevel(id);
    if (!level || !level.available) return;
    if (this.world.level === level) return;
    this.world.setLevel(level, SPRITES.levelAssets[id]);
  }

  /** 出战道具名称 */
  itemName(id) {
    const it = getItem(id);
    return it ? it.name : id;
  }

  frame(t) {
    requestAnimationFrame(this.frame);
    let dt = (t - this.last) / 1000;
    this.last = t;
    if (!(dt > 0)) dt = 0;
    // 卡顿超过 50ms 时宁可放慢，也不让物体"瞬移"穿过主角（公平第一）
    if (dt > 0.05) dt = 0.05;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    this.audio.update();
    let rem = dt;
    while (rem > 1e-6) {
      const step = Math.min(rem, 1 / 60);
      this.scene.update(step);
      rem -= step;
    }
    this.scene.render();
  }

  // ---------------- 调试 ----------------

  debugText(scene) {
    const w = this.world;
    const s = scene.session;
    let txt = 'FPS ' + this.fps + ' · ' + w.speedNow.toFixed(1) + 'm/s · ' + Math.round(s.trackPos) + 'm';
    if (scene.gen) txt += ' · t' + scene.gen.time.toFixed(1);
    if (scene.director) txt += ' · ' + scene.director.state;
    if (w.godMode) txt += ' · 无敌';
    return txt;
  }

  onDebugKey(code) {
    const sc = this.scene;
    switch (code) {
      case 'KeyB':
        if (sc && sc.debugSkip) sc.debugSkip();
        break;
      case 'KeyG':
        this.world.godMode = !this.world.godMode;
        break;
      case 'KeyK':
        if (sc && sc.debugHit) sc.debugHit();
        break;
      case 'KeyT':
        this.world.debugTimeScale = this.world.debugTimeScale === 1 ? 0.4 : 1;
        break;
      case 'Digit0':
        this.save.reset();
        if (this.sceneName === 'select' || this.sceneName === 'title') this.switchScene(this.sceneName);
        break;
      case 'KeyM':
        // 调试：+5000 金币
        if (this.sceneName === 'select' || this.sceneName === 'shop') {
          this.save.data.coins = Math.min(ECONOMY.maxCoins, this.save.data.coins + 5000);
          this.save.save();
          this.switchScene(this.sceneName);
        }
        break;
      case 'KeyU':
        // 调试：解锁并通关第 1~7 关
        if (this.sceneName === 'select') {
          for (let i = 1; i <= 7; i++) {
            const lv = this.save.getLevel(i);
            lv.cleared = true;
          }
          this.save.save();
          this.switchScene('select');
        }
        break;
      case 'KeyF':
        // 调试：集齐 21 片照片碎片（解锁回忆放映厅 + Boss Rush）
        if (this.sceneName === 'select' || this.sceneName === 'title') {
          for (let i = 1; i <= 7; i++) this.save.getLevel(i).photos = [true, true, true];
          this.save.save();
          this.switchScene(this.sceneName);
        }
        break;
    }
  }
}

window.__bootOk = true;
const boot = document.getElementById('boot');
if (boot) boot.remove();
// 调试 / 自动化测试用：暴露游戏实例（?debug 模式下配合 evaluate 检查状态）
window.game = new Game();
