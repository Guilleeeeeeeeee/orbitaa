// One-time correction requested by the owner; subsequent answers stay saved.
export function resetSurpriseAnswer(state) {
  if(state.surpriseResetVersion>=1)return state;
  return {...state,surpriseResetVersion:1,places:state.places.map(p=>p.id==='planned-surprise'?{...p,confirmation:'pending'}:p)};
}
