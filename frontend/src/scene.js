import * as T from 'three';

const mat = color => new T.MeshStandardMaterial({color, roughness:0.88, flatShading:true});
const box = new T.BoxGeometry(1,1,1);
const dummy = new T.Object3D();
const up = new T.Vector3(0,1,0);
const color = new T.Color();
const clamp = T.MathUtils.clamp;
const vector = (x,y,z) => new T.Vector3(x,y,z);
const tone = (value,min,max) => clamp((value-min)/(max-min),0,1);
function random(seed) {
  return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
}
function cube(parent, material, x,y,z,w,h,d) {
  const mesh = new T.Mesh(box,material);
  mesh.position.set(x,y,z);
  mesh.scale.set(w,h,d);
  parent.add(mesh);
  return mesh;
}
function beam(parent, material, a,b,width,depth=width) {
  const mid = a.clone().lerp(b,0.5);
  const mesh = cube(parent,material,mid.x,mid.y,mid.z,width,a.distanceTo(b),depth);
  mesh.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());
  return mesh;
}
const height = (x,z) => {
  const center = -55 + 26*Math.sin(x/195);
  const wall = Math.min(145,Math.abs(z-center)*0.38);
  return -30+wall*(0.5+0.15*Math.sin(x/106)+0.12*Math.cos(z/68))
    + 10*Math.sin((x+z*0.4)/90)+8*Math.cos(x/47)*Math.sin(z/72);
};

function surface(scene,{x0,x1,z0,z1,nx,nz,elevation,shade,seed}) {
  const rng = random(seed), points = [];
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++){
    const x = x0+(x1-x0)*(i+(i && i<nx ? (rng()-0.5)*0.8 : 0))/nx;
    const z = z0+(z1-z0)*(j+(j && j<nz ? (rng()-0.5)*0.8 : 0))/nz;
    points.push([x,elevation(x,z),z]);
  }
  const positions = [], colors = [];
  const tri = ids => {
    const y = ids.reduce((sum,i)=>sum+points[i][1],0)/3;
    color.set(shade(y,rng(),points[ids[0]][0],points[ids[0]][2]));
    color.multiplyScalar(0.83+rng()*0.3);
    for(const i of ids){ positions.push(...points[i]); colors.push(color.r,color.g,color.b); }
  };
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    tri([a,c,b]); tri([b,c,d]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  scene.add(new T.Mesh(geometry,new T.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true,side:T.DoubleSide})));
}

const routeY = x => 37 + (x+310)*0.066 + 1550 * (Math.cosh(x/1550)-1);
const path = [];
let length = 0;
for(let i=0;i<=620;i++){
  const x = i-310, point = vector(x,routeY(x),0);
  if(i) length += point.distanceTo(path[i-1].point);
  path.push({point,s:length});
}
const launch = path[203].s;
function route(s,z=0) {
  s = clamp(s,0,length);
  let a=0,b=620;
  while(b-a>1){const m=(a+b)>>1;if(path[m].s<=s)a=m;else b=m;}
  const p = path[a].point.clone().lerp(path[b].point,(s-path[a].s)/(path[b].s-path[a].s));
  p.z=z;
  return p;
}

function station(scene,x) {
  const y=routeY(x)-12, z=-2.5, g=new T.Group();
  const body=mat(0x546476), roof=mat(0xb1b7be), glass=mat(0x1b333d), trim=mat(0xcc7949);
  cube(g,body,x,y,z,33,15,32);
  cube(g,roof,x,y+8,z,37,2,36);
  cube(g,glass,x,y+3,14,27,6,0.4);
  cube(g,trim,x,y+7,15,36,1,0.6);
  for(const dx of [-12,12]) cube(g,body,x+dx,(height(x,0)+y)/2,z,4,y-height(x,0),5);
  scene.add(g);
}

