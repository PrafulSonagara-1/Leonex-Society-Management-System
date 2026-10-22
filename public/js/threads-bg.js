/**
 * Threads Animated WebGL2 Background
 * Faithfully adapted from ReactBits (https://reactbits.dev/backgrounds/threads)
 * Standalone Vanilla JavaScript implementation for SocietyHub Demo page.
 */

(function (global) {
  'use strict';

  const LINE_VERTEX = `#version 300 es
precision highp float;
in vec2 aPoint;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFrame;
uniform float uAmplitude;
uniform float uDistance;
uniform vec2 uMouse;
uniform float uCount;
uniform float uThickness;
uniform float uSoftness;
uniform float uWaves;
uniform float uSplit;
uniform float uFray;
uniform float uSeed;
uniform vec2 uTurn;
uniform vec4 uPart;
uniform float uTaper;
out float vEdge;
out float vBand;
out float vDraw;
out float vAlpha;
out float vIndex;

float Perlin2D(vec2 P) {
  vec2 Pi = floor(P);
  vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
  vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
  Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
  Pt += vec2(26.0, 161.0).xxyy;
  Pt *= Pt;
  Pt = Pt.xzxz * Pt.yyww;
  vec4 hash_x = fract(Pt * (1.0 / 951.135664));
  vec4 hash_y = fract(Pt * (1.0 / 642.949883));
  vec4 grad_x = hash_x - 0.49999;
  vec4 grad_y = hash_y - 0.49999;
  vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y) * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
  grad_results *= 1.4142135623730950;
  vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
  vec4 blend2 = vec4(blend, vec2(1.0 - blend));
  return dot(grad_results, blend2.zxzx * blend2.wwyy);
}

void main() {
  float perc = float(gl_InstanceID) / uCount;
  float x = aPoint.x;
  float pixel = 1.0 / max(uResolution.x, uResolution.y);
  float splitPoint = uSplit + perc * uFray;
  float amplitudeNormal = smoothstep(splitPoint, max(0.7, splitPoint + 0.2), x);
  float finalAmplitude = amplitudeNormal * 0.5 * uAmplitude * (1.0 + (uMouse.y - 0.5) * 0.2);
  float timeScaled = uTime / 10.0 + (uMouse.x - 0.5);
  float blur = smoothstep(splitPoint, splitPoint + 0.05, x) * perc;
  float xnoise = mix(
    Perlin2D(vec2(timeScaled * 2.5 + uSeed, (x * uWaves + perc) * 2.5)),
    Perlin2D(vec2(timeScaled * 3.5 + uSeed, (x * uWaves + timeScaled) * 3.5)) / 1.5,
    x * 0.3
  );
  float y = 0.5 + (perc - 0.5) * uDistance + xnoise / 2.0 * finalAmplitude;
  vec2 local = vec2((x - 0.5) * uFrame.x, (y - 0.5) * uFrame.y);
  if (uPart.z > 0.0) {
    vec2 delta = local - uPart.xy;
    float reach = uPart.w;
    float pull = exp(-dot(delta, delta) / (reach * reach));
    local.y += delta.y * pull * uPart.z;
  }
  float width = 7.0 * uThickness * pixel * (1.0 - perc);
  float band = (width / 2.0 + 10.0 * uSoftness * pixel * blur) * uFrame.y;
  float draw = max(band, 1.0);
  local.y += aPoint.y * draw;
  vec2 turned = vec2(local.x * uTurn.x - local.y * uTurn.y, local.x * uTurn.y + local.y * uTurn.x);
  gl_Position = vec4(turned / (uResolution * 0.5), 0.0, 1.0);
  vEdge = aPoint.y * draw;
  vBand = band;
  vDraw = draw;
  vAlpha = 1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3)) * uTaper;
  vIndex = perc;
}
`;

  const LINE_FRAGMENT = `#version 300 es
precision highp float;
in float vEdge;
in float vBand;
in float vDraw;
in float vAlpha;
in float vIndex;
uniform vec3 uColor;
uniform vec3 uAccent;
out vec4 outColor;
void main() {
  float coverage = (1.0 - smoothstep(0.0, vDraw, abs(vEdge))) * (vBand / vDraw) * vAlpha;
  outColor = vec4(mix(uColor, uAccent, vIndex) * coverage, coverage);
}
`;

  const SCREEN_VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

  const SCREEN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uLines;
uniform vec2 uResolution;
uniform float uFade;
uniform float uOpacity;
uniform float uCurve;
out vec4 outColor;

float smootherstep(float edge, float x) {
  float t = clamp(x / edge, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

void main() {
  vec4 lines = texture(uLines, vUv);
  float alpha = lines.a;
  vec3 color = alpha > 0.0001 ? lines.rgb / alpha : vec3(0.0);
  float mask = uOpacity;
  if (uFade > 0.0) {
    vec2 px = vUv * uResolution;
    float edge = uFade * min(uResolution.x, uResolution.y) * 0.5;
    mask *= smootherstep(edge, px.x) * smootherstep(edge, uResolution.x - px.x);
    mask *= smootherstep(edge, px.y) * smootherstep(edge, uResolution.y - px.y);
  }
  outColor = vec4(color * pow(alpha, uCurve), alpha) * mask;
}
`;

  const MAX_RENDER_DIM = 1920;

  function clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.warn('Shader compilation error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  function link(gl, vertexSource, fragmentSource) {
    const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    console.warn('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  function locate(gl, program, names) {
    const result = {};
    for (const name of names) {
      result[name] = gl.getUniformLocation(program, name);
    }
    return result;
  }

  class ThreadsBackground {
    constructor(canvasElement, userOptions = {}) {
      if (typeof canvasElement === 'string') {
        canvasElement = document.getElementById(canvasElement);
      }
      if (!canvasElement) {
        console.error('ThreadsBackground: canvas element not found.');
        return;
      }

      this.canvas = canvasElement;
      this.container = this.canvas.parentElement || document.body;

      this.gl = this.canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false
      });

      if (!this.gl) {
        console.warn('WebGL2 not supported on this device. Threads background will not render.');
        return;
      }

      const gl = this.gl;

      this.lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT);
      this.screenProgram = link(gl, SCREEN_VERTEX, SCREEN_FRAGMENT);

      if (!this.lineProgram || !this.screenProgram) {
        console.error('Failed to link Threads shader programs.');
        return;
      }

      this.lineUniforms = locate(gl, this.lineProgram, [
        'uTime',
        'uResolution',
        'uFrame',
        'uAmplitude',
        'uDistance',
        'uMouse',
        'uCount',
        'uThickness',
        'uSoftness',
        'uWaves',
        'uSplit',
        'uFray',
        'uSeed',
        'uTurn',
        'uPart',
        'uTaper',
        'uColor',
        'uAccent'
      ]);

      this.screenUniforms = locate(gl, this.screenProgram, [
        'uLines',
        'uResolution',
        'uFade',
        'uOpacity',
        'uCurve'
      ]);

      // VAO & Buffers
      this.lineVao = gl.createVertexArray();
      this.lineBuffer = gl.createBuffer();
      gl.bindVertexArray(this.lineVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      const pointLocation = gl.getAttribLocation(this.lineProgram, 'aPoint');
      gl.enableVertexAttribArray(pointLocation);
      gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0);

      this.screenVao = gl.createVertexArray();
      this.screenBuffer = gl.createBuffer();
      gl.bindVertexArray(this.screenVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.screenBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const positionLocation = gl.getAttribLocation(this.screenProgram, 'aPosition');
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      this.target = gl.createTexture();
      this.framebuffer = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, this.target);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      // Color probe
      this.probe = document.createElement('canvas');
      this.probe.width = 1;
      this.probe.height = 1;
      this.probeContext = this.probe.getContext('2d', { willReadFrequently: true });

      const reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

      this.state = {
        time: 0,
        width: 1,
        height: 1,
        segments: 0,
        colorKey: '',
        color: [1, 1, 1],
        accent: [1, 1, 1],
        mouse: [0.5, 0.5],
        targetMouse: [0.5, 0.5],
        pointer: [0, 0],
        targetPointer: [0, 0],
        presence: 0,
        inside: false,
        reduce: reduceMotion
      };

      this.raf = 0;
      this.last = 0;
      this.visible = true;
      this.alive = true;

      this.options = this.sanitizeOptions(userOptions);

      // Event bindings
      this.handlePointerMove = this.onPointerMove.bind(this);
      this.handlePointerLeave = this.onPointerLeave.bind(this);
      this.handleVisibility = this.onVisibility.bind(this);
      this.handleResize = this.resize.bind(this);
      this.loop = this.frame.bind(this);

      window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.handlePointerLeave);
      document.addEventListener('visibilitychange', this.handleVisibility);

      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener('resize', this.handleResize);
      }

      this.resize();
      this.wake();
    }

    sanitizeOptions(opts) {
      return {
        color: opts.color ?? [1, 1, 1],
        accentColor: opts.accentColor ?? [0.83, 0.58, 0.35], // SocietyHub golden amber blend
        amplitude: opts.amplitude ?? 1.7,
        distance: opts.distance ?? 0.4,
        enableMouseInteraction: opts.enableMouseInteraction !== false,
        lineCount: clamp(Math.round(opts.lineCount ?? 80), 1, 400),
        thickness: Math.max(0, opts.thickness ?? 0.6),
        softness: Math.max(0, opts.softness ?? 1.3),
        speed: opts.speed ?? 0.6,
        waves: Math.max(0, opts.waves ?? 1.05),
        split: clamp(opts.split ?? 0.04, 0, 1),
        fray: clamp(opts.fray ?? 0.5, 0, 1),
        angle: opts.angle ?? 25,
        seed: opts.seed ?? 0,
        parting: clamp(opts.parting ?? 0, 0, 1),
        taper: clamp(opts.taper ?? 0.85, 0, 1),
        brightness: clamp(opts.brightness ?? 1.4, 0.25, 2),
        fade: clamp(opts.fade ?? 0, 0, 1),
        opacity: clamp(opts.opacity ?? 1, 0, 1),
        paused: Boolean(opts.paused)
      };
    }

    setOptions(newOpts) {
      this.options = this.sanitizeOptions({ ...this.options, ...newOpts });
      this.state.colorKey = '';
      this.wake();
    }

    toRgb(value) {
      if (Array.isArray(value)) {
        return [0, 1, 2].map(i => clamp(Number(value[i] ?? 1), 0, 1));
      }
      if (!this.probeContext) return [1, 1, 1];
      this.probeContext.clearRect(0, 0, 1, 1);
      this.probeContext.fillStyle = '#ffffff';
      this.probeContext.fillStyle = String(value);
      this.probeContext.fillRect(0, 0, 1, 1);
      const [r, g, b] = this.probeContext.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255];
    }

    resolveColors(s) {
      const colorKey = `${Array.isArray(s.color) ? s.color.join(',') : String(s.color)}|${
        Array.isArray(s.accentColor) ? s.accentColor.join(',') : String(s.accentColor ?? '')
      }`;
      if (this.state.colorKey === colorKey) return;
      this.state.colorKey = colorKey;
      this.state.color = this.toRgb(s.color);
      this.state.accent = s.accentColor === undefined || s.accentColor === null ? this.state.color : this.toRgb(s.accentColor);
    }

    buildStrip(segments) {
      if (segments === this.state.segments) return;
      this.state.segments = segments;
      const points = new Float32Array((segments + 1) * 4);
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        points.set([u, -1, u, 1], i * 4);
      }
      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    }

    resize() {
      const gl = this.gl;
      if (!gl) return;
      const width = Math.max(1, this.container.clientWidth || window.innerWidth);
      const height = Math.max(1, this.container.clientHeight || window.innerHeight);
      const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
      const longest = Math.max(width, height) * baseDpr;
      const dpr = longest > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longest : baseDpr;

      this.canvas.width = Math.max(1, Math.round(width * dpr));
      this.canvas.height = Math.max(1, Math.round(height * dpr));
      this.state.width = width;
      this.state.height = height;

      gl.bindTexture(gl.TEXTURE_2D, this.target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.target, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      this.buildStrip(clamp(Math.round(width / 3), 96, 640));
      this.render();
    }

    render() {
      const gl = this.gl;
      if (!gl) return;

      const s = this.options;
      this.resolveColors(s);

      const w = this.canvas.width;
      const h = this.canvas.height;
      const radians = (s.angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const length = Math.abs(w * cos) + Math.abs(h * sin);
      const across = Math.abs(w * sin) + Math.abs(h * cos);
      const scale = w / this.state.width;
      const mouse = s.enableMouseInteraction ? this.state.mouse : [0.5, 0.5];
      const strength = s.parting * this.state.presence * 2;
      const px = this.state.pointer[0] * scale;
      const py = this.state.pointer[1] * scale;
      const local = [px * cos + py * sin, -px * sin + py * cos];

      // Draw lines offscreen
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(this.lineProgram);
      gl.uniform1f(this.lineUniforms.uTime, this.state.time);
      gl.uniform2f(this.lineUniforms.uResolution, w, h);
      gl.uniform2f(this.lineUniforms.uFrame, length, across);
      gl.uniform1f(this.lineUniforms.uAmplitude, s.amplitude);
      gl.uniform1f(this.lineUniforms.uDistance, s.distance);
      gl.uniform2f(this.lineUniforms.uMouse, mouse[0], mouse[1]);
      gl.uniform1f(this.lineUniforms.uCount, s.lineCount);
      gl.uniform1f(this.lineUniforms.uThickness, s.thickness);
      gl.uniform1f(this.lineUniforms.uSoftness, s.softness);
      gl.uniform1f(this.lineUniforms.uWaves, s.waves);
      gl.uniform1f(this.lineUniforms.uSplit, s.split);
      gl.uniform1f(this.lineUniforms.uFray, s.fray);
      gl.uniform1f(this.lineUniforms.uSeed, s.seed * 13.37);
      gl.uniform2f(this.lineUniforms.uTurn, cos, sin);
      gl.uniform4f(this.lineUniforms.uPart, local[0], local[1], strength, Math.min(w, h) * 0.16);
      gl.uniform1f(this.lineUniforms.uTaper, s.taper);
      gl.uniform3f(this.lineUniforms.uColor, this.state.color[0], this.state.color[1], this.state.color[2]);
      gl.uniform3f(this.lineUniforms.uAccent, this.state.accent[0], this.state.accent[1], this.state.accent[2]);

      gl.bindVertexArray(this.lineVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (this.state.segments + 1) * 2, s.lineCount);

      // Composite to screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.target);
      gl.uniform1i(this.screenUniforms.uLines, 0);
      gl.uniform2f(this.screenUniforms.uResolution, w, h);
      gl.uniform1f(this.screenUniforms.uFade, s.fade);
      gl.uniform1f(this.screenUniforms.uOpacity, s.opacity);
      gl.uniform1f(this.screenUniforms.uCurve, 2 / s.brightness);

      gl.bindVertexArray(this.screenVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    }

    frame(now) {
      this.raf = 0;
      if (!this.alive || !this.visible || document.hidden) return;

      const s = this.options;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
      this.last = now;

      const moving = !s.paused && !this.state.reduce;
      if (moving) {
        this.state.time += dt * s.speed;
      }

      const follow = 1 - Math.exp(-dt * 3);
      this.state.mouse[0] += (this.state.targetMouse[0] - this.state.mouse[0]) * follow;
      this.state.mouse[1] += (this.state.targetMouse[1] - this.state.mouse[1]) * follow;

      const glide = 1 - Math.exp(-dt * 10);
      this.state.pointer[0] += (this.state.targetPointer[0] - this.state.pointer[0]) * glide;
      this.state.pointer[1] += (this.state.targetPointer[1] - this.state.pointer[1]) * glide;

      this.state.presence += ((this.state.inside && s.parting > 0 ? 1 : 0) - this.state.presence) * (1 - Math.exp(-dt * 6));

      this.render();

      const settling =
        Math.abs(this.state.targetMouse[0] - this.state.mouse[0]) > 0.0005 ||
        Math.abs(this.state.targetMouse[1] - this.state.mouse[1]) > 0.0005 ||
        Math.abs(this.state.targetPointer[0] - this.state.pointer[0]) > 0.05 ||
        Math.abs(this.state.targetPointer[1] - this.state.pointer[1]) > 0.05 ||
        Math.abs((this.state.inside && s.parting > 0 ? 1 : 0) - this.state.presence) > 0.002;

      if (moving || settling) {
        this.raf = requestAnimationFrame(this.loop);
      } else {
        this.last = 0;
      }
    }

    wake() {
      if (!this.raf && this.alive && this.visible && !document.hidden) {
        this.raf = requestAnimationFrame(this.loop);
      }
    }

    onPointerMove(event) {
      const rect = this.container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;

      if (inside) {
        this.state.targetMouse = [x, 1 - y];
        this.state.targetPointer = [
          event.clientX - rect.left - rect.width / 2,
          rect.height / 2 - (event.clientY - rect.top)
        ];
        if (!this.state.inside && this.state.presence < 0.01) {
          this.state.pointer = [...this.state.targetPointer];
        }
      } else if (this.state.inside) {
        this.state.targetMouse = [0.5, 0.5];
      }

      this.state.inside = inside;
      this.wake();
    }

    onPointerLeave() {
      this.state.inside = false;
      this.state.targetMouse = [0.5, 0.5];
      this.wake();
    }

    onVisibility() {
      this.visible = !document.hidden;
      if (this.visible) {
        this.last = 0;
        this.wake();
      }
    }

    destroy() {
      this.alive = false;
      if (this.raf) cancelAnimationFrame(this.raf);

      window.removeEventListener('pointermove', this.handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', this.handlePointerLeave);
      document.removeEventListener('visibilitychange', this.handleVisibility);

      if (this.resizeObserver) {
        this.resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', this.handleResize);
      }

      const gl = this.gl;
      if (gl) {
        gl.deleteFramebuffer(this.framebuffer);
        gl.deleteTexture(this.target);
        gl.deleteBuffer(this.lineBuffer);
        gl.deleteBuffer(this.screenBuffer);
        gl.deleteVertexArray(this.lineVao);
        gl.deleteVertexArray(this.screenVao);
        gl.deleteProgram(this.lineProgram);
        gl.deleteProgram(this.screenProgram);
      }
    }
  }

  // Export factory
  global.initThreadsBackground = function (canvasId, options) {
    return new ThreadsBackground(canvasId, options);
  };
  global.ThreadsBackground = ThreadsBackground;

})(typeof window !== 'undefined' ? window : this);
