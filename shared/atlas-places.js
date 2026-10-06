import {withHabitIcons} from './habit-icons.js';
// Confirmed visits. No visit dates or individual town visits are inferred.
export const placeMemories = {
  'visited-barcelona-sitges': {dateLabel:'Toda la vida',note:'Pues donde siempre (+ HYPE).',photo:'barcelona'},
  'visited-andorra': {dateLabel:'septiembre',note:'Día número 1 del año (99% insuperable).',photo:'andorra'},
  'visited-laurentis': {dateLabel:'Agosto',note:'Viaje extremisimo con clima de National Geografic (encima el primero, vaya bomba).',photo:'laurentis'},
  'visited-merles': {dateLabel:'Julio',note:'Este realmente fue el primer viaje pero te la sacaste tanto que no lo cuento como si fuese real.',photo:'merles'}
};
export const memoryPhotos = {
  barcelona: {src:'/memories/barcelona.webp',alt:'Fitness 19, nuestro sitio en Barcelona'},
  andorra: {src:'/memories/andorra.webp',alt:'El hotel del recuerdo de Andorra'},
  laurentis: {src:'/memories/laurentis.webp',alt:'Una vaca junto al lago entre las montañas'},
  merles: {src:'/memories/merles.webp',alt:'Paisaje del recuerdo de Riera de Merlès'}
};
export const atlasPlaces = [
  {id:'visited-barcelona-sitges',name:'Barcelona',country:'España',lat:41.284,lng:1.978,date:'',note:'Zona costera de Barcelona visitada. La superficie coloreada representa de forma aproximada la zona indicada, no un límite administrativo.'},
  {id:'visited-andorra',name:'Andorra',country:'Andorra',lat:42.546,lng:1.601,date:'',note:'Andorra, territorio visitado.'},
  {id:'visited-laurentis',name:'Lago Laurentis',country:'Francia',lat:42.67424,lng:2.02562,date:'',note:'Entorno del lago Laurenti, en el Donezan (Pirineo francés). La superficie coloreada es una zona aproximada alrededor del lago, no el perímetro del agua.'},
  {id:'visited-merles',name:'Riera de Merlès',country:'España',lat:42.035,lng:1.982,date:'',note:''},
  {id:'planned-surprise',name:'?',country:'España',lat:42.72,lng:.88,date:'',dateLabel:'24-25 octubre',note:'Falta una confirmacion.',confirmation:'pending',secret:true},
  {id:'planned-prague',name:'Praga',country:'República Checa',lat:50.0755,lng:14.4378,date:'',dateLabel:'Enero/Febrero',note:'Falta una confirmacion.',confirmation:'pending'}
];
// Each migration adds only its new destinations; deleted memories stay deleted.
export function withConfirmedVisits(state) {
  if(state.atlasVersion>=4)return withHabitIcons(state);
  const version=state.atlasVersion||0;
  let places=state.places.map(p=>({...p}));
  if(version<3){
    places=places.map(p=>p.id==='visited-barcelona-sitges'?{...p,name:'Barcelona'}:p);
    const seeds=version>=1?atlasPlaces.slice(2,3):atlasPlaces.slice(0,3);
    places.push(...seeds.filter(p=>!places.some(x=>x.id===p.id||x.name.toLowerCase()===p.name.toLowerCase())).map(p=>({...p})));
    places=places.map(p=>placeMemories[p.id]?{...p,...placeMemories[p.id]}:p);
  }
  places=places.map(p=>p.id==='visited-andorra'&&p.note==='Día número 1 del año (99% insuperable.'?{...p,note:placeMemories[p.id].note}:p);
  places.push(...atlasPlaces.slice(3).filter(p=>!places.some(x=>x.id===p.id||x.name.toLowerCase()===p.name.toLowerCase())).map(p=>({...p,...(placeMemories[p.id]||{})})));
  return withHabitIcons({...state,atlasVersion:4,places});
}
// Deliberately approximate visited areas; Andorra uses the atlas country boundary.
export const visitedAreas = {
  'visited-barcelona-sitges': {color:'#f767b1',polygons:[[[[2.205,41.405],[2.198,41.370],[2.149,41.326],[2.096,41.283],[2.017,41.257],[1.946,41.250],[1.900,41.245],[1.842,41.229],[1.806,41.265],[1.866,41.307],[1.947,41.335],[2.028,41.351],[2.110,41.399],[2.167,41.432],[2.205,41.405]]]]},
  'visited-andorra': {color:'#f5bd78',countryId:'020'},
  'visited-merles': {color:'#ffa5cc',polygons:[[[[1.950,41.990],[1.971,42.045],[1.966,42.106],[1.996,42.124],[2.016,42.084],[2.008,42.034],[1.987,41.980],[1.950,41.990]]]]},
  'planned-surprise': {color:'#ffb5df',soft:true,focusRadius:2.075,polygons:[[[[.46,42.58],[.60,42.85],[.92,42.96],[1.20,42.84],[1.32,42.61],[1.10,42.40],[.73,42.38],[.46,42.58]]]]},
  'planned-prague': {color:'#f6a6d5',countryId:'203',focusRadius:2.35},
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
