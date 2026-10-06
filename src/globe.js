import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-50m.json';
import {visitedAreas,insideArea} from '../shared/atlas-places.js';
import {layoutGlobeLabels} from './globe-label-layout.js';
import {buildAtlasRoutes,routePoints,routeVehicleSvg} from './atlas-routes.js';

export const countries=feature(atlas,atlas.objects.countries).features;
const point=(lng,lat,r=2)=>{const a=lng*Math.PI/180,b=lat*Math.PI/180;return new THREE.Vector3(r*Math.cos(b)*Math.cos(a),r*Math.sin(b),-r*Math.cos(b)*Math.sin(a));};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
export function createGlobe(container,places,onSelect) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{container.innerHTML='<div class="globe-fallback">El 3D no está disponible en este navegador. Tus lugares están guardados y puedes consultarlos en la colección.</div>';return {dispose(){},zoom(){},reset(){},focus(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;container.append(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Globo terráqueo 3D. Arrastra para girar y pellizca para acercar. Usa las etiquetas o la colección para consultar tus lugares.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,.001,100);
  const home=point(8,35,6.7);camera.position.copy(home);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.018;controls.maxDistance=10;controls.rotateSpeed=.45;controls.zoomSpeed=.6;controls.autoRotate=places.length===0&&!reduced();controls.autoRotateSpeed=.18;
  let destination=null;
  controls.addEventListener('start',()=>{controls.autoRotate=false;destination=null;});
  scene.add(new THREE.AmbientLight(0xffffff,2.1));
  const light=new THREE.DirectionalLight(0xffd5e9,2.2);light.position.set(5,4,-3);scene.add(light);
  const world=new THREE.Group();scene.add(world);
  const regions=places.flatMap(place=>{const area=visitedAreas[place.id];if(!area)return [];const country=area.countryId?countries.find(c=>c.id===area.countryId):null;const polygons=area.polygons||(country?(country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates):[]);return [{place,color:area.color,polygons,soft:area.soft}];});
  function paintRegions(context,project){
    for(const region of regions){context.beginPath();for(const polygon of region.polygons)for(const ring of polygon){ring.forEach((p,i)=>{const [x,y]=project(p);i?context.lineTo(x,y):context.moveTo(x,y);});context.closePath();}context.save();context.globalAlpha=region.soft?.30:.66;context.fillStyle=region.color;if(region.soft){context.shadowColor=region.color;context.shadowBlur=context.canvas.width/90;context.filter='blur('+context.canvas.width/280+'px)';}context.fill('evenodd');if(!region.soft){context.globalAlpha=.95;context.strokeStyle=region.color;context.lineWidth=1.3;context.stroke();}context.restore();}
  }

  const canvas=document.createElement('canvas');canvas.width=4096;canvas.height=2048;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#1c1e30';ctx.fillRect(0,0,4096,2048);
  const xy=([lng,lat])=>[(lng+180)/360*4096,(90-lat)/180*2048];
  for(const country of countries){ctx.beginPath();const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon){ring.forEach((p,i)=>{const [x,y]=xy(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fillStyle='#716076';ctx.fill('evenodd');ctx.strokeStyle='#ad8ba6';ctx.lineWidth=.65;ctx.stroke();}
  paintRegions(ctx,xy);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const globe=new THREE.Mesh(new THREE.SphereGeometry(2,192,128),new THREE.MeshPhongMaterial({map:texture,shininess:24,specular:0x47344b}));world.add(globe);
  // A curved high-resolution inset avoids a pixelated coastline at regional zoom.
  const inset=document.createElement('canvas');inset.width=2048;inset.height=2048;const local=inset.getContext('2d');local.fillStyle='#1c1e30';local.fillRect(0,0,2048,2048);
  const localXY=([lng,lat])=>[(lng+2)/7*2048,(45-lat)/7*2048];
  for(const country of countries){local.beginPath();const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon){ring.forEach((p,i)=>{const [x,y]=localXY(p);i?local.lineTo(x,y):local.moveTo(x,y);});local.closePath();}local.fillStyle='#716076';local.fill('evenodd');local.strokeStyle='#ad8ba6';local.lineWidth=1;local.stroke();}
  paintRegions(local,localXY);
  const insetTexture=new THREE.CanvasTexture(inset);insetTexture.colorSpace=THREE.SRGBColorSpace;insetTexture.anisotropy=texture.anisotropy;
  const vertices=[],uvs=[],indices=[],segments=96;
  for(let y=0;y<=segments;y++)for(let x=0;x<=segments;x++){const v=point(-2+x/segments*7,45-y/segments*7,2.0002);vertices.push(v.x,v.y,v.z);uvs.push(x/segments,1-y/segments);}
  for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){const a=y*(segments+1)+x,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
  const insetGeometry=new THREE.BufferGeometry();insetGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));insetGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));insetGeometry.setIndex(indices);insetGeometry.computeVertexNormals();
  const insetMesh=new THREE.Mesh(insetGeometry,new THREE.MeshPhongMaterial({map:insetTexture,shininess:24,specular:0x47344b,side:THREE.DoubleSide}));world.add(insetMesh);
  const gridMaterial=new THREE.LineBasicMaterial({color:0xcaa9c1,transparent:true,opacity:.09});
  for(let lat=-60;lat<=60;lat+=30){const p=[];for(let lng=-180;lng<=180;lng+=2)p.push(point(lng,lat,2.001));world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMaterial));}
  for(let lng=0;lng<360;lng+=30){const p=[];for(let lat=-90;lat<=90;lat+=2)p.push(point(lng,lat,2.001));world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMaterial));}
  const halo=new THREE.Mesh(new THREE.SphereGeometry(2.045,96,64),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vPosition=p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))),3.0);gl_FragColor=vec4(1.0,0.42,0.76,rim*0.38);}'}));world.add(halo);
  const pickables=[globe,insetMesh];
  const routeParticles=[];
  const markers=[],labels=[],labelLayer=document.createElement('div');labelLayer.className='globe-labels';container.append(labelLayer);
  const connectors=document.createElementNS('http://www.w3.org/2000/svg','svg');connectors.classList.add('globe-label-connectors');connectors.setAttribute('aria-hidden','true');labelLayer.append(connectors);
  for(const {origin,destination:place,vehicle} of buildAtlasRoutes(places)){
    const points=routePoints(origin,place),curve=new THREE.CatmullRomCurve3(points);
    const glow=new THREE.Mesh(new THREE.TubeGeometry(curve,96,.00075,6,false),new THREE.MeshBasicMaterial({color:0xff70c5,transparent:true,opacity:.18,depthWrite:false}));world.add(glow);
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineDashedMaterial({color:0xffb4df,transparent:true,opacity:.85,dashSize:.0025,gapSize:.0015}));line.computeLineDistances();line.userData.place=place;world.add(line);
    const particle=document.createElement('span');particle.className='route-vehicle '+vehicle;particle.innerHTML=routeVehicleSvg(vehicle);particle.setAttribute('aria-hidden','true');labelLayer.append(particle);routeParticles.push({particle,curve,vehicle});
  }
  places.forEach(p=>{
    const color=visitedAreas[p.id]?.color||'#ff9bd3';
    const group=new THREE.Group();group.position.copy(point(p.lng,p.lat,2.003));group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),group.position.clone().normalize());world.add(group);
    const dot=new THREE.Mesh(new THREE.SphereGeometry(.009,16,12),new THREE.MeshBasicMaterial({color}));dot.userData.place=p;group.add(dot);pickables.push(dot);
    const ring=new THREE.Mesh(new THREE.RingGeometry(.016,.019,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false}));group.add(ring);markers.push({group,ring});
    const label=document.createElement('button');label.className='globe-place-label'+(p.id==='visited-andorra'?' mountain':'');label.style.borderColor=color+'80';label.textContent=p.name;label.setAttribute('aria-label','Ver '+p.name);label.addEventListener('click',()=>onSelect(p));labelLayer.append(label);const connector=document.createElementNS('http://www.w3.org/2000/svg','line');connector.setAttribute('stroke',color);connectors.append(connector);labels.push({label,connector,p,position:group.position,width:label.offsetWidth,height:label.offsetHeight});
  });
  const raycaster=new THREE.Raycaster();let down=null;
  const pointerDown=e=>down=[e.clientX,e.clientY];
  const pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){down=null;return;}down=null;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hit=raycaster.intersectObjects(pickables)[0];if(hit?.object.userData.place)onSelect(hit.object.userData.place);else if(hit){const v=hit.point.clone().normalize();const lat=Math.asin(v.y)*180/Math.PI,lng=Math.atan2(-v.z,v.x)*180/Math.PI;const region=regions.find(r=>insideArea(lng,lat,r.polygons));onSelect(region?region.place:{lat,lng});}};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const keydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();destination=null;controls.autoRotate=false;const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?new THREE.Vector3(0,1,0):new THREE.Vector3().crossVectors(camera.position,new THREE.Vector3(0,1,0)).normalize();const step=Math.min(.12,(camera.position.length()-2)*.15);camera.position.applyAxisAngle(axis,e.key==='ArrowLeft'||e.key==='ArrowUp'?step:-step);controls.update();}};renderer.domElement.addEventListener('keydown',keydown);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(container);resize();
  let frame,last=0;const projected=new THREE.Vector3();
  function animate(time=0){frame=requestAnimationFrame(animate);if(document.hidden){last=time;return;}const dt=Math.min((time-last)/1000,.05);last=time;
    if(destination){const radius=THREE.MathUtils.lerp(camera.position.length(),destination.length(),1-Math.exp(-dt*5));camera.position.normalize().lerp(destination.clone().normalize(),1-Math.exp(-dt*5)).normalize().multiplyScalar(radius);if(camera.position.distanceTo(destination)<.0001){camera.position.copy(destination);destination=null;}}
    controls.rotateSpeed=Math.max(.025,Math.min(.45,(camera.position.length()-2)*.15));controls.update();camera.updateMatrixWorld();
    const scale=Math.max(.035,Math.min(1,(camera.position.length()-2)/2));for(const {group,ring} of markers){group.scale.setScalar(scale);ring.material.opacity=reduced()?.5:.4+Math.sin(time*.0015)*.15;}
    routeParticles.forEach(({particle,curve,vehicle},i)=>{
      const t=reduced()?.5:(time*.00006+i*.19)%1,position=curve.getPoint(t),screen=position.clone().project(camera);
      const visible=position.dot(camera.position.clone().sub(position))>0&&screen.z<1&&Math.abs(screen.x)<1&&Math.abs(screen.y)<1;
      particle.hidden=!visible;if(!visible)return;
      particle.style.left=(screen.x*.5+.5)*container.clientWidth+'px';particle.style.top=(-screen.y*.5+.5)*container.clientHeight+'px';
      const next=curve.getPoint(Math.min(1,t+.005)).project(camera),angle=vehicle==='plane'?Math.atan2(-(next.y-screen.y),next.x-screen.x)*180/Math.PI+45:0;
      particle.style.transform=`translate(-50%,-50%) rotate(${angle}deg)`;
    });
    const anchors=[];
    for(const entry of labels){
      const {label,connector,position}=entry;projected.copy(position).project(camera);
      const visible=position.dot(camera.position.clone().sub(position))>0&&projected.z<1&&Math.abs(projected.x)<1&&Math.abs(projected.y)<1;
      label.hidden=true;connector.style.display='none';
      if(visible)anchors.push({...entry,x:(projected.x*.5+.5)*container.clientWidth,y:(-projected.y*.5+.5)*container.clientHeight});
    }
    for(const entry of layoutGlobeLabels(anchors,container.clientWidth,container.clientHeight)){
      if(!entry.visible)continue;
      const {label,connector}=entry;label.hidden=false;label.style.left=entry.x+'px';label.style.top=entry.y+'px';
      const anchor=anchors.find(a=>a.label===label);connector.style.display='';
      connector.setAttribute('x1',anchor.x);connector.setAttribute('y1',anchor.y);connector.setAttribute('x2',entry.endX);connector.setAttribute('y2',entry.endY);
    }
    renderer.render(scene,camera);
  }animate();
  function move(to){controls.autoRotate=false;if(reduced()){camera.position.copy(to);controls.update();}else destination=to;}
  return {zoom(dir){destination=null;const r=THREE.MathUtils.clamp(2+(camera.position.length()-2)*(dir>0?.7:1.43),controls.minDistance,controls.maxDistance);camera.position.setLength(r);controls.update();},reset(){move(home);},focus(p){if(p)move(point(p.lng,p.lat,visitedAreas[p.id]?.focusRadius||(visitedAreas[p.id]?2.025:2.15)));},dispose(){cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('keydown',keydown);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);const materials=new Set();scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [o.material].flat())materials.add(m);});materials.forEach(m=>m.dispose());texture.dispose();insetTexture.dispose();renderer.dispose();renderer.domElement.remove();labelLayer.remove();}};
}
