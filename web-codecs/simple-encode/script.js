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

async function main() {
  const start = performance.now();
  const [vsSource, fsSource] = await Promise.all(
    ['vert.glsl', 'frag.glsl'].map((url) => fetch(url).then((r) => r.text())),
  );
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  canvas.width = 420;
  canvas.height = 236;
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

  const program = createProgram(ctx, vsSource, fsSource);
  ctx.useProgram(program);

  // create a 2D triangle Vertex Buffer
  const mVBO_Tri = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, mVBO_Tri);
  ctx.bufferData(
    ctx.ARRAY_BUFFER,
    new Float32Array([-1.0, -1.0, 3.0, -1.0, -1.0, 3.0]),
    ctx.STATIC_DRAW,
  );
  ctx.bindBuffer(ctx.ARRAY_BUFFER, null);

  let frame = 0;

  function loop() {
    ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
    ctx.useProgram(program);
    ctx.uniform1f(
      ctx.getUniformLocation(program, 'iTime'),
      (performance.now() - start) / 1000,
    );
    ctx.uniform3f(
      ctx.getUniformLocation(program, 'iResolution'),
      canvas.width,
      canvas.height,
      1.0,
    );
    ctx.uniform1i(ctx.getUniformLocation(program, 'iFrame'), frame);

    const l1 = ctx.getAttribLocation(program, 'pos');

    ctx.viewport(0, 0, canvas.width, canvas.height);

    ctx.bindBuffer(ctx.ARRAY_BUFFER, mVBO_Tri);
    ctx.vertexAttribPointer(l1, 2, ctx.FLOAT, false, 0, 0);
    ctx.enableVertexAttribArray(l1);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
    ctx.disableVertexAttribArray(l1);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, null);

    frame++;
    //requestAnimationFrame(loop);
  }

  loop();
}

main();
