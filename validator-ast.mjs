const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

function isFunction(node) {
  return !!node && FUNCTION_TYPES.has(node.type);
}

function propertyName(prop) {
  if (!prop || prop.type !== 'Property') return null;
  if (!prop.computed && prop.key?.type === 'Identifier') return prop.key.name;
  if (prop.key?.type === 'Literal') return String(prop.key.value);
  return null;
}

function property(objectNode, name) {
  return objectNode?.properties?.find(item => propertyName(item) === name) || null;
}

// Traverse the create() body, but never enter a nested helper/callback function.
// A return inside randomEmptyCell(), Array.map(() => ...), etc. is not create()'s
// returned GameInstance.
function walkOwnFunction(functionNode, visit) {
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (node !== functionNode && isFunction(node)) {
      visit(node);
      return;
    }
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end') continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') walk(child);
        }
      } else if (value && typeof value.type === 'string') {
        walk(value);
      }
    }
  }
  walk(functionNode);
}

function bindingValue(functionNode, name) {
  let result = null;
  walkOwnFunction(functionNode, node => {
    if (result) return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) {
      result = node;
    } else if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === name
    ) {
      result = node.init;
    }
  });
  return result;
}

function resolveObject(functionNode, node) {
  if (node?.type === 'ObjectExpression') return node;
  if (node?.type === 'Identifier') {
    const value = bindingValue(functionNode, node.name);
    return value?.type === 'ObjectExpression' ? value : null;
  }
  return null;
}

export function findReturnedGameInstance(functionNode) {
  const returned = [];
  walkOwnFunction(functionNode, node => {
    if (node.type === 'ReturnStatement') returned.push(node.argument);
  });
  for (const value of returned) {
    const object = resolveObject(functionNode, value);
    if (object) return object;
  }
  return null;
}

export function hasGameInstanceMethod(functionNode, instance, name) {
  const value = property(instance, name)?.value;
  if (isFunction(value)) return true;
  if (value?.type !== 'Identifier') return false;
  return isFunction(bindingValue(functionNode, value.name));
}
