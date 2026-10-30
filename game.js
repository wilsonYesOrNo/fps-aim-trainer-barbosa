(() => {
"use strict";

const canvas = document.getElementById("game");
const menu = document.getElementById("menu");
const pausePanel = document.getElementById("pause");
const playBtn = document.getElementById("play");
const resumeBtn = document.getElementById("resume");
const backToMenuBtn = document.getElementById("backToMenu");
const invertMouseYEl = document.getElementById("invertMouseY");
const errorBox = document.getElementById("error");
const difficultyEl = document.getElementById("difficulty");
const weaponEl = document.getElementById("weapon");
const scoreEl = document.getElementById("score");
const hitsEl = document.getElementById("hits");
const accEl = document.getElementById("acc");
const timeEl = document.getElementById("time");
const ammoEl = document.getElementById("ammo");
const weaponNameEl = document.getElementById("weaponName");
const akViewmodel = document.getElementById("akViewmodel");
const glockViewmodel = document.getElementById("glockViewmodel");
const crosshair = document.getElementById("crosshair");
const crosshairSettings = {
  size: document.getElementById("crossSize"),
  thickness: document.getElementById("crossThickness"),
  gap: document.getElementById("crossGap"),
  color: document.getElementById("crossColor")
};
const crosshairLabels = {
  size: document.getElementById("crossSizeValue"),
  thickness: document.getElementById("crossThicknessValue"),
  gap: document.getElementById("crossGapValue"),
  color: document.getElementById("crossColorValue")
};
const mouseSensitivityEl = document.getElementById("mouseSensitivity");
const sensitivityValueEl = document.getElementById("sensitivityValue");
let mouseSensitivity = 1.0;
let invertMouseY = true;
try {
  const savedSensitivity = Number(localStorage.getItem("aimTrainerMouseSensitivity"));
  if (Number.isFinite(savedSensitivity) && savedSensitivity >= 0.2 && savedSensitivity <= 5) {
    mouseSensitivity = savedSensitivity;
  }
} catch (_) {}
if (mouseSensitivityEl) mouseSensitivityEl.value = String(mouseSensitivity);
function updateSensitivityLabel() {
  if (sensitivityValueEl) sensitivityValueEl.textContent = mouseSensitivity.toFixed(2) + "x";
}
if (mouseSensitivityEl) {
  mouseSensitivityEl.addEventListener("input", () => {
    mouseSensitivity = Number(mouseSensitivityEl.value);
    updateSensitivityLabel();
    try { localStorage.setItem("aimTrainerMouseSensitivity", String(mouseSensitivity)); } catch (_) {}
  });
}
updateSensitivityLabel();

const defaultCrosshair = {size:17, thickness:2, gap:5, color:"#f1f5fb"};
let crosshairConfig = {...defaultCrosshair};
try {
  const saved = JSON.parse(localStorage.getItem("aimTrainerCrosshair") || "null");
  if (saved && typeof saved === "object") {
    if (Number.isFinite(saved.size)) crosshairConfig.size = Math.max(4, Math.min(28, saved.size));
    if (Number.isFinite(saved.thickness)) crosshairConfig.thickness = Math.max(1, Math.min(6, saved.thickness));
    if (Number.isFinite(saved.gap)) crosshairConfig.gap = Math.max(0, Math.min(18, saved.gap));
    if (typeof saved.color === "string" && /^#[0-9a-f]{6}$/i.test(saved.color)) crosshairConfig.color = saved.color;
  }
} catch (_) {}
function updateCrosshair() {
  const root = document.documentElement;
  root.style.setProperty("--cross-size", crosshairConfig.size + "px");
  root.style.setProperty("--cross-thickness", crosshairConfig.thickness + "px");
  root.style.setProperty("--cross-gap", crosshairConfig.gap + "px");
  root.style.setProperty("--cross-color", crosshairConfig.color);
  if (crosshairLabels.size) crosshairLabels.size.textContent = crosshairConfig.size + " px";
  if (crosshairLabels.thickness) crosshairLabels.thickness.textContent = crosshairConfig.thickness + " px";
  if (crosshairLabels.gap) crosshairLabels.gap.textContent = crosshairConfig.gap + " px";
  if (crosshairLabels.color) crosshairLabels.color.textContent = crosshairConfig.color.toUpperCase();
  for (const [key, input] of Object.entries(crosshairSettings)) if (input) input.value = String(crosshairConfig[key]);
  try { localStorage.setItem("aimTrainerCrosshair", JSON.stringify(crosshairConfig)); } catch (_) {}
}
for (const [key, input] of Object.entries(crosshairSettings)) {
  if (input) input.addEventListener("input", () => {
    crosshairConfig[key] = key === "color" ? input.value : Number(input.value);
    updateCrosshair();
  });
}
updateCrosshair();

function syncWeaponView(){
  const isAK=weaponEl.value==="ak";
  if(akViewmodel){
    akViewmodel.classList.toggle("hidden",!isAK);
    akViewmodel.style.display=isAK?"block":"none";
  }
  const isGlock = weaponEl.value === "glock";
  if (glockViewmodel) {
    glockViewmodel.classList.toggle("hidden", !isGlock);
    glockViewmodel.style.display = isGlock ? "block" : "none";
  }
  if(weaponNameEl)weaponNameEl.textContent=weaponEl.options[weaponEl.selectedIndex].text;
}

const gl = canvas.getContext("webgl2", {antialias:true});
if (!gl) {
  errorBox.textContent = "Seu navegador não ativou WebGL2. Atualize o Chrome/Edge/Firefox.";
  playBtn.disabled = true;
  return;
}

let width = 1, height = 1;
function resize() {
  width = innerWidth; height = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.floor(width*dpr);
  canvas.height = Math.floor(height*dpr);
  gl.viewport(0,0,canvas.width,canvas.height);
}
addEventListener("resize",resize); resize();

const vertexSource = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProj;
out vec3 vNormal;
out vec3 vWorld;
void main(){
  vec4 world=uModel*vec4(aPosition,1.0);
  vWorld=world.xyz;
  vNormal=mat3(uModel)*aNormal;
  gl_Position=uProj*uView*world;
}`;
const fragmentSource = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uGlow;
uniform vec3 uCamera;
uniform sampler2D uLogoTexture;
uniform int uUseTexture;
out vec4 outColor;
void main(){
  vec3 n=normalize(vNormal);
  vec3 light=normalize(vec3(-.45,.85,-.55));
  float diff=max(dot(n,light),0.0);
  float hemi=.5+.5*n.y;
  vec3 view=normalize(uCamera-vWorld);
  vec3 halfV=normalize(view+light);
  float spec=pow(max(dot(n,halfV),0.0),24.0)*.12;
  vec3 c=uColor*(.38+.66*diff+.12*hemi)+spec+uGlow;
  if(uUseTexture==1){
    vec2 uv=vec2(atan(n.z,n.x)/6.2831853+.5, asin(clamp(n.y,-1.0,1.0))/3.14159265+.5);
    vec3 logo=texture(uLogoTexture,uv).rgb;
    c=logo*(.52+.55*diff)+uGlow;
  }
  float dist=distance(uCamera,vWorld);
  float fog=smoothstep(18.0,44.0,dist);
  c=mix(c,vec3(.15,.18,.21),fog*.42);
  outColor=vec4(c,1.0);
}`;

function shader(type,source){
  const s=gl.createShader(type);
  gl.shaderSource(s,source); gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
  return s;
}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,vertexSource));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragmentSource));
gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
gl.useProgram(program);

