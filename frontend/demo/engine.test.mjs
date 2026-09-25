import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoStore } from './engine.mjs';
const body = (s, offset = 24) => ({room_id: s.rooms[1].id, title:'Test booking', starts_at:new Date(Date.now()+offset*3600000).toISOString(), ends_at:new Date(Date.now()+(offset+1)*3600000).toISOString()});
test('overlap conflicts while adjacent intervals work', () => {
  const s=new DemoStore(), b=body(s); s.reserve(b);
  assert.throws(()=>s.reserve(b),e=>e.status===409);
  assert.ok(s.reserve({...b,starts_at:b.ends_at,ends_at:new Date(+new Date(b.ends_at)+3600000).toISOString()}));
});
test('same actor and key reuses outcome; different payload rejects',()=>{
  const s=new DemoStore(),b=body(s),one=s.reserve(b,'same');
  assert.equal(s.reserve(b,'same').id,one.id);
  assert.throws(()=>s.reserve({...b,title:'Changed'},'same'),e=>e.status===409);
});
test('ownership prevents cancellation; owner cancellation frees slot',()=>{
  const s=new DemoStore(),b=body(s),one=s.reserve(b);s.actor='bob';
  assert.throws(()=>s.handle(`/bookings/${one.id}/cancel`,{method:'POST'}),e=>e.status===403);
  s.actor='alice';s.handle(`/bookings/${one.id}/cancel`,{method:'POST'});assert.ok(s.reserve(b));
});
test('simulated race yields one 201 and one 409, separate from planner',()=>{
  const s=new DemoStore(),count=s.bookings.length,scene=s.handle('/demo/scenarios',{method:'POST'});
  assert.deepEqual(scene.tokens.map(t=>s.challenge(scene.id,t).status),[201,409]);
  assert.equal(s.scenario.confirmed.length,1);assert.equal(s.bookings.length,count);
});
test('admin-only operations and isolated browser state',()=>{
  const a=new DemoStore(),b=new DemoStore();
  assert.throws(()=>a.handle('/rooms',{method:'POST',body:JSON.stringify({name:'New',capacity:4})}),e=>e.status===403);
  a.actor='admin';a.handle('/rooms',{method:'POST',body:JSON.stringify({name:'New',capacity:4})});
  assert.equal(a.rooms.length,4);assert.equal(b.rooms.length,3);
});
test('past and invalid intervals are rejected',()=>{
  const s=new DemoStore();assert.throws(()=>s.reserve(body(s,-2)),e=>e.status===422);
  assert.throws(()=>s.reserve({...body(s),ends_at:'invalid'}),e=>e.status===422);
});
