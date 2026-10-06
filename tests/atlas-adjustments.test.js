import test from 'node:test';
import assert from 'node:assert/strict';
import {resetSurpriseAnswer} from '../shared/surprise-reset.js';
import {countVisitedCountries,countVisitedPlaces} from '../shared/summary.js';
import {atlasPlaces,withConfirmedVisits} from '../shared/atlas-places.js';
import {layoutGlobeLabels} from '../src/globe-label-layout.js';

test('surprise answer resets once without changing Prague or later answers',()=>{
  const state={atlasVersion:4,habitIconsVersion:1,places:atlasPlaces.map(p=>({...p,confirmation:p.id.startsWith('planned-')?'yes':p.confirmation})),habits:[],tasks:[],entries:[]};
  const next=withConfirmedVisits(state);
  assert.equal(next.places.find(p=>p.id==='planned-surprise').confirmation,'pending');
  assert.equal(next.places.find(p=>p.id==='planned-prague').confirmation,'yes');
  next.places.find(p=>p.id==='planned-surprise').confirmation='yes';
  assert.equal(resetSurpriseAnswer(next),next);
  assert.equal(withConfirmedVisits(next),next);
  assert.equal(countVisitedPlaces(next.places),4);
  assert.equal(countVisitedCountries(next.places),3);
});

test('crowded globe labels never form a displaced column or escape the viewport',()=>{
  const anchors=Array.from({length:6},(_,id)=>({id,x:175,y:250+id*3,width:120,height:28}));
  const result=layoutGlobeLabels(anchors,350,500),visible=result.filter(a=>a.visible);
  assert.ok(visible.length>0&&visible.length<anchors.length);
  for(const a of visible){const origin=anchors[a.id];assert.ok(Math.hypot(a.x-origin.x,a.y-origin.y)<=72);assert.ok(a.x-a.width/2>=8&&a.x+a.width/2<=342);}
  for(let i=0;i<visible.length;i++)for(let j=i+1;j<visible.length;j++)assert.ok(Math.abs(visible[i].x-visible[j].x)>=126||Math.abs(visible[i].y-visible[j].y)>=34);
  assert.equal(layoutGlobeLabels([{x:5,y:5,width:120,height:28}],350,500)[0].visible,false);
});
