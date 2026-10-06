import * as THREE from 'three';

export function buildAtlasRoutes(places) {
  const origin=places.find(p=>p.id==='visited-barcelona-sitges');
  if(!origin)return [];
  return places.filter(p=>p.id!==origin.id&&Math.hypot(p.lng-origin.lng,p.lat-origin.lat)>.001).map(destination=>({origin,destination,vehicle:destination.id==='planned-prague'?'plane':'car'}));
}

// A symbolic great-circle connection, not a road or a recorded itinerary.
export function routePoints(origin,destination,segments=96) {
  const vector=({lng,lat})=>{
    const a=lng*Math.PI/180,b=lat*Math.PI/180;
    return new THREE.Vector3(Math.cos(b)*Math.cos(a),Math.sin(b),-Math.cos(b)*Math.sin(a));
  };
  const start=vector(origin),end=vector(destination),angle=start.angleTo(end);
  const tangent=end.clone().addScaledVector(start,-start.dot(end));
  if(tangent.lengthSq()<1e-12)tangent.crossVectors(start,Math.abs(start.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0));
  tangent.normalize();
  const lift=Math.min(.15,Math.max(.003,angle*.14));
  return Array.from({length:segments+1},(_,i)=>{
    const t=i/segments;
    return start.clone().multiplyScalar(Math.cos(angle*t)).addScaledVector(tangent,Math.sin(angle*t)).normalize().multiplyScalar(2.003+Math.sin(Math.PI*t)*lift);
  });
}

// Monochrome icons remain crisp at every zoom level.
export function routeVehicleSvg(vehicle) {
  const paths=vehicle==='plane'?'<path d="m17.8 8.2 2.2-2.2c1-1 1-3 0-4s-3-1-4 0l-2.2 2.2L3 2 1 4l8 5-4 4H2l-1 1 4 2 2 4 1-1v-3l4-4 5 8 2-2Z"/>':'<path d="m5 7 2-3h10l2 3 2 3v7H3v-7Z"/><path d="M5 7h14M3 11h18M6 17v3M18 17v3"/><circle cx="6.5" cy="14" r=".7"/><circle cx="17.5" cy="14" r=".7"/>';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
