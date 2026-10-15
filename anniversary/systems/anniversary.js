import { CONFIG } from '../config.js';

/**
 * 纪念日计算："今天是和 TA 在一起的第 N 天"。
 * 用本地日期（年月日）换算成 UTC 零点再相减，避免夏令时 / 时区导致差一天。
 * 返回值可能为负（还没到在一起的日子）。
 */
export function daysTogether(now = new Date()) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(CONFIG.anniversaryDate).trim());
  if (!m) return null;
  const start = Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - start) / 86400000);
  return diff + (CONFIG.countStartDayAsOne ? 1 : 0);
}
