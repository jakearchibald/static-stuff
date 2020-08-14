#version 300 es
#ifdef GL_ES
precision highp float;
precision highp int;
precision mediump sampler3D;
#endif
layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }
