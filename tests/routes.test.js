import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAtlasRoutes,routePoints} from '../src/atlas-routes.js';
import {atlasPlaces} from '../shared/atlas-places.js';
const coord=v=>({lat:Math.asin(v.clone().normalize().y)*180/Math.PI,lng:Math.atan2(-v.z,v.x)*180/Math.PI});
test('connections start at Barcelona only when it is present and skip duplicate coordinates',()=>{
 assert.deepEqual(buildAtlasRoutes(atlasPlaces.slice(1)),[]);
 const routes=buildAtlasRoutes([...atlasPlaces,{...atlasPlaces[0],id:'same-spot'}]);
 assert.equal(routes.length,5);assert.ok(routes.every(r=>r.origin.name==='Barcelona'));
});
test('route endpoints match their places and curves remain above the earth even across the date line',()=>{
 for(const [a,b] of [[atlasPlaces[0],atlasPlaces[1]],[{lat:20,lng:179},{lat:20,lng:-179}],[{lat:0,lng:0},{lat:0,lng:180}]]){
  const points=routePoints(a,b);assert.equal(points.length,97);assert.ok(points.every(p=>Number.isFinite(p.x)&&p.length()>=2.0029));
  assert.ok(Math.abs(coord(points[0]).lat-a.lat)<1e-7);assert.ok(Math.abs(coord(points.at(-1)).lat-b.lat)<1e-7);
  const delta=coord(points.at(-1)).lng-b.lng;assert.ok(Math.min(Math.abs(delta),Math.abs(delta+360),Math.abs(delta-360))<1e-7);
 }
});

test('Prague flies and the other routes use cars',()=>{const routes=buildAtlasRoutes(atlasPlaces);assert.equal(routes.find(r=>r.destination.name==='Praga').vehicle,'plane');assert.ok(routes.filter(r=>r.destination.name!=='Praga').every(r=>r.vehicle==='car'));});