const loc={
  pos:gl.getAttribLocation(program,"aPosition"),
  normal:gl.getAttribLocation(program,"aNormal"),
  model:gl.getUniformLocation(program,"uModel"),
  view:gl.getUniformLocation(program,"uView"),
  proj:gl.getUniformLocation(program,"uProj"),
  color:gl.getUniformLocation(program,"uColor"),
  glow:gl.getUniformLocation(program,"uGlow"),
  camera:gl.getUniformLocation(program,"uCamera"),
  logoTexture:gl.getUniformLocation(program,"uLogoTexture"),
  useTexture:gl.getUniformLocation(program,"uUseTexture")
};
const logoTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, logoTexture);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([20,70,180,255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const logoImage = new Image();
logoImage.onload = () => {
  gl.bindTexture(gl.TEXTURE_2D, logoTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, logoImage);
};
logoImage.src = "assets/logo-barbosa.jpeg";

function ident(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function multiply(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)
    o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function translate(x,y,z){const m=ident();m[12]=x;m[13]=y;m[14]=z;return m;}
function scale(x,y,z){const m=ident();m[0]=x;m[5]=y;m[10]=z;return m;}
function rx(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m;}
function ry(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m;}
function rz(a){const c=Math.cos(a),s=Math.sin(a),m=ident();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m;}
function trs(p,s,r){
  return multiply(multiply(multiply(translate(p.x,p.y,p.z),ry(r.y)),rx(r.x)),multiply(rz(r.z),scale(s.x,s.y,s.z)));
}
function perspective(fov,aspect,near,far){
  const f=1/Math.tan(fov/2),nf=1/(near-far),m=new Float32Array(16);
  m[0]=f/aspect;m[5]=f;m[10]=(far+near)*nf;m[11]=-1;m[14]=2*far*near*nf;return m;
}
function lookAt(p,t,u){
  const z=norm(sub(p,t)),x=norm(cross(u,z)),y=cross(z,x),m=ident();
  m[0]=x.x;m[1]=y.x;m[2]=z.x;m[4]=x.y;m[5]=y.y;m[6]=z.y;m[8]=x.z;m[9]=y.z;m[10]=z.z;
  m[12]=-dot(x,p);m[13]=-dot(y,p);m[14]=-dot(z,p);return m;
}
function V(x=0,y=0,z=0){return {x,y,z}}
function add(a,b){return V(a.x+b.x,a.y+b.y,a.z+b.z)}
function sub(a,b){return V(a.x-b.x,a.y-b.y,a.z-b.z)}
function mul(a,s){return V(a.x*s,a.y*s,a.z*s)}
function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z}
function cross(a,b){return V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x)}
function norm(a){const n=Math.hypot(a.x,a.y,a.z)||1;return mul(a,1/n)}

function createMesh(vertices,indices){
  const vao=gl.createVertexArray(),vbo=gl.createBuffer(),ibo=gl.createBuffer();
  gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(loc.pos);gl.vertexAttribPointer(loc.pos,3,gl.FLOAT,false,24,0);
  gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,24,12);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {vao,count:indices.length};
}
function cube(){
  const faces=[
    [[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1],[0,0,1]],
    [[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1],[0,0,-1]],
    [[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1],[0,1,0]],
    [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[0,-1,0]],
    [[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1],[1,0,0]],
    [[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1],[-1,0,0]]
  ];
  const v=[],i=[];
  for(let f=0;f<faces.length;f++){
    const q=faces[f],n=q[4],b=f*4;
    for(let k=0;k<4;k++)v.push(q[k][0],q[k][1],q[k][2],n[0],n[1],n[2]);
    i.push(b,b+1,b+2,b,b+2,b+3);
  }
  return createMesh(v,i);
}
function sphere(seg=20,rings=12){
  const v=[],i=[];
  for(let y=0;y<=rings;y++){
    const py=Math.cos(Math.PI*y/rings),pr=Math.sin(Math.PI*y/rings);
    for(let x=0;x<seg;x++){
      const a=2*Math.PI*x/seg,px=Math.cos(a)*pr,pz=Math.sin(a)*pr;
      v.push(px,py,pz,px,py,pz);
    }
  }
  for(let y=0;y<rings;y++)for(let x=0;x<seg;x++){
    const a=y*seg+x,b=y*seg+(x+1)%seg,c=(y+1)*seg+(x+1)%seg,d=(y+1)*seg+x;
    i.push(a,b,c,a,c,d);
  }
  return createMesh(v,i);
}
const CUBE=cube(),SPHERE=sphere();

