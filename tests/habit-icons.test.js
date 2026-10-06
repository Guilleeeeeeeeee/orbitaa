import test from 'node:test';
import assert from 'node:assert/strict';
import {withHabitIcons} from '../shared/habit-icons.js';
import {withConfirmedVisits} from '../shared/atlas-places.js';
import {validState} from '../worker/index.js';
test('existing gym and work habits keep identity and checks while receiving new icons once',()=>{
 const state={atlasVersion:4,places:[],tasks:[],entries:[],habits:[{id:'gym',name:'Ir al gym',icon:'activity',days:['2026-10-05']},{id:'work',name:'Trabajo',icon:'target',days:['2026-10-06']},{id:'read',name:'Leer',icon:'book-open',days:[]}]};
 const next=withConfirmedVisits(state);
 assert.deepEqual(next.habits.map(h=>h.icon),['dumbbell','briefcase-business','book-open']);
 assert.deepEqual(next.habits.map(h=>({id:h.id,days:h.days})),state.habits.map(h=>({id:h.id,days:h.days})));
 assert.ok(validState(next));assert.equal(withHabitIcons(next),next);assert.equal(withConfirmedVisits(next),next);
});
