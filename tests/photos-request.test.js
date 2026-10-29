import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../site/portfolio-admin.js',import.meta.url),'utf8');
function requestWith(fetch){
 const helper=source.slice(source.indexOf('export async function contentRequest'),source.indexOf('const labels=')).replace('export ','');
 const context=vm.createContext({fetch,Headers});
 vm.runInContext(helper,context);
 return context.contentRequest;
}
test('Photos session, polling, selection and imports send parsable JSON',async()=>{
 const received=[];
 const request=requestWith(async(url,options)=>{
  assert.equal(options.credentials,'same-origin');
  assert.equal(options.headers.get('content-type'),'application/json');
  received.push([url,JSON.parse(options.body)]);
  return {ok:true,json:async()=>({ready:true})};
 });
 for(const action of ['session','poll','items','import']){
  await request('photos/'+action,{method:'POST',body:JSON.stringify({id:'picker-session',itemId:'image'})});
 }
 assert.equal(received.length,4);
 assert.equal(received[1][1].id,'picker-session');
});
test('Existing headers survive and server errors are shown',async()=>{
 const request=requestWith(async(url,options)=>{
  assert.equal(options.headers.get('content-type'),'application/custom+json');
  assert.equal(options.headers.get('x-request'),'test');
  return {ok:false,json:async()=>({error:'Picker session expired'})};
 });
 await assert.rejects(request('photos/poll',{method:'POST',body:'{}',headers:{'Content-Type':'application/custom+json','X-Request':'test'}}),/Picker session expired/);
});
