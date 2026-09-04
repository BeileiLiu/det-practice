/* DET 练习站 · 本地界面音效（Web Audio 合成） */
(function (root) {
  'use strict';
  let enabled = true, volume = 0.55, context = null;
  function configure(options) {
    const opts = options || {};
    if (opts.enabled != null) enabled = !!opts.enabled;
    if (opts.volume != null) volume = Math.max(0, Math.min(1, Number(opts.volume) || 0));
    return getSettings();
  }
  function getSettings() { return { enabled, volume }; }
  function audioContext() {
    if (context) return context;
    const Ctx = root.AudioContext || root.webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx(); return context;
  }
  function unlock() {
    const ctx = audioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {});
    return !!ctx;
  }
  function note(ctx, at, frequency, duration, gain, type, endFrequency) {
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(frequency, at);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain * volume), at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(amp); amp.connect(ctx.destination); osc.start(at); osc.stop(at + duration + 0.02);
  }
  function schedule(ctx, name) {
    const t = ctx.currentTime + 0.008;
    if (name === 'tap') note(ctx, t, 360, 0.09, 0.16, 'sine', 540);
    else if (name === 'start') {
      note(ctx, t, 392, 0.12, 0.13, 'sine'); note(ctx, t + 0.07, 587.33, 0.22, 0.15, 'sine');
    }
    else if (name === 'success') {
      note(ctx, t, 523.25, 0.18, 0.18); note(ctx, t + 0.085, 659.25, 0.20, 0.17); note(ctx, t + 0.17, 783.99, 0.30, 0.18);
    } else if (name === 'improve') {
      note(ctx, t, 440, 0.15, 0.09, 'triangle'); note(ctx, t + 0.11, 392, 0.22, 0.08, 'triangle');
    } else if (name === 'complete') {
      note(ctx, t, 392, 0.16, 0.15); note(ctx, t + 0.075, 523.25, 0.18, 0.15); note(ctx, t + 0.15, 659.25, 0.20, 0.16); note(ctx, t + 0.24, 783.99, 0.34, 0.18);
    }
  }
  function play(name) {
    if (!enabled || volume <= 0) return false;
    const ctx = audioContext(); if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().then(function () { schedule(ctx, name); }).catch(function () {});
    } else schedule(ctx, name);
    return true;
  }
  const api = { configure, getSettings, unlock, play };
  root.AppSound = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
