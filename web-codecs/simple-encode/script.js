function createProgram(mGL, vsSource, fsSource) {
  const vs = mGL.createShader(mGL.VERTEX_SHADER);
  const fs = mGL.createShader(mGL.FRAGMENT_SHADER);

  mGL.shaderSource(vs, vsSource);
  mGL.shaderSource(fs, fsSource);

  mGL.compileShader(vs);
  mGL.compileShader(fs);

  if (!mGL.getShaderParameter(vs, mGL.COMPILE_STATUS)) {
    throw Error(`Failed to compile vertex shader`);
  }

  if (!mGL.getShaderParameter(fs, mGL.COMPILE_STATUS)) {
    throw Error(`Failed to compile fragment shader`);
  }

  const program = mGL.createProgram();

  mGL.attachShader(program, vs);
  mGL.attachShader(program, fs);

  mGL.linkProgram(program);

  if (!mGL.getProgramParameter(program, mGL.LINK_STATUS)) {
    throw Error(`Could not link program`);
  }
  return program;
}

const webglEl = document.querySelector('.webgl');
const webglContainerEl = document.querySelector('.webgl-container');
const encodeForm = document.querySelector('.encode-video-form');

const canvas = document.createElement('canvas');
webglEl.append(canvas);

const ctx = canvas.getContext('webgl2', {
  alpha: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  antialias: false,
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});

if (!ctx) throw Error('Unable to create webgl2 context');

const mVBO_Tri = ctx.createBuffer();
ctx.bindBuffer(ctx.ARRAY_BUFFER, mVBO_Tri);
ctx.bufferData(
  ctx.ARRAY_BUFFER,
  new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]),
  ctx.STATIC_DRAW,
);
ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
let program;

function resizeCanvasToBounds() {
  const bounds = canvas.getBoundingClientRect();
  canvas.width = bounds.width * devicePixelRatio;
  canvas.height = bounds.height * devicePixelRatio;
}

async function initGL() {
  const [vsSource, fsSource] = await Promise.all(
    ['vert.glsl', 'frag.glsl'].map((url) => fetch(url).then((r) => r.text())),
  );
  program = createProgram(ctx, vsSource, fsSource);
  ctx.useProgram(program);
}

function render(time) {
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
  ctx.useProgram(program);
  ctx.uniform1f(ctx.getUniformLocation(program, 'iTime'), time);
  ctx.uniform3f(
    ctx.getUniformLocation(program, 'iResolution'),
    canvas.width,
    canvas.height,
    1.0,
  );
  const l1 = ctx.getAttribLocation(program, 'pos');
  ctx.viewport(0, 0, canvas.width, canvas.height);
  ctx.bindBuffer(ctx.ARRAY_BUFFER, mVBO_Tri);
  ctx.vertexAttribPointer(l1, 2, ctx.FLOAT, false, 0, 0);
  ctx.enableVertexAttribArray(l1);
  ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  ctx.disableVertexAttribArray(l1);
  ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
}

let nextFrameId;
let playing = false;

function play() {
  playing = true;
  resizeCanvasToBounds();
  const start = performance.now();

  function renderLoop() {
    render((performance.now() - start) / 1000);
    nextFrameId = requestAnimationFrame(renderLoop);
  }

  renderLoop();
}

function stop() {
  playing = false;
  cancelAnimationFrame(nextFrameId);
}

//encodeForm.width.value = Math.round(screen.width * devicePixelRatio);
//encodeForm.height.value = Math.round(screen.height * devicePixelRatio);
encodeForm.height.value = 320;
encodeForm.width.value = 180;

async function main() {
  await initGL();
  resizeCanvasToBounds();

  render(0);

  const buttons = {
    Play() {
      if (playing) {
        stop();
        this.textContent = 'Play';
      } else {
        play();
        this.textContent = 'Stop';
      }
    },
    async Fullscreen() {
      if (document.fullscreenElement === webglEl) {
        document.exitFullscreen();
      } else {
        await webglEl.requestFullscreen();
        resizeCanvasToBounds();
      }
    },
  };

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'buttons';

  for (const [text, onclick] of Object.entries(buttons)) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.onclick = onclick;
    buttonsEl.append(btn, ' ');
  }

  webglContainerEl.append(buttonsEl);
}

main();

encodeForm.onsubmit = async (event) => {
  event.preventDefault();
  const data = new FormData(encodeForm);
  const width = Number(data.get('width'));
  const height = Number(data.get('height'));
  const fps = Number(data.get('fps'));
  const seconds = Number(data.get('seconds'));
  const bitrate = Number(data.get('bitrate'));

  canvas.width = width;
  canvas.height = height;

  const encoder = new VideoEncoder({
    output(chunk) {
      console.log(chunk);
    },
    error(error) {
      console.error('VideoEncoder error', error);
    },
  });

  encoder.configure({
    codec: 'vp9',
    profile: 'vp09.02.10.08',
    bitrate,
    width,
    height,
    framerate: fps,
  });

  const framesToEncode = seconds * fps;
  const frameTimeDelta = 1 / fps;
  let framesEncoded = 0;

  while (framesEncoded < framesToEncode) {
    console.log('Encoding', framesEncoded + 1, 'of', framesToEncode);
    render(framesEncoded * frameTimeDelta);
    const bmp = await createImageBitmap(canvas);
    const frame = new VideoFrame(bmp, {
      duration: frameTimeDelta,
    });
    encoder.encode(frame);
    framesEncoded++;
  }

  await encoder.flush();
  encoder.close();
};
