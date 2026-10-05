import * as THREE from 'three';

export function buildAtlasRoutes(places) {
  const origin=places.find(p=>p.id==='visited-barcelona-sitges');
  if(!origin)return [];
  return places.filter(p=>p.id!==origin.id&&Math.hypot(p.lng-origin.lng,p.lat-origin.lat)>.001).map(destination=>({origin,destination}));
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
