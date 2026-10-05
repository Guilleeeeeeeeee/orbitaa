// Confirmed visits. No visit dates or individual town visits are inferred.
export const atlasPlaces = [
  {id:'visited-barcelona-sitges',name:'Barcelona',country:'España',lat:41.284,lng:1.978,date:'',note:'Zona costera de Barcelona visitada. La superficie coloreada representa de forma aproximada la zona indicada, no un límite administrativo.'},
  {id:'visited-andorra',name:'Andorra',country:'Andorra',lat:42.546,lng:1.601,date:'',note:'Andorra, territorio visitado.'},
  {id:'visited-laurentis',name:'Lago Laurentis',country:'Francia',lat:42.67424,lng:2.02562,date:'',note:'Entorno del lago Laurenti, en el Donezan (Pirineo francés). La superficie coloreada es una zona aproximada alrededor del lago, no el perímetro del agua.'}
];
export function withConfirmedVisits(state) {
  if(state.atlasVersion>=2)return state;
  const places=state.places.map(p=>p.id==='visited-barcelona-sitges'?{...p,name:'Barcelona',note:p.note.startsWith('Zona visitada entre Barcelona y Sitges.')?atlasPlaces[0].note:p.note}:p);
  const additions=state.atlasVersion>=1?atlasPlaces.slice(2):atlasPlaces;
  return {...state,atlasVersion:2,places:[...places,...additions.filter(p=>!places.some(x=>x.id===p.id||x.name.toLowerCase()===p.name.toLowerCase())).map(p=>({...p}))]};
}
// Deliberately approximate visited areas; Andorra uses the atlas country boundary.
export const visitedAreas = {
  'visited-barcelona-sitges': {color:'#f767b1',polygons:[[[[2.205,41.405],[2.198,41.370],[2.149,41.326],[2.096,41.283],[2.017,41.257],[1.946,41.250],[1.900,41.245],[1.842,41.229],[1.806,41.265],[1.866,41.307],[1.947,41.335],[2.028,41.351],[2.110,41.399],[2.167,41.432],[2.205,41.405]]]]},
  'visited-andorra': {color:'#f5bd78',countryId:'020'},
  'visited-laurentis': {color:'#bf92f5',polygons:[[[[1.921,42.677],[1.953,42.742],[2.022,42.778],[2.104,42.753],[2.137,42.699],[2.096,42.631],[2.031,42.601],[1.961,42.623],[1.921,42.677]]]]}
};
export function insideRing(lng,lat,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>lat)!==(yj>lat)&&lng<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export const insideArea=(lng,lat,polygons)=>polygons.some(([outer,...holes])=>insideRing(lng,lat,outer)&&!holes.some(hole=>insideRing(lng,lat,hole)));
