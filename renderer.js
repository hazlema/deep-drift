import {MAX_DROPS} from './physics.js';
const vertex=`attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
uniform vec2 resolution; uniform vec2 viewport; uniform float time; uniform vec4 drops[48]; uniform int count; uniform int palette; uniform vec3 ripple;
vec3 color(float h){
 if(palette==1)return .62+.32*cos(6.28318*(h*.45+vec3(.02,.19,.31)));
 if(palette==2)return .58+.30*cos(6.28318*(h*.4+vec3(.48,.10,.02)));
 return .62+.30*cos(6.28318*(h+vec3(.0,.22,.43)));
}
void main(){
 vec2 p=vec2(gl_FragCoord.x/resolution.x,1.-gl_FragCoord.y/resolution.y)*viewport;
 vec2 uv=p/viewport; float s=min(viewport.x,viewport.y);
 vec2 water=vec2(uv.x*viewport.x/viewport.y,uv.y);
 float caustic=sin(water.x*9.+water.y*5.+time*.17)*sin(water.y*8.-water.x*3.-time*.12);
 vec3 bg=mix(vec3(.018,.063,.094),vec3(.065,.17,.19),smoothstep(1.25,.0,distance(uv,vec2(.64,.42))));
 bg+=vec3(.022,.038,.033)*caustic*.25;
 bg+=vec3(.013,.025,.028)*pow(max(0.,sin(water.x*12.+water.y*5.+sin(water.y*5.+time*.1))),10.);
 float vignette=1.-.42*pow(length((uv-.5)*1.2),2.);bg*=vignette;
 float f=0.;vec2 grad=vec2(0.);vec3 tint=vec3(0.);float hueWeight=0.;float shadow=0.;float nearest=0.;
 for(int i=0;i<48;i++){
  if(i>=count)break;
  vec4 d=drops[i];vec2 v=(p-d.xy)/d.z;
  float angle=atan(v.y,v.x);float phase=d.w*6.28318+time*.13;
  float shape=1.+.16*sin(2.*angle+phase)+.11*sin(3.*angle-phase);
  float deriv=.32*cos(2.*angle+phase)+.33*cos(3.*angle-phase);
  float q=dot(v,v)*shape; float w=exp(-2.*q);
  vec2 dq=2.*v*shape+vec2(-v.y,v.x)*deriv;
  f+=w;grad+=-2.*dq/d.z*w;tint+=color(d.w)*w;hueWeight+=w;
  vec2 sh=(p-d.xy-vec2(12.,20.))/d.z;
  shadow+=exp(-1.7*dot(sh,sh));nearest=max(nearest,w);
 }
 bg*=1.-.43*clamp(shadow,0.,1.);
 float age=time-ripple.z;
 float ring=exp(-pow((length(p-ripple.xy)-age*145.)/5.,2.))*exp(-age*2.);
 if(age>0.&&age<3.)bg+=vec3(.10,.19,.19)*ring;
 float edge=.29;float aa=.009;
 if(f>edge-aa){
  tint/=max(hueWeight,.0001);
  float height=sqrt(clamp((f-edge)/.71,0.,1.));
  vec2 outward=-normalize(grad+vec2(.00000001));
  float rim=1.-height;
  vec3 n=normalize(vec3(outward*pow(rim,.63)*1.25,.30+height));
  vec3 light=normalize(vec3(-.5,-.7,.8));
  float diffuse=max(0.,dot(n,light));
  float fresnel=pow(1.-n.z,2.2);
  float bands=sin(height*20.+dot(outward,vec2(.6,.3))*2.+time*.12);
  vec3 film=.5+.5*cos(vec3(0.,2.1,4.2)+height*12.+dot(outward,vec2(1.6,1.2))+tint*2.5);
  vec3 body=tint*(.39+diffuse*.55)+film*.14;
  body=mix(body,bg*1.4,.22+height*.15);
  body+=fresnel*(tint*.5+film*.38);
  float lip=exp(-pow((f-.315)/.023,2.));
  body+=lip*(.3+diffuse*.6)*mix(tint,vec3(.85,1.,.92),.5);
  float innerLip=exp(-pow((f-.39)/.023,2.));body-=innerLip*.13;
  // Broad studio reflections and a thin crescent make the liquid read as glass.
  float spec=pow(max(0.,dot(reflect(-light,n),vec3(0.,0.,1.))),55.);
  float soft=pow(max(0.,dot(n,normalize(vec3(-.35,-.5,1.)))),24.);
  body+=vec3(.90,.98,.90)*spec*.88+vec3(.8,.96,.93)*soft*.23;
  float crescent=pow(max(0.,dot(outward,normalize(vec2(-.6,-.8)))),10.)*exp(-pow((height-.20)/.075,2.));
  body+=vec3(.83,.95,.87)*crescent*.66;
  float reflected=pow(max(0.,dot(n,normalize(vec3(.8,.6,.25)))),14.);
  body+=film*reflected*.45;
  bg=mix(bg,body,smoothstep(edge-aa,edge+aa,f));
 }
 // Suspended pinpricks of light, sparse and nearly still.
 vec2 grid=water*100.;vec2 cell=floor(grid);float hash=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
 float dust=step(.991,hash)*exp(-90.*dot(fract(grid)-.5,fract(grid)-.5));
 bg+=dust*vec3(.11,.20,.19);
 gl_FragColor=vec4(bg,1.);
}`;

export class WaterRenderer {
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false});
  if(!gl)throw new Error('WebGL unavailable');
  const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  this.u=Object.fromEntries(['resolution','viewport','time','drops','count','palette','ripple'].map(n=>[n,gl.getUniformLocation(program,n)]));this.packed=new Float32Array(MAX_DROPS*4);
 }
 draw(drops,camera,time){
  const {gl,canvas,u}=this;const ratio=Math.min(devicePixelRatio,1.5,1500/innerWidth);
  const width=Math.round(innerWidth*ratio),height=Math.round(innerHeight*ratio);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;gl.viewport(0,0,width,height);}
  const visible=drops.filter(d=>d.y+d.r>camera.y-80&&d.y-d.r<camera.y+camera.h+80&&d.x+d.r>camera.x-80&&d.x-d.r<camera.x+camera.w+80);
  visible.forEach((d,i)=>this.packed.set([d.x-camera.x,d.y-camera.y,d.r,d.hue],i*4));
  gl.uniform2f(u.resolution,width,height);gl.uniform2f(u.viewport,camera.w,camera.h);gl.uniform1f(u.time,time);gl.uniform4fv(u.drops,this.packed);gl.uniform1i(u.count,visible.length);gl.uniform1i(u.palette,0);gl.uniform3f(u.ripple,-500,-500,-10);gl.drawArrays(gl.TRIANGLES,0,6);
 }
}
