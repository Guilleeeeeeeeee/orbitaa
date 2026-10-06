import test from 'node:test';
import assert from 'node:assert/strict';
import {countVisitedPlaces} from '../shared/summary.js';
import {atlasPlaces} from '../shared/atlas-places.js';

test('summary counts completed destinations without counting confirmed future plans', () => {
  const places=atlasPlaces.map(p=>({...p,confirmation:p.id.startsWith('planned-')?'yes':p.confirmation}));
  assert.equal(countVisitedPlaces(places),4);
  assert.equal(countVisitedPlaces([...places,{id:'personal-trip',name:'Otro recuerdo'}]),5);
  assert.equal(countVisitedPlaces([]),0);
  assert.equal(places.length,6);
});
