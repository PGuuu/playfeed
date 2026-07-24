let acornPromise;
let validatorAstPromise;

function walk(node, visit, parent = null, parentKey = '') {
  if (!node || typeof node !== 'object') return;
  visit(node, parent, parentKey);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) {
      for (const child of value) walk(child, visit, node, key);
    } else if (value && typeof value.type === 'string') {
      walk(value, visit, node, key);
    }
  }
}

function property(object, name) {
  return object?.properties?.find(item =>
    item.type === 'Property' &&
    ((!item.computed && item.key?.name === name) || item.key?.value === name)
  );
}

function memberName(node) {
  if (node?.type !== 'MemberExpression') return '';
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name;
  if (node.computed && node.property?.type === 'Literal') return String(node.property.value);
  return '';
}

function registrationObject(program) {
  if (program.body.length !== 1 || program.body[0].type !== 'ExpressionStatement') return null;
  const assignment = program.body[0].expression;
  if (assignment?.type !== 'AssignmentExpression' || assignment.operator !== '=') return null;
  if (
    assignment.left?.type !== 'MemberExpression' ||
    assignment.left.object?.name !== 'window' ||
    memberName(assignment.left) !== 'GAMES'
  ) return null;
  const call = assignment.right;
  if (
    call?.type !== 'CallExpression' ||
    memberName(call.callee) !== 'concat' ||
    call.arguments?.length !== 1
  ) return null;
  const array = call.arguments[0];
  if (array?.type !== 'ArrayExpression' || array.elements?.length !== 1) return null;
  return array.elements[0]?.type === 'ObjectExpression' ? array.elements[0] : null;
}

async function validatePublishedScript(source) {
  acornPromise ||= import('../vendor/acorn.mjs');
  validatorAstPromise ||= import('../validator-ast.mjs');
  const { parse } = await acornPromise;
  const { findReturnedGameInstance, hasGameInstanceMethod } = await validatorAstPromise;
  let program;
  try {
    program = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  } catch {
    return ['Script has a JavaScript syntax error.'];
  }

  const errors = [];
  const game = registrationObject(program);
  if (!game) return ['Script must contain exactly one PlayFeed game registration.'];

  const apiVersion = property(game, 'apiVersion')?.value;
  if (apiVersion?.type !== 'Literal' || apiVersion.value !== 1) errors.push('apiVersion must be 1.');

  const create = property(game, 'create')?.value;
  if (!create || !['FunctionExpression', 'ArrowFunctionExpression'].includes(create.type)) {
    return [...errors, 'Script must define create(env).'];
  }

  const instance = findReturnedGameInstance(create);
  if (!instance) {
    errors.push('create(env) must return a GameInstance.');
  } else {
    for (const method of ['start', 'stop', 'input']) {
      if (!hasGameInstanceMethod(create, instance, method)) {
        errors.push(`GameInstance must define ${method}().`);
      }
    }
  }

  const forbiddenIdentifiers = new Set([
    'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'navigator',
    'location', 'localStorage', 'sessionStorage', 'indexedDB', 'eval', 'Function',
    'globalThis', 'self', 'parent', 'top', 'opener', 'postMessage', 'importScripts',
    'Worker', 'SharedWorker', 'WebAssembly', 'require',
  ]);
  const forbiddenMembers = new Set([
    'ownerDocument', 'defaultView', 'contentWindow', 'contentDocument',
    'constructor', '__proto__', 'prototype',
  ]);
  let hasOver = false;
  let hasSetScore = false;
  let hasCancel = false;
  let hasSprite = false;

  walk(create, (node, parent, parentKey) => {
    if (node.type === 'Literal' && node.value === 'cancel') hasCancel = true;
    if (node.type === 'ImportExpression') errors.push('Dynamic import is not allowed.');
    if (node.type === 'WhileStatement' && node.test?.type === 'Literal' && node.test.value === true) {
      errors.push('while(true) is not allowed.');
    }
    if (node.type === 'ForStatement' && !node.test) errors.push('A for loop must have an end condition.');
    if (node.type === 'MemberExpression' && forbiddenMembers.has(memberName(node))) {
      errors.push(`Access to .${memberName(node)} is not allowed.`);
    }
    if (node.type === 'Identifier' && forbiddenIdentifiers.has(node.name)) {
      const staticKey = parent?.type === 'Property' && parentKey === 'key' && !parent.computed;
      const staticMember = parent?.type === 'MemberExpression' && parentKey === 'property' && !parent.computed;
      if (!staticKey && !staticMember) errors.push(`${node.name} is not allowed.`);
    }
    if (node.type === 'CallExpression') {
      const called = node.callee?.type === 'Identifier'
        ? node.callee.name
        : (node.callee?.object?.name === 'env' ? memberName(node.callee) : '');
      if (called === 'over') hasOver = true;
      if (called === 'setScore') hasSetScore = true;
      if (called === 'sprite') hasSprite = true;
    }
  });

  if (!hasOver) errors.push('Script must call env.over(score).');
  if (!hasSetScore) errors.push('Script must call env.setScore(number).');
  if (!hasCancel) errors.push('input() must handle cancel.');
  if (!hasSprite) errors.push('Script must use env.sprite() for at least one Remix element.');
  return [...new Set(errors)];
}

module.exports = { validatePublishedScript };