function towers(scene) {
  const sets = [-236,-34,161,267].map(x=>{
    const y=routeY(x), bottom=height(x,0);
    return [[x,(y+bottom)/2,0,3.4,y-bottom,3.4],[x,y+1.2,-2.6,5,2.2,24],[x,bottom+1,0,9,3,9],[x,y-3,-2.6,5,1.8,14]];
  });
  const struts = new T.InstancedMesh(box,mat(0x34424a),sets.flat().length);
  sets.flat().forEach(([x,y,z,w,h,d],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,0);dummy.updateMatrix();struts.setMatrixAt(i,dummy.matrix);
  });
  scene.add(struts);
  const bearings = mat(0xc29355);
  for(const x of [-236,-34,161,267]) {
    const y=routeY(x);
    for(const z of [0,-6.3]) {
      const part=new T.Mesh(new T.CylinderGeometry(0.9,0.9,1.2,10),bearings);
      part.position.set(x,y+0.25,z);
      part.rotation.x=Math.PI/2;
      scene.add(part);
    }
    for(const sign of [-1,1]) beam(scene,mat(0x4b5660),vector(x,y-13,0),vector(x,y+0.3,sign*10),1.05);
  }
  return bearings;
}

function city(scene) {
  const rng=random(812), blocks = [];
  for(let i=0;i<940;i++){
    const row=Math.floor(i/47), col=i%47;
    const x=(col-23)*19+(rng()-0.5)*11, z=-150-row*12+(rng()-0.5)*12;
    if(rng()<0.23 || Math.abs(Math.sin((x+z*0.5)/55))<0.1) continue;
    const w=4+rng()*9,h=2+rng()*9,d=5+rng()*7, y=height(x,z);
    blocks.push([x,y+h/2,z,w,h,d,rng()]);
  }
  const wall=new T.InstancedMesh(box,mat(0xffffff),blocks.length);
  const roof=new T.InstancedMesh(box,mat(0xffffff),blocks.length);
  const palette=[0x8b6056,0x6d666b,0x888787,0xa88b76,0x6a5961,0x999791];
  blocks.forEach(([x,y,z,w,h,d,r],i)=>{
    dummy.rotation.set(0,0,0);dummy.position.set(x,y,z);dummy.scale.set(w,h,d);dummy.updateMatrix();
    wall.setMatrixAt(i,dummy.matrix); wall.setColorAt(i,color.set(palette[Math.floor(r*palette.length)]));
    dummy.position.y+=h/2;dummy.scale.set(w*1.06,0.5,d*1.06);dummy.updateMatrix();
    roof.setMatrixAt(i,dummy.matrix); roof.setColorAt(i,color.set(r>0.48?0x806461:0x737880));
  });
  scene.add(wall,roof);
  return low=>{ wall.count=roof.count=low?Math.floor(blocks.length*0.58):blocks.length; };
}

function cabinParts(paint, glass, frame) {
  return [
    [frame,0,-2.9,0,0.38,3.9,0.45],[frame,0,-0.35,0,2.2,0.65,0.55],
    [paint,0,-8.9,0,9.2,2.3,6.9],[glass,0,-5.98,0,8.65,4.15,6.53],
    [paint,0,-3.87,0,9.2,0.68,6.86],[frame,0,-10.1,0,8.3,0.4,6.2],
    ...[-4.36,0,4.36].flatMap(x=>[-3.32,3.32].map(z=>[frame,x,-6.15,z,0.16,4.46,0.18])),
    [paint,0,-7.97,0,9.15,0.23,6.87]
  ];
}
function cabinFleet(scene){
  const glass=mat(0x183741);
  const definitions=cabinParts(mat(0xe67431),glass,mat(0x29373f));
  const bands = definitions.map(([m])=>{
    const inst = new T.InstancedMesh(box,m,3);
    inst.frustumCulled=false;
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(inst);
    return inst;
  });
  return (transforms,night)=>{
    glass.color.set(night?0xe7a46b:0x183741);
    glass.emissive.set(night?0xffb47a:0);
    glass.emissiveIntensity=night?0.75:0;
    definitions.forEach(([,x,y,z,w,h,d],i)=>{
      transforms.forEach(({point,angle,show},j)=>{
        dummy.rotation.set(0,0,0);
        dummy.position.set(x,y,z).applyAxisAngle(vector(1,0,0),angle).add(point);
        dummy.rotation.x=angle;
        dummy.scale.set(show?w:0,show?h:0,show?d:0);
        dummy.updateMatrix(); bands[i].setMatrixAt(j,dummy.matrix);
      });
      bands[i].instanceMatrix.needsUpdate=true;
    });
  };
}