const world=[];
const dynamic=[];
function obj(mesh,p,s,c,glow=[0,0,0],rot=V(),type="world"){return {mesh,pos:p,scale:s,color:c,glow,rot,type}}
function addBox(p,s,c,rot=V(),type="world"){world.push(obj(CUBE,p,s,c,[0,0,0],rot,type))}
const MAT={
 floor:[.48,.49,.45],wall:[.30,.35,.35],wall2:[.20,.25,.26],dark:[.025,.032,.035],
 metal:[.09,.10,.095],metal2:[.19,.20,.19],wood:[.32,.17,.08],wood2:[.46,.25,.12],
 skin:[.54,.29,.20],cyan:[.015,.22,.72],black:[.012,.014,.015]
};
function arch(x,z){
  addBox(V(x,4.2,z),V(4.0,8.4,.35),MAT.wall);
  addBox(V(x-1.75,2.25,z-.01),V(.5,4.5,.42),MAT.wall2);
  addBox(V(x+1.75,2.25,z-.01),V(.5,4.5,.42),MAT.wall2);
  for(let j=0;j<17;j++){
    const a=Math.PI*j/16,xx=x+1.45*Math.cos(a),yy=4.15+1.4*Math.sin(a);
    addBox(V(xx,yy,z-.03),V(.11,.38,.44),MAT.wall,V(0,0,-a+Math.PI/2));
  }
}
function buildWorld(){
  // Arena industrial inspirada na referência: concreto, vigas e iluminação fria.
  addBox(V(0,-.15,-8),V(42,.30,48),[.34,.36,.36]);
  // Faixa de limite do estande: marca visual amarela/preta no chão.
  addBox(V(0,.035,4),V(20.5,.025,.20),MAT.black);
  for(let x=-20;x<20;x+=1.6){
    addBox(V(x+.8,.055,4),V(.62,.018,.205),[.92,.62,.06],V(0,0,-.12));
  }
  // Pequenas marcações de posição para a linha de tiro.
  for(const x of [-3,-1.5,0,1.5,3]){
    addBox(V(x,.045,5.1),V(.035,.012,.42),[.72,.76,.74]);
  }
  // Bancada/balcão do estande: tampo escuro com borda azul e suportes metálicos.
  // Fica baixo no campo de visão para manter os alvos visíveis por cima.
  addBox(V(0,1.02,5.72),V(17.2,.20,.92),[.075,.095,.115]); // tampo
  addBox(V(0,1.135,5.72),V(17.25,.045,.94),[.16,.42,.78]); // acabamento azul
  addBox(V(0,.90,5.72),V(16.9,.10,.78),[.10,.13,.16]); // saia frontal
  for(const x of [-7.8,-4.0,0,4.0,7.8]){
    addBox(V(x,.49,5.72),V(.18,.78,.72),[.19,.23,.26]); // pés metálicos
    addBox(V(x,.12,5.72),V(.52,.10,.88),[.10,.13,.16]); // bases
  }
  // Pequenas marcas azuis na frente da bancada, como identificação do estande.
  for(const x of [-1.1,-.55,0,.55,1.1]){
    addBox(V(x,.91,5.245),V(.30,.035,.025),[.24,.55,.98]);
  }
  for(let x=-20;x<=20;x+=2)addBox(V(x,.01,-8),V(.018,.025,48),[.20,.21,.20]);
  for(let z=-30;z<=15;z+=2)addBox(V(0,.01,z),V(42,.025,.018),[.20,.21,.20]);
  addBox(V(0,4.8,-31),V(42,9.6,.35),MAT.wall2);
  addBox(V(-20.8,4.8,-8),V(.35,9.6,46),MAT.wall2);
  addBox(V(20.8,4.8,-8),V(.35,9.6,46),MAT.wall2);
  // Mureta física na extremidade frontal, cobrindo o limite que antes parecia invisível.
  addBox(V(0,.62,15.0),V(42,1.24,.42),[.22,.27,.30]);
  addBox(V(0,1.27,14.98),V(42,.10,.58),[.36,.41,.43]);
  // Painel de acabamento na face interna da mureta.
  addBox(V(0,.34,14.77),V(41.4,.12,.045),[.10,.15,.19]);
  addBox(V(0,9.25,-8),V(42,.35,46),MAT.wall);
  // Painéis modulares das paredes laterais.
  for(const z of [-3,-9,-15,-21,-27]){
    for(const side of [-1,1]){
      const x=side*20.52;
      addBox(V(x,3.2,z),V(.16,5.8,5.4),[.22,.25,.27]);
      addBox(V(side*20.40,3.2,z-2.68),V(.08,5.8,.10),[.12,.15,.18]);
      addBox(V(side*20.40,3.2,z+2.68),V(.08,5.8,.10),[.12,.15,.18]);
    }
  }
  // Vigas repetidas no teto, como a estrutura metálica da imagem.
  for(const z of [13,8,3,-2,-7,-12,-17,-22,-27]){
    addBox(V(0,9.02,z),V(41.2,.22,.30),[.075,.09,.12]);
    addBox(V(0,8.80,z),V(41.2,.07,.12),[.13,.16,.20]);
  }
  // Trilhos e painéis longitudinais no teto.
  for(const x of [-18,-13,-8,-3,3,8,13,18]){
    addBox(V(x,9.12,-8),V(.16,.18,43),[.09,.11,.14]);
  }
  // Barras de luz brancas frias nas laterais e no teto.
  for(const z of [-1,-8,-15,-22]){
    for(const side of [-1,1]){
      addBox(V(side*19.95,5.3,z),V(.10,2.55,.24),[.78,.86,.94]);
      addBox(V(side*19.86,5.3,z),V(.06,2.15,.12),[.45,.66,.90]);
    }
  }
  for(const z of [6,-5,-16,-25]){
    addBox(V(0,8.86,z),V(.34,.06,2.8),[.80,.87,.96]);
    addBox(V(0,8.82,z),V(.18,.045,2.25),[.46,.66,.92]);
  }
  // Letreiro físico 3D “2.DS” montado diretamente na parede do fundo.
  // Segmentos em caixas finas voltadas para a área de tiro.
  const signColor=[.42,.72,1.0];
  const zSign=-30.72, cy=8.05, sw=.82, sh=.78, thick=.105, gap=.20;
  function seg(x,y,w,h){addBox(V(x,y,zSign),V(w,h,.075),signColor);}
  function digit2(cx){seg(cx,cy+sh/2,sw,thick);seg(cx,cy,sw,thick);seg(cx,cy-sh/2,sw,thick);seg(cx-sw/2,cy+sh/4,thick,sh/2);seg(cx+sw/2,cy-sh/4,thick,sh/2);}
  function letterD(cx){seg(cx-sw/2,cy,thick,sh);seg(cx+sw/2,cy,thick,sh);seg(cx,cy+sh/2,sw,thick);seg(cx,cy-sh/2,sw,thick);}
  function letterS(cx){seg(cx,cy+sh/2,sw,thick);seg(cx,cy,sw,thick);seg(cx,cy-sh/2,sw,thick);seg(cx-sw/2,cy+sh/4,thick,sh/2);seg(cx+sw/2,cy-sh/4,thick,sh/2);}
  const startX=-1.45;
  digit2(startX);
  letterD(startX+1.75); seg(startX+2.35,cy-sh/2-.16,.13,.13); letterS(startX+2.95);
  // Identificação 2.DS também nas duas paredes laterais, em painéis voltados para dentro.
  function sideSeg(side,z,y,w,h){addBox(V(side*20.56,y,z),V(.085,h,w),signColor);}
  function sideMark(side,centerZ){
    const yy=5.75, ww=.70, hh=.68, tt=.095;
    const bar=(z,y,w,h)=>sideSeg(side,z,y,w,h);
    const d2=(c)=>{bar(c,yy+hh/2,ww,tt);bar(c,yy,ww,tt);bar(c,yy-hh/2,ww,tt);bar(c-ww/2,yy+hh/4,tt,hh/2);bar(c+ww/2,yy-hh/4,tt,hh/2)};
    const d=(c)=>{bar(c-ww/2,yy,tt,hh);bar(c+ww/2,yy,tt,hh);bar(c,yy+hh/2,ww,tt);bar(c,yy-hh/2,ww,tt)};
    const ss=(c)=>{bar(c,yy+hh/2,ww,tt);bar(c,yy,ww,tt);bar(c,yy-hh/2,ww,tt);bar(c-ww/2,yy+hh/4,tt,hh/2);bar(c+ww/2,yy-hh/4,tt,hh/2)};
    d2(centerZ-1.25); d(centerZ-.05); bar(centerZ+.53,yy-hh/2-.13,.11,.11); ss(centerZ+1.18);
  }
  sideMark(-1,-13);
  sideMark(1,-13);
  sideMark(-1,1);
  sideMark(1,1);
  // Letreiros adicionais maiores e bem visíveis: 2.DS em azul nas paredes laterais.
  function wallLabel(side, centerZ){
    const yy=6.55, ww=1.05, hh=.92, tt=.13;
    const bar=(z,y,w,h)=>sideSeg(side,z,y,w,h);
    const d2=(c)=>{bar(c,yy+hh/2,ww,tt);bar(c,yy,ww,tt);bar(c,yy-hh/2,ww,tt);bar(c-ww/2,yy+hh/4,tt,hh/2);bar(c+ww/2,yy-hh/4,tt,hh/2)};
    const d=(c)=>{bar(c-ww/2,yy,tt,hh);bar(c+ww/2,yy,tt,hh);bar(c,yy+hh/2,ww,tt);bar(c,yy-hh/2,ww,tt)};
    const ss=(c)=>{bar(c,yy+hh/2,ww,tt);bar(c,yy,ww,tt);bar(c,yy-hh/2,ww,tt);bar(c-ww/2,yy+hh/4,tt,hh/2);bar(c+ww/2,yy-hh/4,tt,hh/2)};
    d2(centerZ-1.85); d(centerZ-.35); bar(centerZ+.45,yy-hh/2-.17,.15,.15); ss(centerZ+1.35);
  }
  wallLabel(-1,-7.5); wallLabel(1,-7.5);
  // Identificação azul “2.DS” aplicada na face frontal do balcão do estande.
  const benchBlue=[.24,.58,1.0], by=.91, bz=5.205, bw=.29, bh=.25, bt=.035;
  function benchSeg(x,y,w,h){addBox(V(x,y,bz),V(w,h,.035),benchBlue);}
  function bench2(cx){benchSeg(cx,by+bh/2,bw,bt);benchSeg(cx,by,bw,bt);benchSeg(cx,by-bh/2,bw,bt);benchSeg(cx-bw/2,by+bh/4,bt,bh/2);benchSeg(cx+bw/2,by-bh/4,bt,bh/2);}
  function benchD(cx){benchSeg(cx-bw/2,by,bt,bh);benchSeg(cx+bw/2,by,bt,bh);benchSeg(cx,by+bh/2,bw,bt);benchSeg(cx,by-bh/2,bw,bt);}
  function benchS(cx){benchSeg(cx,by+bh/2,bw,bt);benchSeg(cx,by,bw,bt);benchSeg(cx,by-bh/2,bw,bt);benchSeg(cx-bw/2,by+bh/4,bt,bh/2);benchSeg(cx+bw/2,by-bh/4,bt,bh/2);}
  bench2(-.75); benchD(-.27); benchSeg(.03,by-bh/2-.04,.045,.045); benchS(.42);
  // Grande esfera azul-escura de marca abaixo do letreiro.
  world.push(obj(SPHERE,V(0,4.05,-27.4),V(3.35,3.35,3.35),[.018,.035,.075],[.015,.055,.16],V(),"logoSphere"));
  // Aro de suporte discreto ao redor da esfera.
  addBox(V(0,.24,-27.4),V(7.8,.12,.55),[.075,.10,.15]);
  // Estrutura do fundo, sem caixas que obstruam os alvos.
  addBox(V(0,4.8,-31),V(42,9.6,.35),[.16,.19,.22]);
}
buildWorld();

