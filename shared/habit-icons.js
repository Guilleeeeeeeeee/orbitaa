// Update existing gym/work habits once without recreating their history.
export function withHabitIcons(state) {
  if(state.habitIconsVersion>=1)return state;
  return {...state,habitIconsVersion:1,habits:state.habits.map(h=>{
    const name=h.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const icon=/\b(gym|gimnasio|gimnas|entrenamiento|pesas)\b/.test(name)?'dumbbell':/\b(trabajo|trabajar|trabajaré|curro|currar|feina|treball|work)\b/.test(name)?'briefcase-business':h.icon;
    return icon===h.icon?h:{...h,icon};
  })};
}
