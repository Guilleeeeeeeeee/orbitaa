import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { feature } from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';

export const countries=feature(atlas,atlas.objects.countries).features;
const point=(lng,lat,r=2)=>{const a=lng*Math.PI/180,b=lat*Math.PI/180;return new THREE.Vector3(r*Math.cos(b)*Math.cos(a),r*Math.sin(b),-r*Math.cos(b)*Math.sin(a));};
export function createGlobe(container,places,onSelect) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}catch{container.innerHTML='<div class="globe-fallback">El 3D no está disponible en este navegador. Puedes consultar y añadir tus lugares en la lista.</div>';return {dispose(){},zoom(){},reset(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));container.append(renderer.domElement);
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Globo terráqueo 3D. Arrastra para girar y pellizca para acercar. También puedes usar los controles y la lista de lugares.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1,0.1,100);
  camera.position.copy(point(5,25,6.7));
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=3.5;controls.maxDistance=10;controls.rotateSpeed=.6;controls.autoRotate=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.autoRotateSpeed=.25;
  controls.addEventListener('start',()=>controls.autoRotate=false);
  scene.add(new THREE.AmbientLight(0xffffff,2));
  const light=new THREE.DirectionalLight(0xffc4e6,3);light.position.set(5,3,4);scene.add(light);
  const world=new THREE.Group();scene.add(world);
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#24122e';ctx.fillRect(0,0,2048,1024);
  const xy=([lng,lat])=>[(lng+180)/360*2048,(90-lat)/180*1024];
  for(const country of countries){ctx.beginPath();const polygons=country.geometry.type==='Polygon'?[country.geometry.coordinates]:country.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon){ring.forEach((p,i)=>{const [x,y]=xy(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fillStyle='#56344f';ctx.fill('evenodd');ctx.strokeStyle='#977080';ctx.lineWidth=.8;ctx.stroke();}
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const globe=new THREE.Mesh(new THREE.SphereGeometry(2,96,64),new THREE.MeshPhongMaterial({map:texture,shininess:12,specular:0x6f3256}));world.add(globe);
  const gridMaterial=new THREE.LineBasicMaterial({color:0xc787ad,transparent:true,opacity:.13});
  for(let lat=-60;lat<=60;lat+=30){const p=[];for(let lng=-180;lng<=180;lng+=3)p.push(point(lng,lat,2.005));world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMaterial));}
  for(let lng=0;lng<360;lng+=30){const p=[];for(let lat=-90;lat<=90;lat+=3)p.push(point(lng,lat,2.005));world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),gridMaterial));}
  const halo=new THREE.Mesh(new THREE.SphereGeometry(2.05,64,32),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,uniforms:{},vertexShader:'varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.0);vPosition=p.xyz;gl_Position=projectionMatrix*p;}',fragmentShader:'varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(-vPosition))),3.0);gl_FragColor=vec4(1.0,0.25,0.66,rim*0.48);}'}));world.add(halo);
  const markers=[];
  places.forEach(p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.035,16,12),new THREE.MeshBasicMaterial({color:0xffc8e9}));m.position.copy(point(p.lng,p.lat,2.035));m.userData.place=p;world.add(m);markers.push(m);const ring=new THREE.Mesh(new THREE.RingGeometry(.045,.06,32),new THREE.MeshBasicMaterial({color:0xffc8e9,transparent:true,opacity:.6,side:THREE.DoubleSide}));ring.position.copy(point(p.lng,p.lat,2.035));ring.lookAt(point(p.lng,p.lat,4));world.add(ring);});
  const raycaster=new THREE.Raycaster();let down=null;
  const pointerDown=e=>down=[e.clientX,e.clientY];
  const pointerUp=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;const rect=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects([globe,...markers]);if(hits[0]?.object.userData.place)onSelect(hits[0].object.userData.place);else if(hits[0]){const v=hits[0].point.clone().normalize();onSelect({lat:Math.asin(v.y)*180/Math.PI,lng:Math.atan2(-v.z,v.x)*180/Math.PI});}};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
  const keydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();controls.autoRotate=false;const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?new THREE.Vector3(0,1,0):new THREE.Vector3().crossVectors(camera.position,new THREE.Vector3(0,1,0)).normalize();camera.position.applyAxisAngle(axis,e.key==='ArrowLeft'||e.key==='ArrowUp'?.12:-.12);controls.update();}};renderer.domElement.addEventListener('keydown',keydown);
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const ro=new ResizeObserver(resize);ro.observe(container);resize();
  let frame;function animate(){frame=requestAnimationFrame(animate);if(!document.hidden){controls.update();renderer.render(scene,camera);}}animate();
  return {zoom(dir){camera.position.multiplyScalar(dir>0?.85:1.15);controls.update();},reset(){camera.position.copy(point(5,25,6.7));controls.update();},focus(p){controls.autoRotate=false;camera.position.copy(point(p.lng,p.lat,5.4));controls.update();},dispose(){cancelAnimationFrame(frame);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('keydown',keydown);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);scene.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of [o.material].flat())m.dispose();});texture.dispose();renderer.dispose();renderer.domElement.remove();}};
}
