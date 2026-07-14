/**
 * Локальная проверка правил поддержки без БД.
 * Запуск: node scripts/test-support-isolation.mjs
 */

import assert from 'node:assert/strict';

const ALLOWED = {
  new: ['acknowledged'],
  acknowledged: ['in_progress'],
  in_progress: ['done'],
  done: [],
};

const canTransition = (from, to) => (ALLOWED[from] || []).includes(to);

assert.equal(canTransition('new', 'acknowledged'), true);
assert.equal(canTransition('new', 'done'), false);
assert.equal(canTransition('acknowledged', 'in_progress'), true);
assert.equal(canTransition('in_progress', 'done'), true);
assert.equal(canTransition('done', 'new'), false);

process.env.SUPPORT_SHADOW_OPERATOR_EMAIL = 'vetrov.daniil@entech.local';
const configured = (process.env.SUPPORT_SHADOW_OPERATOR_EMAIL || '').trim().toLowerCase();
const isShadowOp = (email) => Boolean(configured && email && email.trim().toLowerCase() === configured);

assert.equal(isShadowOp('vetrov.daniil@entech.local'), true);
assert.equal(isShadowOp('Vetrov.Daniil@entech.local'), true);
assert.equal(isShadowOp('admin@entech.local'), false);

// Обычный ADMIN не должен совпадать с оператором тени только из-за роли
const regularAdmin = { role: 'ADMIN', email: 'other.admin@entech.local' };
assert.equal(isShadowOp(regularAdmin.email), false);

console.log('OK: support isolation rules');
