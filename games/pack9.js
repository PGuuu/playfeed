/* PlayFeed WebGL prototype: one-touch risk/reward parachute landing. */
window.GAMES = (window.GAMES || []).concat([
{
  apiVersion: 1,
  gameVersion: '1.3.2',
  renderer: '3d',
  id: 'sky-drop-3d',
  title: '極限拉傘 3D',
  author: '@playfeed 官方',
  description: '看準風向延後拉傘，再控制降落傘落在島嶼靶心。',
  tip: '點一下拉傘；上下滑控制快慢，左右拖曳控制方向',
  bg: '#A7D8EE',
  tags: ['3d', 'timing', 'physics', 'landing'],
  controls: ['tap', 'horizontal-drag', 'vertical-drag', 'swipe-up', 'swipe-down'],
  preview: 'cover',
  duration: 45,
  score: { label: '降落分數', order: 'higher', decimals: 0 },
  remixSlots: [
    {
      key: 'skydiver',
      label: '跳傘者',
      hint: '空中的方塊跳傘角色',
      default: '🪂',
      shape: 'tall'
    },
    {
      key: 'parachute',
      label: '降落傘',
      hint: '開傘後出現在角色上方的傘面',
      default: '🌈',
      shape: 'wide'
    }
  ],

  create(env) {
    const gl = env.gl;
    const W = env.W;
    const H = env.H;
    const START_ALTITUDE = 260;
    const OPEN_HIGH = 200;
    const OPEN_LOW = 100;
    if (!gl) throw new Error('這款遊戲需要 WebGL');

    let alive = false;
    let raf = 0;
    let last = 0;
    let elapsed = 0;
    let started = false;
    let pulling = false;
    let dragging = false;
    let deployed = false;
    let altitude = START_ALTITUDE;
    let verticalSpeed = 27;
    let playerX = 0;
    let playerZ = 58;
    let steer = 0;
    let targetSteer = 0;
    let braking = false;
    let diving = false;
    let freefallControl = 0;
    let descentControl = 0;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartSteer = 0;
    let dragStartDescent = 0;
    let dragStartFreefall = 0;
    let pressStartX = 0;
    let pressStartY = 0;
    let gestureMoved = false;
    let wind = 2.4;
    let windForward = 0;
    let gustPhaseX = 0;
    let gustPhaseZ = 0;
    let forwardSpeed = 3;
    let lateralSpeed = 0;
    let openAltitude = START_ALTITUDE;
    let result = '';
    let resultTime = 0;
    let finalScore = 0;
    let program = null;
    let uiProgram = null;
    let textureProgram = null;
    let uiBuffer = null;
    let cube = null;
    let plane = null;
    let disc = null;
    let cone = null;
    let billboard = null;
    let uiVertices = [];

    function clamp(value, low, high) {
      return Math.max(low, Math.min(high, value));
    }

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
      }
      return shader;
    }

    function link(vertexSource, fragmentSource) {
      const linked = gl.createProgram();
      gl.attachShader(linked, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(linked, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(linked);
      if (!gl.getProgramParameter(linked, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(linked) || 'Shader link failed');
      }
      return linked;
    }

    function makeMesh(values, stride) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      return { buffer, count: values.length / stride, stride };
    }

    function pushVertex(values, point, normal) {
      values.push(point[0], point[1], point[2], normal[0], normal[1], normal[2]);
    }

    function pushTriangle(values, a, b, c, normal) {
      pushVertex(values, a, normal);
      pushVertex(values, b, normal);
      pushVertex(values, c, normal);
    }

    function cubeMesh() {
      const v = [];
      const p = [
        [-.5, -.5, -.5], [.5, -.5, -.5], [.5, .5, -.5], [-.5, .5, -.5],
        [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]
      ];
      const faces = [
        [4, 5, 6, 7, [0, 0, 1]], [1, 0, 3, 2, [0, 0, -1]],
        [0, 4, 7, 3, [-1, 0, 0]], [5, 1, 2, 6, [1, 0, 0]],
        [3, 7, 6, 2, [0, 1, 0]], [0, 1, 5, 4, [0, -1, 0]]
      ];
      for (let i = 0; i < faces.length; i++) {
        const f = faces[i];
        pushTriangle(v, p[f[0]], p[f[1]], p[f[2]], f[4]);
        pushTriangle(v, p[f[0]], p[f[2]], p[f[3]], f[4]);
      }
      return makeMesh(v, 6);
    }

    function planeMesh() {
      const v = [];
      pushTriangle(v, [-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [0, 1, 0]);
      pushTriangle(v, [-.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [0, 1, 0]);
      return makeMesh(v, 6);
    }

    function discMesh(segments) {
      const v = [];
      for (let i = 0; i < segments; i++) {
        const a = i / segments * Math.PI * 2;
        const b = (i + 1) / segments * Math.PI * 2;
        pushTriangle(v, [0, 0, 0], [Math.cos(b), 0, Math.sin(b)], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]);
      }
      return makeMesh(v, 6);
    }

    function coneMesh(segments) {
      const v = [];
      for (let i = 0; i < segments; i++) {
        const a = i / segments * Math.PI * 2;
        const b = (i + 1) / segments * Math.PI * 2;
        const mid = (a + b) / 2;
        const normal = [Math.cos(mid) * .75, .65, Math.sin(mid) * .75];
        pushTriangle(v, [0, 1, 0], [Math.cos(a), 0, Math.sin(a)], [Math.cos(b), 0, Math.sin(b)], normal);
      }
      return makeMesh(v, 6);
    }

    function identity() {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }

    function multiply(a, b) {
      const out = new Array(16).fill(0);
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
          for (let k = 0; k < 4; k++) {
            out[column * 4 + row] += a[k * 4 + row] * b[column * 4 + k];
          }
        }
      }
      return out;
    }

    function perspective(fov, aspect, near, far) {
      const f = 1 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
      ];
    }

    function normalize(v) {
      const length = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / length, v[1] / length, v[2] / length];
    }

    function cross(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
      ];
    }

    function dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    function lookAt(eye, center, up) {
      const z = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
      const x = normalize(cross(up, z));
      const y = cross(z, x);
      return [
        x[0], y[0], z[0], 0,
        x[1], y[1], z[1], 0,
        x[2], y[2], z[2], 0,
        -dot(x, eye), -dot(y, eye), -dot(z, eye), 1
      ];
    }

    function model(tx, ty, tz, sx, sy, sz, ry, rz) {
      const cy = Math.cos(ry || 0);
      const syy = Math.sin(ry || 0);
      const cz = Math.cos(rz || 0);
      const szz = Math.sin(rz || 0);
      return [
        cy * cz * sx, szz * sx, -syy * cz * sx, 0,
        -cy * szz * sy, cz * sy, syy * szz * sy, 0,
        syy * sz, 0, cy * sz, 0,
        tx, ty, tz, 1
      ];
    }

    function initialiseGL() {
      if (program) return;
      program = link(
        'attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMvp;uniform mat4 uModel;varying float vLight;varying float vFog;void main(){vec4 world=uModel*vec4(aPosition,1.0);vec3 n=normalize(mat3(uModel)*aNormal);vLight=.42+max(0.0,dot(n,normalize(vec3(-.35,.8,.5))))*.7;gl_Position=uMvp*vec4(aPosition,1.0);vFog=smoothstep(.25,1.0,gl_Position.z/gl_Position.w);}',
        'precision mediump float;uniform vec4 uColor;varying float vLight;varying float vFog;void main(){vec3 lit=uColor.rgb*vLight;gl_FragColor=vec4(mix(lit,vec3(.68,.84,.91),vFog*.46),uColor.a);}'
      );
      uiProgram = link(
        'attribute vec2 aPosition;attribute vec4 aColor;varying vec4 vColor;void main(){gl_Position=vec4(aPosition,0.0,1.0);vColor=aColor;}',
        'precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}'
      );
      textureProgram = link(
        'attribute vec3 aPosition;attribute vec2 aUv;uniform mat4 uMvp;varying vec2 vUv;void main(){gl_Position=uMvp*vec4(aPosition,1.0);vUv=aUv;}',
        'precision mediump float;uniform sampler2D uTexture;varying vec2 vUv;void main(){vec4 c=texture2D(uTexture,vUv);if(c.a<.05)discard;gl_FragColor=c;}'
      );
      cube = cubeMesh();
      plane = planeMesh();
      disc = discMesh(28);
      cone = coneMesh(16);
      billboard = makeMesh([
        -.5, -.5, 0, 0, 0, .5, -.5, 0, 1, 0, .5, .5, 0, 1, 1,
        -.5, -.5, 0, 0, 0, .5, .5, 0, 1, 1, -.5, .5, 0, 0, 1
      ], 5);
      uiBuffer = gl.createBuffer();
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    function drawMesh(mesh, matrix, color, viewProjection) {
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
      const position = gl.getAttribLocation(program, 'aPosition');
      const normal = gl.getAttribLocation(program, 'aNormal');
      gl.enableVertexAttribArray(position);
      gl.enableVertexAttribArray(normal);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, 24, 12);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uModel'), false, new Float32Array(matrix));
      gl.uniformMatrix4fv(gl.getUniformLocation(program, 'uMvp'), false, new Float32Array(multiply(viewProjection, matrix)));
      gl.uniform4fv(gl.getUniformLocation(program, 'uColor'), color);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }

    function drawBillboard(texture, matrix, viewProjection) {
      if (!texture) return false;
      gl.useProgram(textureProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, billboard.buffer);
      const position = gl.getAttribLocation(textureProgram, 'aPosition');
      const uv = gl.getAttribLocation(textureProgram, 'aUv');
      gl.enableVertexAttribArray(position);
      gl.enableVertexAttribArray(uv);
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 20, 12);
      gl.uniformMatrix4fv(gl.getUniformLocation(textureProgram, 'uMvp'), false, new Float32Array(multiply(viewProjection, matrix)));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(textureProgram, 'uTexture'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, billboard.count);
      return true;
    }

    const font = {
      A:['01110','10001','10001','11111','10001','10001','10001'],
      B:['11110','10001','10001','11110','10001','10001','11110'],
      C:['01111','10000','10000','10000','10000','10000','01111'],
      D:['11110','10001','10001','10001','10001','10001','11110'],
      E:['11111','10000','10000','11110','10000','10000','11111'],
      F:['11111','10000','10000','11110','10000','10000','10000'],
      G:['01111','10000','10000','10111','10001','10001','01111'],
      H:['10001','10001','10001','11111','10001','10001','10001'],
      I:['11111','00100','00100','00100','00100','00100','11111'],
      K:['10001','10010','10100','11000','10100','10010','10001'],
      L:['10000','10000','10000','10000','10000','10000','11111'],
      M:['10001','11011','10101','10101','10001','10001','10001'],
      N:['10001','11001','10101','10011','10001','10001','10001'],
      O:['01110','10001','10001','10001','10001','10001','01110'],
      P:['11110','10001','10001','11110','10000','10000','10000'],
      R:['11110','10001','10001','11110','10100','10010','10001'],
      S:['01111','10000','10000','01110','00001','00001','11110'],
      T:['11111','00100','00100','00100','00100','00100','00100'],
      U:['10001','10001','10001','10001','10001','10001','01110'],
      V:['10001','10001','10001','10001','10001','01010','00100'],
      W:['10001','10001','10001','10101','10101','11011','10001'],
      X:['10001','10001','01010','00100','01010','10001','10001'],
      Y:['10001','10001','01010','00100','00100','00100','00100'],
      0:['01110','10001','10011','10101','11001','10001','01110'],
      1:['00100','01100','00100','00100','00100','00100','01110'],
      2:['01110','10001','00001','00010','00100','01000','11111'],
      3:['11110','00001','00001','01110','00001','00001','11110'],
      4:['00010','00110','01010','10010','11111','00010','00010'],
      5:['11111','10000','10000','11110','00001','00001','11110'],
      6:['01110','10000','10000','11110','10001','10001','01110'],
      7:['11111','00001','00010','00100','01000','01000','01000'],
      8:['01110','10001','10001','01110','10001','10001','01110'],
      9:['01110','10001','10001','01111','00001','00001','01110'],
      '.':['00000','00000','00000','00000','00000','00110','00110'],
      '-':['00000','00000','00000','11111','00000','00000','00000']
    };

    function uiRect(x, y, w, h, color) {
      const x0 = x / W * 2 - 1;
      const x1 = (x + w) / W * 2 - 1;
      const y0 = 1 - y / H * 2;
      const y1 = 1 - (y + h) / H * 2;
      const c = color;
      uiVertices.push(
        x0,y0,c[0],c[1],c[2],c[3], x1,y0,c[0],c[1],c[2],c[3], x1,y1,c[0],c[1],c[2],c[3],
        x0,y0,c[0],c[1],c[2],c[3], x1,y1,c[0],c[1],c[2],c[3], x0,y1,c[0],c[1],c[2],c[3]
      );
    }

    function textWidth(value, scale) {
      return Math.max(0, value.length * 6 - 1) * scale;
    }

    function uiText(value, x, y, scale, color, centered) {
      const message = String(value).toUpperCase();
      let cursor = centered ? x - textWidth(message, scale) / 2 : x;
      for (let i = 0; i < message.length; i++) {
        const glyph = font[message[i]];
        if (glyph) {
          for (let row = 0; row < 7; row++) {
            for (let column = 0; column < 5; column++) {
              if (glyph[row][column] === '1') uiRect(cursor + column * scale, y + row * scale, scale, scale, color);
            }
          }
        }
        cursor += 6 * scale;
      }
    }

    function flushUI() {
      if (!uiVertices.length) return;
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(uiProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, uiBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uiVertices), gl.DYNAMIC_DRAW);
      const position = gl.getAttribLocation(uiProgram, 'aPosition');
      const color = gl.getAttribLocation(uiProgram, 'aColor');
      gl.enableVertexAttribArray(position);
      gl.enableVertexAttribArray(color);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
      gl.drawArrays(gl.TRIANGLES, 0, uiVertices.length / 6);
      gl.enable(gl.DEPTH_TEST);
    }

    function drawWorld(viewProjection) {
      drawMesh(plane, model(0, -.55, 0, 220, 1, 220, 0, 0), [.25,.67,.82,1], viewProjection);
      drawMesh(disc, model(0, -.35, 0, 15, 1, 12, 0, 0), [.94,.81,.51,1], viewProjection);
      drawMesh(disc, model(0, -.27, 0, 12.5, 1, 9.5, 0, 0), [.34,.72,.35,1], viewProjection);
      drawMesh(cone, model(-5, -.18, -2, 4.5, 5.5, 4.5, 0, 0), [.24,.35,.28,1], viewProjection);
      drawMesh(cone, model(-5, 3.8, -2, 3.2, 1.5, 3.2, 0, 0), [.18,.57,.29,1], viewProjection);

      drawMesh(disc, model(0, -.12, 0, 4.4, 1, 4.4, 0, 0), [.96,.96,.9,1], viewProjection);
      drawMesh(disc, model(0, -.10, 0, 3.35, 1, 3.35, 0, 0), [.31,.63,.98,1], viewProjection);
      drawMesh(disc, model(0, -.08, 0, 1.7, 1, 1.7, 0, 0), [1,.62,.24,1], viewProjection);
      drawMesh(disc, model(0, -.06, 0, .65, 1, .65, 0, 0), [1,.96,.45,1], viewProjection);

      const trees = [[-9,-4],[-8,4],[-3,6],[5,5],[8,-4],[6,-7],[2,-7],[-10,0]];
      for (let i = 0; i < trees.length; i++) {
        const t = trees[i];
        drawMesh(cube, model(t[0], .65, t[1], .22, 1.4, .22, 0, 0), [.38,.23,.12,1], viewProjection);
        drawMesh(cone, model(t[0], 1.7, t[1], .8, 1.3, .8, 0, 0), [.14,.58,.27,1], viewProjection);
      }

      if (started && !result) {
        const remaining = altitude / Math.max(2.5, verticalSpeed);
        const predictedX = playerX + lateralSpeed * remaining;
        const predictedZ = playerZ - forwardSpeed * remaining;
        drawMesh(disc, model(predictedX, -.035, predictedZ, 1.15, 1, 1.15, 0, 0), [.15,.95,1,.92], viewProjection);
        drawMesh(disc, model(predictedX, -.025, predictedZ, .55, 1, .55, 0, 0), [.04,.16,.22,1], viewProjection);
        for (let i = 1; i <= 7; i++) {
          const t = i / 8;
          const arcY = altitude * (1 - t) + Math.sin(t * Math.PI) * 4;
          const arcX = playerX + (predictedX - playerX) * t;
          const arcZ = playerZ + (predictedZ - playerZ) * t;
          drawMesh(cube, model(arcX, arcY, arcZ, .32, .32, .32, 0, 0), [.35,.95,1,.62], viewProjection);
        }
      }

      const framingDistance = Math.hypot(playerX, altitude, playerZ);
      drawPilot(viewProjection, playerX, altitude, playerZ, clamp(framingDistance / 75, 1, 3.6));
    }

    function drawPilot(viewProjection, baseX, baseY, baseZ, scale) {
      const poseX = baseX + steer * .7 * scale;
      const poseY = baseY + (deployed ? -1.8 : 0) * scale;
      const diverTexture = env.texture('skydiver');
      if (!drawBillboard(diverTexture, model(poseX, poseY, baseZ, 4.8 * scale, 6.1 * scale, 1, 0, -steer * .1), viewProjection)) {
        drawMesh(cube, model(poseX, poseY, baseZ - .18 * scale, 1.75 * scale, 2.2 * scale, 1.05 * scale, steer * .12, -steer * .1), [.05,.09,.16,1], viewProjection);
        drawMesh(cube, model(poseX, poseY + .08 * scale, baseZ, 1.45 * scale, 1.9 * scale, .9 * scale, steer * .12, -steer * .1), [1,.35,.16,1], viewProjection);
        drawMesh(cube, model(poseX, poseY + 1.62 * scale, baseZ, 1.12 * scale, 1.12 * scale, 1.08 * scale, 0, 0), [1,.86,.62,1], viewProjection);
        drawMesh(cube, model(poseX - 1.02 * scale, poseY + .05 * scale, baseZ, .42 * scale, 1.55 * scale, .42 * scale, 0, -.32), [.1,.86,.96,1], viewProjection);
        drawMesh(cube, model(poseX + 1.02 * scale, poseY + .05 * scale, baseZ, .42 * scale, 1.55 * scale, .42 * scale, 0, .32), [.1,.86,.96,1], viewProjection);
        drawMesh(cube, model(poseX - .48 * scale, poseY - 1.65 * scale, baseZ, .48 * scale, 1.35 * scale, .5 * scale, 0, -.08), [.08,.15,.25,1], viewProjection);
        drawMesh(cube, model(poseX + .48 * scale, poseY - 1.65 * scale, baseZ, .48 * scale, 1.35 * scale, .5 * scale, 0, .08), [.08,.15,.25,1], viewProjection);
      }

      if (deployed) {
        const chuteTexture = env.texture('parachute');
        if (!drawBillboard(chuteTexture, model(poseX, poseY + 7.4 * scale, baseZ, 11.2 * scale, 5.3 * scale, 1, 0, -steer * .08), viewProjection)) {
          const panelColors = [[1,.42,.3,1],[1,.86,.36,1],[.3,.83,.91,1]];
          for (let i = -3; i <= 3; i++) {
            const arch = ((braking ? 7.55 : 7.15) - Math.abs(i) * .3) * scale;
            drawMesh(cube, model(poseX + i * 1.28 * scale, poseY + arch, baseZ, 1.37 * scale, .78 * scale, 1.45 * scale, 0, i * -.052 - steer * .08), panelColors[(i + 6) % 3], viewProjection);
            const length = (5.8 + (3 - Math.abs(i)) * .2) * scale;
            const angle = -i * .17;
            drawMesh(cube, model(poseX + i * .6 * scale, poseY + 3.8 * scale, baseZ, .055 * scale, length, .055 * scale, 0, angle), [.96,.98,1,1], viewProjection);
          }
        }
      } else if (started) {
        for (let i = -3; i <= 3; i++) {
          const streakX = poseX + (i * 1.8 + Math.sin(elapsed * 3 + i) * .4) * scale;
          drawMesh(cube, model(streakX, poseY + (3 + (i % 2) * 4) * scale, baseZ + scale, .04 * scale, 1.8 * scale, .04 * scale, 0, 0), [.78,.95,1,.58], viewProjection);
        }
      }
    }

    function drawUI() {
      uiVertices = [];
      uiRect(15, 15, 160, 42, [0.02,.06,.12,.58]);
      uiText(`ALT ${Math.max(0, Math.ceil(altitude))}M`, 26, 28, 2, [1,1,1,1], false);
      uiRect(W - 172, 15, 157, 42, [0.02,.06,.12,.58]);
      uiText(`WIND ${Math.abs(wind).toFixed(1)}`, W - 160, 28, 2, [.72,.97,1,1], false);
      const arrowX = wind > 0 ? W - 30 : W - 52;
      uiRect(arrowX, 64, 18, 5, [.1,.86,.96,1]);
      uiRect(wind > 0 ? arrowX + 13 : arrowX, 59, 5, 15, [.1,.86,.96,1]);
      if (started && !result) {
        uiRect(15, 67, 116, 32, [.02,.06,.12,.56]);
        const speedColor = braking ? [.45,1,.66,1] : diving ? [1,.42,.3,1] : [1,.82,.32,1];
        uiText(`V ${verticalSpeed.toFixed(1)}`, 27, 78, 2, speedColor, false);

        const barX = 17, barTop = 126, barHeight = 342, barWidth = 13;
        const altitudeY = value => barTop + barHeight * (1 - clamp(value / START_ALTITUDE, 0, 1));
        const safeTop = altitudeY(OPEN_HIGH);
        const safeBottom = altitudeY(OPEN_LOW);
        uiRect(barX, barTop, barWidth, barHeight, [.02,.06,.12,.62]);
        uiRect(barX + 2, safeTop, barWidth - 4, safeBottom - safeTop, [.22,.9,.48,.72]);
        const markerY = altitudeY(altitude);
        uiRect(barX - 4, markerY - 2, barWidth + 8, 4, [1,1,1,1]);
        if (!deployed) {
          uiText('OPEN', 38, safeTop + (safeBottom - safeTop) / 2 - 7, 2, [.45,1,.66,1], false);
        }
      }

      if (!started) {
        uiRect(67, 558, 266, 72, [.02,.06,.12,.72]);
        uiText('SKY DROP', W / 2, 574, 4, [1,1,1,1], true);
        uiText('TAP TO DROP', W / 2, 613, 2, [.35,.95,1,1], true);
      } else if (!deployed && !result) {
        uiRect(54, 555, 292, 86, pulling ? [.08,.3,.36,.84] : [.02,.06,.12,.72]);
        uiText('TAP RIPCORD', W / 2, 570, 3, [1,1,1,1], true);
        uiText('UP DIVE  DOWN SLOW', W / 2, 610, 2, [.4,.94,1,1], true);
      } else if (deployed && !result) {
        uiRect(42, 542, 316, 106, [.02,.06,.12,.74]);
        uiText(braking ? 'BRAKING' : diving ? 'DIVING' : 'GLIDING', W / 2, 555, 3,
          braking ? [.45,1,.66,1] : diving ? [1,.42,.3,1] : [1,1,1,1], true);
        uiText('UP DIVE  DOWN BRAKE', W / 2, 591, 2, [.4,.94,1,1], true);
        uiText('LEFT RIGHT STEER', W / 2, 619, 2, [1,1,1,.86], true);
      }

      if (result) {
        uiRect(45, 243, 310, 168, [.02,.06,.12,.76]);
        const resultColor = result === 'SAFE' ? [.45,1,.65,1] : [1,.42,.38,1];
        uiText(result, W / 2, 271, 5, resultColor, true);
        uiText('SCORE', W / 2, 329, 2, [1,1,1,.72], true);
        uiText(String(finalScore), W / 2, 354, 4, [1,1,1,1], true);
      }
      flushUI();
    }

    function land() {
      altitude = 0;
      const distance = Math.hypot(playerX, playerZ);
      const accuracy = clamp(1 - distance / 7, 0, 1);
      const softness = clamp(1 - Math.max(0, verticalSpeed - 7) / 13, 0, 1);
      const openingQuality = openAltitude > OPEN_HIGH
        ? clamp(1 - (openAltitude - OPEN_HIGH) / 180, .55, 1)
        : openAltitude < OPEN_LOW
          ? clamp((openAltitude - 25) / (OPEN_LOW - 25), .25, 1)
          : 1;
      const late = (1 + clamp((START_ALTITUDE - openAltitude) / 210, 0, 1) * 1.25) * openingQuality;
      const windBonus = 1 + Math.abs(wind) * .12;
      const safe = deployed && distance < 7 && verticalSpeed < 18;
      finalScore = safe ? Math.round(1000 * accuracy * accuracy * softness * late * windBonus) : 0;
      result = safe ? 'SAFE' : 'CRASH';
      resultTime = 0;
      env.setScore(finalScore);
      env.beep(safe ? 520 : 150, safe ? 920 : 70, .25, .08, safe ? 'sine' : 'sawtooth');
    }

    function deployParachute() {
      if (deployed || result) return;
      if (altitude <= 25) {
        land();
        return;
      }
      deployed = true;
      openAltitude = altitude;
      pulling = false;
      dragging = false;
      freefallControl = 0;
      braking = false;
      diving = false;
      verticalSpeed = Math.min(verticalSpeed, 27);
      env.beep(190, 620, .22, .06, 'triangle');
    }

    function update(dt) {
      elapsed += dt;
      if (result) {
        resultTime += dt;
        if (resultTime >= 1.8) {
          alive = false;
          env.over(finalScore);
        }
        return;
      }
      if (!started) return;

      wind = Math.sin(elapsed * .52 + gustPhaseX) * 3.1 +
        Math.sin(elapsed * 1.23 + gustPhaseX * .47) * 1.15;
      windForward = Math.sin(elapsed * .39 + gustPhaseZ) * 2.2 +
        Math.sin(elapsed * .91 + gustPhaseZ * .61) * .85;

      if (!deployed) {
        const targetFreefallSpeed = 27 + freefallControl * 8;
        verticalSpeed += (targetFreefallSpeed - verticalSpeed) * Math.min(1, dt * 3.2);
        if (!dragging) freefallControl *= Math.pow(.985, dt * 60);
        lateralSpeed = wind * .13;
        forwardSpeed = 3 + freefallControl * 4;
        playerX += lateralSpeed * dt;
        playerZ += (-forwardSpeed + windForward * .12) * dt;
      } else {
        const brakeAmount = clamp(-descentControl, 0, 1);
        const diveAmount = clamp(descentControl, 0, 1);
        const targetFallSpeed = 7.4 + diveAmount * 6.2 - brakeAmount * 4.5;
        verticalSpeed += (targetFallSpeed - verticalSpeed) * Math.min(1, dt * (braking ? 2.8 : 1.8));
        steer += (targetSteer - steer) * Math.min(1, dt * 8.5);
        const steerPower = 8.2 + diveAmount * 2.6 - brakeAmount * 2.8;
        lateralSpeed = wind * .42 + steer * steerPower;
        forwardSpeed = 1.8 + diveAmount * 3 - brakeAmount * 1.1;
        playerX += lateralSpeed * dt;
        playerZ += (-forwardSpeed + windForward * .3) * dt;
        if (!dragging) targetSteer *= Math.pow(.965, dt * 60);
        if (!dragging) descentControl *= Math.pow(.993, dt * 60);
        braking = descentControl < -.18;
        diving = descentControl > .18;
      }
      altitude -= verticalSpeed * dt;
      if (altitude <= 0) land();
    }

    function draw() {
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(.66, .84, .92, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = gl.canvas.width / Math.max(1, gl.canvas.height);
      const span = Math.max(24, Math.hypot(playerX, altitude, playerZ));
      const center = [playerX * .5, altitude * .5, playerZ * .5];
      const eye = [center[0], center[1] + span * .1 + 8, center[2] + span * 1.55 + 40];
      const projection = perspective(Math.PI * .42, aspect, .2, 1400);
      const view = lookAt(eye, center, [0, 1, 0]);
      const viewProjection = multiply(projection, view);
      drawWorld(viewProjection);
      drawUI();
    }

    function loop(now) {
      if (!alive) return;
      const dt = Math.min(.04, Math.max(0, (now - last) / 1000 || .016));
      last = now;
      update(dt);
      draw();
      if (alive) raf = requestAnimationFrame(loop);
    }

    function start() {
      stop();
      initialiseGL();
      alive = true;
      last = performance.now();
      elapsed = 0;
      started = env.mode === 'play' || env.mode === 'demo';
      pulling = false;
      dragging = false;
      braking = false;
      diving = false;
      freefallControl = 0;
      descentControl = 0;
      deployed = false;
      altitude = START_ALTITUDE;
      verticalSpeed = 27;
      wind = (Math.random() < .5 ? -1 : 1) * (1.3 + Math.random() * 2.7);
      windForward = 0;
      gustPhaseX = Math.random() * Math.PI * 2;
      gustPhaseZ = Math.random() * Math.PI * 2;
      playerX = -wind * 1.3;
      playerZ = 58;
      steer = 0;
      targetSteer = 0;
      dragStartX = 0;
      dragStartY = 0;
      dragStartSteer = 0;
      dragStartDescent = 0;
      dragStartFreefall = 0;
      pressStartX = 0;
      pressStartY = 0;
      gestureMoved = false;
      forwardSpeed = 3;
      lateralSpeed = wind * .13;
      openAltitude = START_ALTITUDE;
      result = '';
      resultTime = 0;
      finalScore = 0;
      env.setScore(0);
      draw();
      raf = requestAnimationFrame(loop);
    }

    function stop() {
      alive = false;
      pulling = false;
      dragging = false;
      braking = false;
      diving = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    function input(type, x, y) {
      if (!alive || result) return;
      if (type === 'cancel') {
        pulling = false;
        dragging = false;
        braking = false;
        diving = false;
        freefallControl = 0;
        descentControl = 0;
        gestureMoved = false;
        steer = 0;
        targetSteer = 0;
        return;
      }
      if (type === 'down') {
        if (!started) started = true;
        if (!deployed) {
          pressStartX = x;
          pressStartY = y;
          gestureMoved = false;
          pulling = x >= 54 && x <= 346 && y >= 555 && y <= 641;
          dragging = true;
          dragStartY = y;
          dragStartFreefall = freefallControl;
        } else {
          dragging = true;
          dragStartX = x;
          dragStartY = y;
          dragStartSteer = targetSteer;
          dragStartDescent = descentControl;
        }
      } else if (type === 'move' && dragging) {
        const dy = y - dragStartY;
        if (!deployed) {
          if (Math.hypot(x - pressStartX, y - pressStartY) > 12) {
            gestureMoved = true;
            pulling = false;
            freefallControl = clamp(dragStartFreefall - dy / (H * .18), -1, 1);
            braking = freefallControl < -.18;
            diving = freefallControl > .18;
          }
        } else {
          targetSteer = clamp(dragStartSteer + (x - dragStartX) / (W * .2), -1, 1);
          descentControl = clamp(dragStartDescent - dy / (H * .16), -1, 1);
          braking = descentControl < -.18;
          diving = descentControl > .18;
        }
      } else if (type === 'up') {
        if (!deployed && pulling && !gestureMoved &&
            Math.hypot(x - pressStartX, y - pressStartY) < 14) {
          deployParachute();
        }
        pulling = false;
        dragging = false;
        gestureMoved = false;
      }
    }

    return { start, stop, input };
  }
}
]);
