/**
 * DOM 界面小工具：所有文字用 textContent 写入（不拼 innerHTML），避免任何注入风险。
 */
export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

export function append(parent, ...children) {
  for (const c of children) if (c) parent.appendChild(c);
  return parent;
}

/** 像素风按钮：点击时解锁音频 + 播放点击音效 */
export function button(game, label, className, onClick) {
  const b = el('button', 'btn ' + (className || ''), label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    game.audio.unlock();
    game.audio.play('click');
    onClick(e);
  });
  return b;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