function ghostCabin(scene, tint){
  const g=new T.Group(), m=new T.MeshBasicMaterial({color:tint,transparent:true,opacity:0.35,wireframe:true,depthWrite:false,depthTest:false});
  g.renderOrder=2;
  for(const [,x,y,z,w,h,d] of cabinParts(null,null,null).slice(0,7)) cube(g,m,x,y,z,w,h,d);
  scene.add(g);g.visible=false;return g;
}

function sky(scene){
  const uniforms={top:{value:new T.Color(0x537991)},bottom:{value:new T.Color(0xe5bdab)}};
  const mesh=new T.Mesh(new T.SphereGeometry(2200,24,14),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,uniforms,
    vertexShader:'varying vec3 pos; void main(){pos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform vec3 top; uniform vec3 bottom; varying vec3 pos;
      void main(){vec3 d=normalize(pos); float h=smoothstep(-0.10,0.62,d.y);
      vec3 c=mix(bottom,top,h); float light=pow(max(0.,dot(d,normalize(vec3(-.65,.32,-.75)))),38.);
      gl_FragColor=vec4(c+vec3(.22,.12,.07)*light,1.);
      #include <colorspace_fragment>
      }`
  }));
  mesh.renderOrder=-20;scene.add(mesh);return uniforms;
}

export function createScene(host) {
  let renderer;
  try { renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch {
    host.classList.add('no-webgl');
    host.insertAdjacentHTML('afterbegin','<p class="webgl-warning">Vista 3D no disponible. Activa WebGL 2 para visualizarla.</p>');
    return {render:()=>{},quality:()=>{},track:()=>null};
  }
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden','true');
  host.prepend(renderer.domElement);
  const scene=new T.Scene(), camera=new T.PerspectiveCamera(42,1,0.2,4600);
  const uniforms=sky(scene);
  scene.fog=new T.FogExp2(0xb0bac4,0.00072);
  const hemi=new T.HemisphereLight(0xf2e7e7,0x5a6680,2.15);
  const sun=new T.DirectionalLight(0xffdcc4,2.2);
  sun.position.set(-250,620,390);
  scene.add(hemi,sun);

  const peak=(x,z,px,pz,h,w,d)=>h*Math.max(0,1-Math.hypot((x-px)/w,(z-pz)/d))**1.08;
  surface(scene,{x0:-1700,x1:1700,z0:-1380,z1:-360,nx:78,nz:33,seed:19,
    elevation:(x,z)=>-27+Math.max(peak(x,z,-130,-970,245,490,590),peak(x,z,170,-830,340,395,400),peak(x,z,400,-865,371,520,535),peak(x,z,622,-875,332,430,500),peak(x,z,930,-990,230,520,600))
      + 18*Math.sin(x/41+z/79)*Math.cos(z/73)+9*Math.sin(x/24-z/57),
    shade:(y,r,x)=>y>175+14*Math.sin(x/63)+r*35?(r<0.55?0xced6dd:0xb8c4d3):[0x67778b,0x717b90,0x647289,0x7b8193][Math.floor(r*4)]
  });
  surface(scene,{x0:-1120,x1:1120,z0:-600,z1:650,nx:88,nz:59,seed:123,elevation:height,
    shade:(y,r,x,z)=> z > 55 ? [0x586069,0x63656a,0x6f6870,0x756c6a][Math.floor(r*4)] :
      [0x626a70,0x676c72,0x71717a,0x7b7275,0x6a6872][Math.floor(r*5)]
  });
  const setCityQuality=city(scene);
  station(scene,-310);station(scene,310);
  const bearings=towers(scene);
  const cableMat=mat(0x202a2e);
  for(const z of [0,-6.3]){
    const curve=new T.CatmullRomCurve3(path.filter((_,i)=>i%10===0).map(({point})=>vector(point.x,point.y,z)));
    scene.add(new T.Mesh(new T.TubeGeometry(curve,144,0.37,5,false),cableMat));
  }
  const fleet=cabinFleet(scene), ghosts=[ghostCabin(scene,0x60e5f0),ghostCabin(scene,0xc994ff),ghostCabin(scene,0x92f2b8)];
  const barrierMat=new T.MeshBasicMaterial({color:0xe6c66b,transparent:true,opacity:0.86});
  const barrier=new T.Group(), limit=route(launch+150);
  barrier.position.copy(limit);
  for(const z of [-7,8]) beam(barrier,barrierMat,vector(0,-18,z),vector(0,3,z),0.32);
  beam(barrier,barrierMat,vector(0,-18,-7),vector(0,-18,8),0.35);
  beam(barrier,barrierMat,vector(0,3,-7),vector(0,3,8),0.35);
  for(let i=0;i<7;i++) beam(barrier,barrierMat,vector(0,-17+i*2.9,-7),vector(0,-17+i*2.9,8),0.08);
  scene.add(barrier);
  const windPos = new Float32Array(84*6), windGeo=new T.BufferGeometry();
  windGeo.setAttribute('position',new T.BufferAttribute(windPos,3).setUsage(T.DynamicDrawUsage));
  const gust=new T.LineSegments(windGeo,new T.LineBasicMaterial({color:0xb6e9f9,transparent:true,opacity:0.42}));
  gust.frustumCulled=false;scene.add(gust);
  const trailPos=new Float32Array(16*6), trailGeo=new T.BufferGeometry();
  trailGeo.setAttribute('position',new T.BufferAttribute(trailPos,3).setUsage(T.DynamicDrawUsage));
  const trail=new T.LineSegments(trailGeo,new T.LineBasicMaterial({color:0xffb775,transparent:true,opacity:0.65}));
  trail.frustumCulled=false;scene.add(trail);

  const focus=vector(-77,53,0);
  camera.position.set(-124,76,106);
  const desired=vector(0,0,0), desiredCam=vector(0,0,0), targetColor=new T.Color();
  let low=false, measuredWidth=0, measuredHeight=0, introFade=0, dirty=true, lastKey='', settle=2;
  const canResize = new ResizeObserver(()=>resize());
  canResize.observe(host);
  function resize() {
    const w=host.clientWidth,h=host.clientHeight;
    if (!w || !h) return;
    if(w!==measuredWidth || h!==measuredHeight) {
      measuredWidth=w;measuredHeight=h;
      camera.aspect=w/h;
      camera.fov=w/h<1.28?62:47;
      camera.updateProjectionMatrix();
    }
    renderer.setSize(w,h,false);dirty=true;
  }
  function quality(value) {
    low=value;setCityQuality(low);renderer.setPixelRatio(value?1:Math.min(window.devicePixelRatio,2));resize();
  }
  quality(false);
  function track(which) {
    if (!measuredWidth) return null;
    const world=which==='limit'?limit.clone().add(vector(0,3,0)):focus.clone().add(vector(0,7,0));
    world.project(camera);
    return {x:(world.x+1)*50,y:(1-world.y)*50,visible:world.z>-1&&world.z<1&&Math.abs(world.x)<0.94&&Math.abs(world.y)<0.9};
  }
  function render(s, dt) {
    if(!measuredWidth) return;
    const key=[s.module,s.scenario,s.intro,s.night,s.reduced,s.t,s.distance,s.wear,s.limit,...(s.swing??[])].join('|');
    if(key!==lastKey){lastKey=key;settle=s.reduced?0:1.5;dirty=true;}
    if(!dirty&&settle<=0)return;
    dirty=false;settle-=dt;
    introFade=s.intro ? Math.min(1,introFade+dt/2) : 0;
    const position = s.intro ? -54+introFade*85 : s.module==='brake' ? s.distance : 22+Math.min(s.t,26)*1.7;
    const point=route(launch+position), second=route(length*0.74-(s.intro?introFade*25: s.t*1.15),-6.3);
    const stress=s.scenario==='ESTRÉS', ill=s.scenario==='MAL CONDICIONADO';
    const ambient=s.night?[0x172943,0x455776,0x556782,0.82]:stress?[0x52687a,0xd6aca0,0x9099a9,1.8]:ill?[0x495a82,0xbeb3d1,0x9dabc5,1.9]:[0x507890,0xe0bdaf,0xaebac6,2.2];
    const easing=s.reduced?1:1-Math.exp(-3.25*dt);
    uniforms.top.value.lerp(targetColor.set(ambient[0]),easing);
    uniforms.bottom.value.lerp(targetColor.set(ambient[1]),easing);
    scene.fog.color.lerp(targetColor.set(ambient[2]),easing);
    scene.fog.density=T.MathUtils.lerp(scene.fog.density,stress?0.00125:0.00078,easing);
    sun.intensity=T.MathUtils.lerp(sun.intensity,ambient[3],easing);
    const damaged=tone(s.wear??0,0.1,s.limit||0.4);
    const wearColor=damaged>=1?0xff4b47:damaged>=0.65?0xffb347:0x5bd49a;
    cableMat.color.lerp(targetColor.set(s.module==='wear'?wearColor:0x22282d),easing);
    cableMat.emissive.copy(cableMat.color);cableMat.emissiveIntensity=s.module==='wear'?0.35:0;
    bearings.color.lerp(targetColor.set(s.module==='wear'?wearColor:0xa68d6b),easing);
    barrier.visible=s.module==='brake'&&!s.intro;
    barrierMat.color.set(position>150.00001?0xff384c:0xffca73);
    barrierMat.opacity=position>150&&!s.reduced?0.7+0.22*Math.sin(s.t*9):0.85;
    const oscillates=s.module==='wind'&&s.swing;
    const angle=x=>clamp(Math.asin(clamp(x*(s.amplification||1)/8.0,-0.96,0.96)),-1.3,1.3);
    fleet([{point,angle:oscillates?angle(s.swing[2]):0,show:true},{point:second,angle:0,show:true},
      {point:route(length*0.20+s.t*0.8,-6.3),angle:0,show:!low}],s.night);
    for(let i=0;i<3;i++){
      const g=ghosts[i];g.visible=Boolean(oscillates);
      if(oscillates){g.position.copy(point);g.rotation.x=angle(s.swing[i]);g.scale.setScalar(i===2?1.045:1.01);}
    }
    gust.visible=Boolean(oscillates)&&!s.reduced;
    if(gust.visible){
      const n=low?23:84;
      for(let i=0;i<n;i++){
        const offset=(i*43.754+s.t*(stress?34:17))%131-65;
        const px=point.x+offset, y=point.y-24+(i*8.491)%45,z=(i*11.351)%78-36;
        windPos.set([px,y,z,px+3.5,y+0.35,z-2.4],i*6);
      }
      windGeo.setDrawRange(0,n*2);windGeo.attributes.position.needsUpdate=true;
    }
    trail.visible=!s.reduced&&s.module==='brake'&&s.t>0&&s.speed>0.4&&!s.intro;
    if(trail.visible){
      for(let i=0;i<16;i++){
        const x=point.x-7-(i*1.8+s.t*8)%22, y=point.y-8+i%5*0.9,z=(i%7-3)*1.05;
        trailPos.set([x,y,z,x-Math.min(5,s.speed/2),y,z],i*6);
      }
      trailGeo.attributes.position.needsUpdate=true;
    }
    const shot={
      brake:[33,8,-49,25,116],wear:[30,-2,-57,32,135],wind:[6,-3,-34,18,86],
      sensors:[25,0,-52,30,124],solvers:[68,0,-78,48,176],condition:[46,0,-62,35,149]
    }[s.module];
    if(s.intro){desired.set(point.x+35,point.y+2,0);desiredCam.set(point.x-34,point.y+43,152-introFade*24);}
    else {desired.set(point.x+shot[0],point.y+shot[1],0);desiredCam.set(point.x+shot[2],point.y+shot[3],shot[4]);}
    focus.lerp(desired,easing); camera.position.lerp(desiredCam,easing); camera.lookAt(focus);
    renderer.render(scene,camera);
  }
  return {render,quality,track};
}
