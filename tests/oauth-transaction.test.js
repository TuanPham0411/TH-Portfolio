import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import http from 'node:http';
import {oauthRouter} from '../server/oauth.js';

async function callback(t,{rejectCommit=false}={}){
 const original=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify(url.includes('/token')?{access_token:'fixture-access'}:{email:'owner@example.test',email_verified:true,name:'Owner'}));
 t.after(()=>{globalThis.fetch=original;});
 const calls=[];let released=0;
 const pool={query(){throw Error('OAuth must use one checked-out transaction');},connect:async()=>({
  async query(sql){
   calls.push(sql);
   if(sql==='COMMIT'&&rejectCommit)throw Object.assign(Error('Drive acknowledgement unavailable'),{status:503});
   return {rows:sql.startsWith('insert into portfolio.users')?[{id:'existing-owner'}]:[]};
  },release(){released++;}
 })};
 const app=express();app.locals.sites={portfolio:'https://th.io.vn',mes:'https://mes.th.io.vn'};
 app.use(cookieParser());app.use('/api/oauth',oauthRouter(pool));
 app.use((error,req,res,next)=>res.status(error.status||500).json({error:error.message}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const result=await new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:'/api/oauth/callback?state=fixture-state&code=fixture-code',headers:{Host:'th.io.vn',Cookie:'oauth_state=fixture-state; oauth_verifier=fixture-verifier'}},res=>{
   res.resume();res.on('end',()=>resolve({status:res.statusCode,cookies:res.headers['set-cookie']||[],location:res.headers.location}));
  });req.on('error',reject);req.end();
 });
 return {result,calls,released};
}

test('OAuth account update and session replacement commit once before issuing the login cookie',async t=>{
 const {result,calls,released}=await callback(t);
 assert.equal(result.status,302);assert.equal(result.location,'/');
 assert.equal(calls[0],'BEGIN');assert.equal(calls.at(-1),'COMMIT');assert.equal(calls.filter(sql=>sql==='COMMIT').length,1);
 assert.ok(calls[1].startsWith('insert into portfolio.users'));assert.ok(calls[2].startsWith('delete from portfolio.sessions'));assert.ok(calls[3].startsWith('insert into portfolio.sessions'));
 assert.ok(result.cookies.some(cookie=>cookie.startsWith('th_portfolio=')));assert.equal(released,1);
});
test('failed Drive acknowledgement rolls back session replacement and issues no login cookie',async t=>{
 const {result,calls,released}=await callback(t,{rejectCommit:true});
 assert.equal(result.status,503);assert.equal(calls.at(-1),'ROLLBACK');assert.equal(released,1);
 assert.ok(!result.cookies.some(cookie=>cookie.startsWith('th_portfolio=')));
});
