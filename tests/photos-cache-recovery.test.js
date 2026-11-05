import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import {missingPhotos,restorePhotoCache} from '../server/photos-cache-recovery.js';
import {portfolioPhotosRouter} from '../server/portfolio-photos.js';

async function files(t){
 const root=await mkdtemp(join(tmpdir(),'photos-recovery-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'portfolio'));return root;
}
test('missing caches restore under existing IDs and preserve already present files',async t=>{
 const root=await files(t),ids=[randomUUID(),randomUUID()],source=join(root,'selected');await writeFile(source,'new');
 await writeFile(join(root,'portfolio',ids[1]),'old');
 const rows=ids.map(id=>({id,size:3}));let persisted;
 const result=await restorePhotoCache({root,rows,source:{path:source},persist:async values=>{persisted=values;}});
 assert.deepEqual(result.restoredIds,[ids[0]]);assert.equal(result.skipped,1);assert.equal(persisted[0].id,ids[0]);
 assert.equal(await readFile(join(root,'portfolio',ids[0]),'utf8'),'new');assert.equal(await readFile(join(root,'portfolio',ids[1]),'utf8'),'old');
});
test('failed metadata acknowledgement removes only files published by this attempt',async t=>{
 const root=await files(t),id=randomUUID(),source=join(root,'selected');await writeFile(source,'new');
 await assert.rejects(restorePhotoCache({root,rows:[{id,size:3}],source:{path:source},persist:async()=>{throw Error('Drive unavailable');}}),/Drive unavailable/);
 await assert.rejects(lstat(join(root,'portfolio',id)),{code:'ENOENT'});assert.equal(await readFile(source,'utf8'),'new');
});
test('corrupt existing caches and symlinks are preserved rather than overwritten',async t=>{
 const root=await files(t),id=randomUUID(),path=join(root,'portfolio',id);await writeFile(path,'original');
 await assert.rejects(missingPhotos(root,[{id,size:2}]),/preserved/);assert.equal(await readFile(path,'utf8'),'original');
 await rm(path);await symlink(join(root,'unrelated'),path);
 await assert.rejects(missingPhotos(root,[{id,size:2}]),/preserved/);assert.ok((await lstat(path)).isSymbolicLink());
});
test('recovery reports missing old references without attempting Drive downloads',async t=>{
 const root=await files(t),id=randomUUID();const missing=await missingPhotos(root,[{id,size:100,name:'existing image'}]);
 assert.equal(missing.length,1);assert.equal(missing[0].id,id);
 await assert.rejects(missingPhotos(root,[{id:'../outside',size:1}]),/Invalid stored photo/);
});

test('authenticated recovery reuses the old media ID, never inserts media or changes content',async t=>{
 const root=await files(t),id=randomUUID(),socket=join(root,'broker.sock');
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 let downloads=0,authorized=true;const updates=[];
 const broker=http.createServer((req,res)=>{downloads++;res.setHeader('Content-Type','image/png');res.end(bytes);});
 await new Promise(resolve=>broker.listen(socket,resolve));t.after(()=>new Promise(resolve=>broker.close(resolve)));
 const old={mode:process.env.TH_STORAGE_MODE,socket:process.env.TH_STORAGE_SOCKET,token:process.env.TH_STORAGE_TOKEN};
 process.env.TH_STORAGE_MODE='drive-first';process.env.TH_STORAGE_SOCKET=socket;process.env.TH_STORAGE_TOKEN='fixture';
 t.after(()=>{for(const [key,value] of [['TH_STORAGE_MODE',old.mode],['TH_STORAGE_SOCKET',old.socket],['TH_STORAGE_TOKEN',old.token]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 const pool={query:async(sql,values)=>{
  if(sql.startsWith('select u.id'))return {rows:authorized?[{id:'owner'}]:[]};
  if(sql.includes('p.photos_id=$1'))return {rows:values[0]==='original-photo'?[{id,size:bytes.length,photos_id:'original-photo'}]:[]};
  throw Error('Unexpected SQL');
 },connect:async()=>({query:async(sql,values)=>{updates.push({sql,values});return {rows:[]};},release(){}})};
 const app=express();app.use(express.json(),cookieParser());app.use('/photos',portfolioPhotosRouter(pool,root));
 app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const request=itemId=>fetch('http://127.0.0.1:'+server.address().port+'/photos/import',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'th_portfolio=fixture'},body:JSON.stringify({id:'new-picker-session',itemId,name:'original.png',restore:true})});
 const response=await request('original-photo');assert.equal(response.status,200);assert.deepEqual((await response.json()).restoredIds,[id]);
 assert.deepEqual(await readFile(join(root,'portfolio',id)),bytes);assert.equal(downloads,1);
 assert.ok(updates.some(row=>row.sql==='COMMIT'));assert.ok(!updates.some(row=>row.sql.includes('insert into portfolio.media')||row.sql.includes('portfolio.content')));
 assert.equal((await request('unrelated-photo')).status,409);assert.equal(downloads,1);
 authorized=false;assert.equal((await request('original-photo')).status,403);assert.equal(downloads,1);
});
