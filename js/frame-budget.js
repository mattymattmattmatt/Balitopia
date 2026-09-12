/* Wall-clock quality control. Simulation dt is deliberately capped elsewhere;
 * it must never be used to measure how long the device took to draw a frame. */
'use strict';
const FrameBudget = (() => {
  const ladder = ['perf', 'battery', 'balanced', 'high'];
  function create() {
    let seconds = 0, frames = 0, good = 0, fps = 0;
    function reset() { seconds = 0; frames = 0; good = 0; fps = 0; }
    function observe(elapsed, target, quality) {
      if (!Number.isFinite(elapsed) || elapsed <= 0) return null;
      seconds += elapsed; frames++;
      if (seconds < 0.75) return null;
      fps = frames / seconds;
      const duration = seconds; seconds = 0; frames = 0;
      const index = ladder.indexOf(quality);
      if (fps < target * 0.45) { good = 0; return quality === 'perf' ? null : 'perf'; }
      if (fps < target * 0.8) { good = 0; return index > 0 ? ladder[index - 1] : null; }
      if (fps >= target * 0.94 && index >= 0 && index < 2) {
        good += duration;
        if (good >= 20) { good = 0; return ladder[index + 1]; }
      } else good = 0;
      return null;
    }
    return { observe, reset, fps: () => fps };
  }
  return { create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FrameBudget;