const settings={
 easy:{r:.47,spawn:.80,speed:.32,max:14,spread:.001},
 normal:{r:.34,spawn:.63,speed:.58,max:18,spread:.0018},
 hard:{r:.25,spawn:.49,speed:.90,max:22,spread:.003},
 insane:{r:.17,spawn:.37,speed:1.35,max:26,spread:.0042}
};

const player={pos:V(0,1.65,8),yaw:0,pitch:0};
const keys={};
let targets=[];
let hitParticles=[];
let active=false,paused=false,last=performance.now(),round=60,spawnTimer=0,fireTimer=0,recoil=0;
let score=0,hits=0,shots=0,ammo=30,velocity=V();
let reloading=false,reloadUntil=0,firePatternIndex=0;
let lastShotFx=0;

function forward(){
  const cp=Math.cos(player.pitch),sp=Math.sin(player.pitch),cy=Math.cos(player.yaw),sy=Math.sin(player.yaw);
  return norm(V(sy*cp,sp,-cy*cp));
}
function rightVec(){return norm(cross(forward(),V(0,1,0)))}
function upVec(){return norm(cross(rightVec(),forward()))}
function viewMatrix(){return lookAt(player.pos,add(player.pos,forward()),V(0,1,0))}

function burstHit(pos){
  const count=16;
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2;
    const z=(Math.random()*2-1);
    const r=Math.sqrt(Math.max(0,1-z*z));
    const speed=.8+Math.random()*2.0;
    hitParticles.push({
      pos:V(pos.x,pos.y,pos.z),
      vel:V(Math.cos(a)*r*speed,z*speed,Math.sin(a)*r*speed),
      life:.24+Math.random()*.28,
      max:.52,
      size:.018+Math.random()*.026,
      kind:i%3
    });
  }
}
function burstMuzzle(direction) {
  // Pequenos estilhaços luminosos saem do cano da AK a cada disparo.
  const muzzle = add(player.pos, add(add(mul(rightVec(), .58), mul(upVec(), -.28)), mul(forward(), .92)));
  const count = 10;
  for (let i = 0; i < count; i++) {
    const spread = V((Math.random() - .5) * 3.2, (Math.random() - .5) * 2.5, (Math.random() - .5) * 3.2);
    const velocity = add(mul(direction, 5 + Math.random() * 7), spread);
    const life = .07 + Math.random() * .15;
    hitParticles.push({
      pos: V(muzzle.x, muzzle.y, muzzle.z),
      vel: velocity,
      life,
      max: .22,
      size: .012 + Math.random() * .018,
      kind: i % 2
    });
  }
}
function updateHitParticles(dt){
  for(let i=hitParticles.length-1;i>=0;i--){
    const p=hitParticles[i];
    p.life-=dt;
    p.vel.y-=3.8*dt;
    p.pos.x+=p.vel.x*dt;p.pos.y+=p.vel.y*dt;p.pos.z+=p.vel.z*dt;
    if(p.life<=0)hitParticles.splice(i,1);
  }
}
function drawHitParticles(){
  for(const p of hitParticles){
    const k=Math.max(0,p.life/p.max);
    const s=p.size*(.65+k*1.7);
    const glow=p.kind===0?[1.0,.26,.04]:p.kind===1?[1.0,.72,.10]:[.75,.92,1.0];
    const color=p.kind===2?[.55,.82,1.0]:[1,.32,.07];
    addDynamic(obj(SPHERE,p.pos,V(s,s,s),color,glow.map(v=>v*.95*k),V(),"hitParticle"));
  }
}
function updateHud(){
  scoreEl.textContent=String(score);hitsEl.textContent=String(hits);
  accEl.textContent=(shots?Math.round(hits/shots*100):100)+"%";
  ammoEl.textContent=String(ammo);
  weaponNameEl.textContent=weaponEl.options[weaponEl.selectedIndex].text;
  timeEl.textContent="0:"+String(Math.max(0,Math.ceil(round))).padStart(2,"0");
}
function clearDynamic(){dynamic.length=0}
function addDynamic(o){dynamic.push(o)}
function spawnTarget(){
  const s=settings[difficultyEl.value];
  targets.push({
    pos:V((Math.random()-.5)*15.5,.85+Math.random()*3.4,-5-Math.random()*22),
    vel:V((Math.random()-.5)*s.speed,(Math.random()-.5)*s.speed*.36,(Math.random()-.5)*.15),
    r:s.r,age:0
  });
}
function buildDynamic(){
  clearDynamic();
  for(const t of targets){
    const pulse=1+Math.sin(t.age*5)*.04;
    addDynamic(obj(SPHERE,t.pos,V(t.r*pulse,t.r*pulse,t.r*pulse),MAT.cyan,[.015,.12,.38],V(),"target"));
  }
  const f=forward(),r=rightVec(),u=upVec();
  const selected=weaponEl.value;
  const kick=recoil;
  const bob=Math.sin(performance.now()*.007)*.008;
  // Para AK-47, usa exatamente a imagem enviada pelo usuário como viewmodel.
  if(selected === "ak" || selected === "glock") {
    syncWeaponView();
    return;
  }
  syncWeaponView();
  const lift=Math.abs(Math.sin(performance.now()*.007))*-.006;
  function wp(x,y,z,s,c,rot=V()){
    const p=add(player.pos,add(add(mul(r,x),mul(u,y+bob)),mul(f,z)));
    return obj(CUBE,p,s,c,[0,0,0],V(rot.x+player.pitch,rot.y+player.yaw,rot.z),"weapon");
  }
  if(selected==="ak"){
    addDynamic(wp(.37,-.31,.68,V(.70,.22,.17),MAT.metal,V(.02,0,-.035)));
    addDynamic(wp(-.05,-.30,.64,V(.48,.19,.18),MAT.wood2,V(.02,0,-.06)));
    addDynamic(wp(.10,-.22,.67,V(.35,.07,.08),MAT.wood,V(0,0,-.03)));
    addDynamic(wp(.64,-.35,.72,V(.14,.36,.14),MAT.black,V(.08,0,.1)));
    addDynamic(wp(.52,-.60,.69,V(.12,.47,.12),MAT.dark,V(.14,0,.04)));
    addDynamic(wp(.28,-.50,.68,V(.10,.36,.10),MAT.dark,V(-.12,0,-.1)));
    addDynamic(wp(1.02,-.29,.72,V(.70,.058,.058),MAT.black));
    addDynamic(wp(1.40,-.29,.72,V(.10,.078,.078),MAT.metal2));
    addDynamic(wp(.58,-.08,.68,V(.15,.07,.10),MAT.metal2));
  }else if(selected==="m4"){
    addDynamic(wp(.36,-.31,.68,V(.72,.22,.17),MAT.metal));
    addDynamic(wp(-.05,-.30,.65,V(.46,.18,.18),MAT.dark));
    addDynamic(wp(.58,-.31,.70,V(.48,.13,.13),MAT.metal2));
    addDynamic(wp(1.04,-.31,.72,V(.58,.05,.05),MAT.black));
    addDynamic(wp(.63,-.60,.70,V(.12,.46,.12),MAT.black,V(.14,0,.05)));
  }else{
    addDynamic(wp(.20,-.31,.62,V(.45,.16,.16),MAT.black));
    addDynamic(wp(.04,-.49,.62,V(.20,.38,.14),MAT.dark,V(.14,0,-.04)));
    addDynamic(wp(.52,-.31,.63,V(.25,.07,.11),MAT.metal2));
    addDynamic(wp(.68,-.31,.64,V(.20,.045,.045),MAT.black));
  }
  const hl=add(player.pos,add(add(mul(r,-.06),mul(u,-.58)),mul(f,.52)));
  const hr=add(player.pos,add(add(mul(r,.52),mul(u,-.58)),mul(f,.55)));
  addDynamic(obj(SPHERE,hl,V(.19,.12,.16),MAT.skin,[0,0,0],V(),"arms"));
  addDynamic(obj(SPHERE,hr,V(.19,.12,.16),MAT.skin,[0,0,0],V(),"arms"));
  if(recoil>.006){
    const mp=add(player.pos,add(add(mul(r,selected==="glock"?.88:1.45),mul(u,-.28-recoil*.22)),mul(f,.70)));
    addDynamic(obj(SPHERE,mp,V(recoil*1.7,recoil*1.7,recoil*1.7),[1,.47,.05],[1,.18,.015],V(),"flash"));
  }
}
function drawObject(o,view,proj){
  gl.bindVertexArray(o.mesh.vao);
  gl.uniformMatrix4fv(loc.model,false,trs(o.pos,o.scale,o.rot));
  gl.uniform3fv(loc.color,new Float32Array(o.color));
  gl.uniform3fv(loc.glow,new Float32Array(o.glow));
  gl.uniform3f(loc.camera,player.pos.x,player.pos.y,player.pos.z);
  gl.uniform1i(loc.logoTexture, 0);
  gl.uniform1i(loc.useTexture, (o.type === "target" || o.type === "logoSphere") ? 1 : 0);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, logoTexture);
  gl.drawElements(gl.TRIANGLES,o.mesh.count,gl.UNSIGNED_SHORT,0);
}
function render(){
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  gl.clearColor(.055,.075,.083,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const view=viewMatrix(),proj=perspective(72*Math.PI/180,width/height,.05,100);
  gl.useProgram(program);gl.uniformMatrix4fv(loc.view,false,view);gl.uniformMatrix4fv(loc.proj,false,proj);
  for(const o of world)drawObject(o,view,proj);
  buildDynamic();
  drawHitParticles();
  for(const o of dynamic)drawObject(o,view,proj);
}
function resetRound(){
  syncWeaponView();
  score=0;hits=0;shots=0;ammo=30;round=60;spawnTimer=0;fireTimer=0;recoil=0;
  targets=[];player.pos=V(0,1.65,8);player.yaw=0;player.pitch=0;updateHud();
}
function startRound(){
  try{
    resetRound();
    active=true;paused=false;
    menu.style.display="none";pausePanel.style.display="none";
    errorBox.textContent="";
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
    try{canvas.requestPointerLock?.()}catch(_){}
    last=performance.now();
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(loop);
  }catch(e){
    active=false;
    menu.style.display="flex";
    errorBox.textContent="Erro ao iniciar: "+(e?.message||"recarregue a página.");
  }
}
function finishRound(){
  active=false;paused=false;document.exitPointerLock?.();
  if(akViewmodel)akViewmodel.classList.remove("shoot","reload","walk");if(glockViewmodel)glockViewmodel.classList.remove("shoot","reload","walk");
  menu.style.display="flex";pausePanel.style.display="none";
  document.getElementById("menuTitle").textContent=score+" PONTOS";
  document.getElementById("menuText").textContent="Treino encerrado · "+hits+" acertos · "+shots+" tiros · "+(shots?Math.round(hits/shots*100):100)+"% de precisão.";
  playBtn.textContent="JOGAR NOVAMENTE";
  render();
}
function togglePause(){
  if(!active)return;
  paused=!paused;
  pausePanel.style.display=paused?"flex":"none";
  if(paused)document.exitPointerLock?.();
  else{try{canvas.requestPointerLock?.()}catch(_){} last=performance.now()}
}
function updatePlayer(dt){
  const fwd=(keys.KeyW?1:0)-(keys.KeyS?1:0);
  const str=(keys.KeyD?1:0)-(keys.KeyA?1:0);
  const m=Math.hypot(fwd,str)||1;
  const sp=4.7*((keys.ShiftLeft||keys.ShiftRight)?1.3:1);
  const f=forward(),r=rightVec();
  velocity.x=(f.x*fwd+r.x*str)/m*sp;
  velocity.z=(f.z*fwd+r.z*str)/m*sp;
  player.pos.x=Math.max(-17,Math.min(17,player.pos.x+velocity.x*dt));
  // O jogador fica atrás da linha do estande; não pode avançar para a área dos alvos.
  player.pos.z=Math.max(4.35,Math.min(12,player.pos.z+velocity.z*dt));
}
function raySphere(o,d,t){
  const oc=sub(o,t.pos),b=dot(oc,d),c=dot(oc,oc)-t.r*t.r,h=b*b-c;
  if(h<0)return Infinity;
  const q=-b-Math.sqrt(h);return q>0?q:Infinity;
}
let audioCtx=null;
function shotSound(){
  try{
    if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume();
    const n=audioCtx.currentTime;

    /* Som original de fuzil curto e seco, inspirado em FPS clássico.
       Não usa nem reproduz o arquivo de áudio de nenhum jogo comercial. */
    const master=audioCtx.createGain();
    master.gain.setValueAtTime(.0001,n);
    master.gain.exponentialRampToValueAtTime(.42,n+.002);
    master.gain.exponentialRampToValueAtTime(.0001,n+.17);

    const body=audioCtx.createOscillator();
    body.type="sawtooth";
    body.frequency.setValueAtTime(125,n);
    body.frequency.exponentialRampToValueAtTime(46,n+.11);

    const crack=audioCtx.createOscillator();
    crack.type="square";
    crack.frequency.setValueAtTime(760,n);
    crack.frequency.exponentialRampToValueAtTime(120,n+.045);

    const sub=audioCtx.createOscillator();
    sub.type="sine";
    sub.frequency.setValueAtTime(68,n);
    sub.frequency.exponentialRampToValueAtTime(35,n+.13);

    const filter=audioCtx.createBiquadFilter();
    filter.type="lowpass";
    filter.frequency.setValueAtTime(2400,n);
    filter.frequency.exponentialRampToValueAtTime(700,n+.13);
    filter.Q.value=.45;

    body.connect(filter);crack.connect(filter);sub.connect(filter);
    filter.connect(master);master.connect(audioCtx.destination);

    body.start(n);crack.start(n);sub.start(n);
    body.stop(n+.18);crack.stop(n+.08);sub.stop(n+.17);

    /* Estalo curto de ar para dar ataque ao disparo. */
    const buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.055),audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const env=1-i/data.length;
      data[i]=(Math.random()*2-1)*env;
    }
    const noise=audioCtx.createBufferSource();
    const ng=audioCtx.createGain();
    const nf=audioCtx.createBiquadFilter();
    nf.type="bandpass";nf.frequency.value=1750;nf.Q.value=.8;
    ng.gain.setValueAtTime(.0001,n);
    ng.gain.exponentialRampToValueAtTime(.20,n+.001);
    ng.gain.exponentialRampToValueAtTime(.0001,n+.055);
    noise.buffer=buffer;noise.connect(nf);nf.connect(ng);ng.connect(audioCtx.destination);noise.start(n);
  }catch(_){}
}
function hitSound(){
  try{
    if(!audioCtx)return;
    if(audioCtx.state==="suspended")audioCtx.resume();
    const n=audioCtx.currentTime;

    const g=audioCtx.createGain();
    g.gain.setValueAtTime(.0001,n);
    g.gain.exponentialRampToValueAtTime(.18,n+.004);
    g.gain.exponentialRampToValueAtTime(.0001,n+.18);

    const low=audioCtx.createOscillator();
    low.type="sine";
    low.frequency.setValueAtTime(180,n);
    low.frequency.exponentialRampToValueAtTime(92,n+.14);

    const ping=audioCtx.createOscillator();
    ping.type="triangle";
    ping.frequency.setValueAtTime(690,n);
    ping.frequency.exponentialRampToValueAtTime(980,n+.09);

    const filter=audioCtx.createBiquadFilter();
    filter.type="lowpass";filter.frequency.value=2200;

    low.connect(g);ping.connect(filter);filter.connect(g);g.connect(audioCtx.destination);
    low.start(n);ping.start(n);low.stop(n+.2);ping.stop(n+.12);

    const buffer=audioCtx.createBuffer(1,Math.floor(audioCtx.sampleRate*.075),audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){
      const env=Math.pow(1-i/data.length,2);
      data[i]=(Math.random()*2-1)*env;
    }
    const noise=audioCtx.createBufferSource(),ng=audioCtx.createGain(),nf=audioCtx.createBiquadFilter();
    nf.type="highpass";nf.frequency.value=1200;
    ng.gain.setValueAtTime(.0001,n);ng.gain.exponentialRampToValueAtTime(.08,n+.002);ng.gain.exponentialRampToValueAtTime(.0001,n+.075);
    noise.buffer=buffer;noise.connect(nf);nf.connect(ng);ng.connect(audioCtx.destination);noise.start(n);
  }catch(_){}
}
function shoot(){
  if(!active||paused||reloading||fireTimer>0)return;
  if(ammo<=0){reload();return}
  const s=settings[difficultyEl.value],weapon=weaponEl.value;
  const moving=Math.hypot(velocity.x,velocity.z)>1.0;
  let baseSpread=s.spread*(weapon==="glock"?1.3:weapon==="m4"?.85:1)*(moving?1.35:1);
  baseSpread*=1+Math.min(.75,recoil*7);

  /* Padrão simétrico: os deslocamentos alternam esquerda/direita
     e cima/baixo, evitando que a dispersão fique viciada para um lado. */
  const pattern=[[-1,-.35],[1,.35],[-.55,.8],[.55,-.8],[-.8,.15],[.8,-.15],[0,-1],[0,1]];
  const q=pattern[firePatternIndex%pattern.length];
  firePatternIndex++;
  const jitter=0.42;
  const sx=(q[0]+(Math.random()*2-1)*jitter)*baseSpread;
  const sy=(q[1]+(Math.random()*2-1)*jitter)*baseSpread;
  const r=rightVec(),u=upVec(),f=forward();
  const dir=norm(add(add(f,mul(r,sx)),mul(u,sy)));

  shots++;ammo--;recoil=Math.min(.14,recoil+.052);
  fireTimer=weapon==="glock"?.16:weapon==="m4"?.085:.105;
  lastShotFx=performance.now();
  shotSound();
  if (weapon === "ak") burstMuzzle(dir);
  if(akViewmodel&&weapon==="ak"){
    akViewmodel.classList.remove("reload","shoot");
    void akViewmodel.offsetWidth;
    akViewmodel.classList.add("shoot");
  }
  if(glockViewmodel&&weapon==="glock"){
    glockViewmodel.classList.remove("reload","shoot");
    void glockViewmodel.offsetWidth;
    glockViewmodel.classList.add("shoot");
  }

  let bi=-1,bd=Infinity;
  for(let i=0;i<targets.length;i++){const d=raySphere(player.pos,dir,targets[i]);if(d<bd){bd=d;bi=i}}
  if(bi>=0){
    const t=targets[bi];
    score+=Math.round(85+Math.max(0,25-bd*1.4)+(1/s.r)*6);
    hits++;burstHit(t.pos);targets.splice(bi,1);hitSound();
    crosshair?.classList.remove("hit");void crosshair?.offsetWidth;crosshair?.classList.add("hit");
  }
  updateHud();
}
function reload(){
  if(!active||paused||reloading||ammo>=30)return;
  reloading=true;reloadUntil=performance.now()+720;fireTimer=.72;
  if(akViewmodel&&weaponEl.value==="ak"){
    akViewmodel.classList.remove("shoot");
    void akViewmodel.offsetWidth;
    akViewmodel.classList.add("reload");
  }
  if(glockViewmodel&&weaponEl.value==="glock"){
    glockViewmodel.classList.remove("shoot");
    void glockViewmodel.offsetWidth;
    glockViewmodel.classList.add("reload");
  }
}
function completeReload(){
  if(reloading&&performance.now()>=reloadUntil){reloading=false;ammo=30;if(akViewmodel)akViewmodel.classList.remove("reload");if(glockViewmodel)glockViewmodel.classList.remove("reload");updateHud()}
}
let raf=0;
function loop(now){
  if(!active){render();return}
  const dt=Math.min(.035,(now-last)/1000);last=now;
  if(!paused){
    updateHitParticles(dt);
    round-=dt;if(round<=0){round=0;updateHud();finishRound();return}
    updatePlayer(dt);spawnTimer+=dt;fireTimer=Math.max(0,fireTimer-dt); completeReload();
    if(akViewmodel&&weaponEl.value==="ak"&&!reloading){
      const walking=Math.hypot(velocity.x,velocity.z)>0.5;
      akViewmodel.classList.toggle("walk",walking);
    }
    if(akViewmodel&&weaponEl.value==="ak"&&performance.now()-lastShotFx>140) akViewmodel.classList.remove("shoot");
    if(glockViewmodel&&weaponEl.value==="glock"&&performance.now()-lastShotFx>140) glockViewmodel.classList.remove("shoot");
    if(spawnTimer>=settings[difficultyEl.value].spawn && targets.length<settings[difficultyEl.value].max){spawnTimer=0;spawnTarget()}
    for(const t of targets){t.age+=dt;t.pos.x+=t.vel.x*dt;t.pos.y+=t.vel.y*dt;t.pos.z+=t.vel.z*dt;if(t.pos.y<.55||t.pos.y>4.7)t.vel.y*=-1;if(Math.abs(t.pos.x)>17)t.vel.x*=-1}
    targets=targets.filter(t=>t.age<14&&t.pos.z<13);
    recoil*=Math.pow(.0004,dt);updateHud();
  }
  render();raf=requestAnimationFrame(loop);
}

