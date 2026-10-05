// Confirmed visits. No visit dates or individual town visits are inferred.
export const atlasPlaces = [
  {id:'visited-barcelona-sitges',name:'Barcelona–Sitges',country:'España',lat:41.284,lng:1.978,date:'',note:'Zona visitada entre Barcelona y Sitges. La línea del mapa representa la franja de costa de forma aproximada, no un recorrido registrado.'},
  {id:'visited-andorra',name:'Andorra',country:'Andorra',lat:42.546,lng:1.601,date:'',note:'Andorra, territorio visitado.'}
];
export function withConfirmedVisits(state) {
  if(state.atlasVersion>=1)return state;
  return {...state,atlasVersion:1,places:[...state.places,...atlasPlaces.filter(p=>!state.places.some(x=>x.id===p.id||x.name.toLowerCase()===p.name.toLowerCase())).map(p=>({...p}))]};
}
export const coastalPoints = [[2.1734,41.3851],[2.149,41.342],[2.096,41.294],[2.017,41.263],[1.946,41.255],[1.900,41.252],[1.853,41.235]];
