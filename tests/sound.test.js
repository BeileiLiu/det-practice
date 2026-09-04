'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Sound = require('../js/sound.js');
test('音效设置：开关和音量范围', () => {
  assert.deepEqual(Sound.configure({ enabled: false, volume: 2 }), { enabled: false, volume: 1 });
  assert.deepEqual(Sound.configure({ enabled: true, volume: -1 }), { enabled: true, volume: 0 });
  assert.deepEqual(Sound.configure({ volume: 0.4 }), { enabled: true, volume: 0.4 });
});
test('无 Web Audio 环境时安静降级', () => {
  Sound.configure({ enabled: true, volume: 0.5 });
  assert.equal(Sound.unlock(), false); assert.equal(Sound.play('success'), false);
});