addEventListener("keydown",e=>{
  keys[e.code]=true;
  if(e.code==="Space"&&!e.repeat){e.preventDefault();togglePause()}
  if(e.code==="KeyR"&&!e.repeat){e.preventDefault();reload()}
});
addEventListener("keyup",e=>keys[e.code]=false);
canvas.addEventListener("mousedown",e=>{
  if(!active||paused)return;
  if(e.button===0){
    if(document.pointerLockElement!==canvas){ try{canvas.requestPointerLock?.()}catch(_){} }
    shoot();
  }
});
canvas.addEventListener("click",()=>{
  if(active&&!paused&&document.pointerLockElement!==canvas){try{canvas.requestPointerLock?.()}catch(_) {}}
});
document.addEventListener("mousemove",e=>{
  if(!active||paused||document.pointerLockElement!==canvas)return;
  player.yaw+=e.movementX*.0018*mouseSensitivity;
  player.pitch+=(invertMouseY?1:-1)*e.movementY*.0018*mouseSensitivity; /* opção de inverter o eixo vertical */
  player.pitch=Math.max(-1.20,Math.min(1.20,player.pitch));
});
difficultyEl.addEventListener("change",updateHud);
weaponEl.addEventListener("change",()=>{syncWeaponView();updateHud();});
playBtn.addEventListener("click",startRound);
resumeBtn.addEventListener("click",togglePause);
if(invertMouseYEl) invertMouseYEl.addEventListener("change",()=>{invertMouseY=invertMouseYEl.checked;});
function returnToMenu(){
  active=false; paused=false; keys.KeyW=keys.KeyA=keys.KeyS=keys.KeyD=false;
  try{document.exitPointerLock?.()}catch(_){}
  pausePanel.style.display="none"; menu.style.display="flex";
  document.getElementById("menuTitle").textContent="Treino 3D";
  document.getElementById("menuText").textContent="Configure seu treino, confira os controles e entre na arena.";
  playBtn.textContent="ENTRAR NA PARTIDA";
  if(akViewmodel)akViewmodel.classList.remove("shoot","reload","walk");
  if(glockViewmodel)glockViewmodel.classList.remove("shoot","reload","walk");
  render();
}
if(backToMenuBtn)backToMenuBtn.addEventListener("click",returnToMenu);

updateHud();
syncWeaponView();
render();
})();
