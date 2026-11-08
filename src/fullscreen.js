// Keep the existing value buttons and their history handlers in the painting view.
export function setupFullscreen(beforeEnter) {
  const $ = id => document.getElementById(id);
  const stage = document.querySelector('.stage');
  const viewport = $('dropzone'), canvas = $('preview');
  const wrap = canvas.parentElement;
  const peek = $('color-peek');
  const levels = $('levels'), home = levels.parentElement, next = levels.nextSibling;
  let active = false, requesting = false, scrollY = 0;

  function fit() {
    if (!active) return;
    const style = getComputedStyle(viewport);
    const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const scale = Math.min(width / canvas.width, height / canvas.height);
    wrap.style.width = `${Math.max(0, canvas.width * scale)}px`;
    wrap.style.height = `${Math.max(0, canvas.height * scale)}px`;
  }
  new ResizeObserver(fit).observe(viewport);
  new MutationObserver(fit).observe(canvas, { attributes: true, attributeFilter: ['width', 'height'] });

  function leave() {
    if (!active) return;
    active = false;
    home.insertBefore(levels, next);
    peek.hidden = $('sample-toggle').getAttribute('aria-pressed') !== 'true';
    document.body.classList.remove('painting-view');
    $('painting-toolbar').hidden = true;
    $('fullscreen').setAttribute('aria-expanded', 'false');
    stage.removeAttribute('role'); stage.removeAttribute('aria-modal');
    wrap.style.removeProperty('width'); wrap.style.removeProperty('height');
    window.scrollTo(0, scrollY);
    $('fullscreen').focus({ preventScroll: true });
  }
  async function exit() {
    // A request can finish after Exit or Escape was pressed.
    leave();
    if (document.fullscreenElement === stage) {
      try { await document.exitFullscreen(); } catch { /* The in-page view has already closed. */ }
    }
  }
  $('fullscreen').onclick = async () => {
    if (active || requesting || $('fullscreen').disabled) return;
    scrollY = window.scrollY;
    beforeEnter(); active = true;
    peek.hidden = false;
    $('painting-values').append(levels);
    $('painting-toolbar').hidden = false;
    document.body.classList.add('painting-view');
    $('fullscreen').setAttribute('aria-expanded', 'true');
    stage.setAttribute('role', 'dialog'); stage.setAttribute('aria-modal', 'true');
    fit(); $('exit-fullscreen').focus();
    // Browsers without element fullscreen still get a viewport-filling view.
    if (stage.requestFullscreen) {
      requesting = true;
      try {
        await stage.requestFullscreen();
        if (!active && document.fullscreenElement === stage) await document.exitFullscreen();
      } catch { /* Retain the in-page fullscreen view when the browser declines. */ }
      finally { requesting = false; }
    }
  };
  $('exit-fullscreen').onclick = exit;
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== stage) leave();
  });
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); exit(); }
    if (event.key !== 'Tab') return;
    const buttons = [...stage.querySelectorAll('button:not(:disabled), select:not(:disabled), canvas[tabindex]')]
      .filter(element => element.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && (document.activeElement === first || !stage.contains(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !stage.contains(document.activeElement))) {
      event.preventDefault(); first.focus();
    }
  });
}
