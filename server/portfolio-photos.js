import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {mkdir,open,rm,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {dirname} from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {hash} from './security.js';
import {filePath,storageQuota} from './storage.js';
import {brokerRequest,brokerStream} from './th-storage/client.mjs';
import {photosImageType,photosImageName} from './photos-image-format.js';
import {normalizeHeicFile} from './heic-upload.js';
const fail=(status,message)=>Object.assign(new Error(message),{status,expose:true});
const config=()=>({application:'portfolio',socketPath:process.env.TH_STORAGE_SOCKET,token:process.env.TH_STORAGE_TOKEN});
const cookie={httpOnly:true,secure:true,sameSite:'lax',path:'/api/portfolio/content/photos',maxAge:600000};
export function portfolioPhotosRouter(pool,root){
 const router=Router();
 router.use(async(req,res,next)=>{
  const {rows:[user]}=await pool.query('select u.id from portfolio.users u join portfolio.sessions s on s.uid=u.id where s.hash=$1 and s.expires>now() and u.admin and u.verified',[hash(req.cookies.th_portfolio||'')]);
  if(!user)throw fail(403,'Administrator required');req.photosOwner=user;
  if(process.env.TH_STORAGE_MODE!=='drive-first')throw fail(503,'Google Photos requires the TH-Server storage service');next();
 });
 const binding=req=>hash(req.cookies.th_portfolio||'');
 const request=(action,value)=>brokerRequest(config(),'/v1/photos/'+action,value);
 router.get('/status',async(req,res)=>res.json(await request('status',{})));
 router.get('/connect',async(req,res)=>{const result=await request('start',{binding:binding(req)});res.cookie('th_photos_state',result.state,cookie);res.redirect(result.url);});
 router.get('/callback',async(req,res)=>{
  if(typeof req.query.state!=='string'||req.cookies.th_photos_state!==req.query.state||typeof req.query.code!=='string')throw fail(400,'Invalid Photos OAuth state');
  res.clearCookie('th_photos_state',cookie);await request('callback',{binding:binding(req),state:req.query.state,code:req.query.code});res.set('Referrer-Policy','no-referrer').type('html').send('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Photos đã kết nối</title><body style="font:18px system-ui;max-width:640px;margin:12vh auto;padding:24px"><h1>Google Photos đã kết nối thành công</h1><p>Quay lại tab chỉnh sửa Portfolio đang mở và bấm “Choose from Google Photos” để chọn ảnh. Nội dung đang chỉnh sửa vẫn ở tab đó.</p><button type="button" onclick="window.close()" style="font:inherit;padding:12px">Đóng tab này</button><script>history.replaceState(null,"","/?photos=connected");if(typeof BroadcastChannel!=="undefined"){const channel=new BroadcastChannel("th-portfolio-photos");channel.postMessage({type:"connected"});channel.close();}</script></body></html>');
 });
 router.post('/session',async(req,res)=>res.json(await request('session',{binding:binding(req)})));
 router.post('/poll',async(req,res)=>{if(typeof req.body.id!=='string')throw fail(400,'Invalid selection');res.json(await request('poll',{id:req.body.id,binding:binding(req)}));});
 router.post('/items',async(req,res)=>{if(typeof req.body.id!=='string')throw fail(400,'Invalid selection');res.json(await request('items',{id:req.body.id,binding:binding(req)}));});
 router.post('/import',async(req,res)=>{
  if(typeof req.body.id!=='string'||req.body.id.length>300||typeof req.body.itemId!=='string'||req.body.itemId.length>300||typeof req.body.name!=='string')throw fail(400,'Choose an image with Google Photos Picker');
  const id=randomUUID();let path;
  try{
   const incoming=await brokerStream(config(),'/v1/photos/download',{id:req.body.id,itemId:req.body.itemId,binding:binding(req)});
   let type=incoming.headers['content-type']?.split(';')[0];
   if(!['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'].includes(type)){incoming.destroy();throw fail(400,'Choose JPG, PNG, WebP, GIF or HEIC images');}
   path=await filePath(root,`portfolio/${id}`,true);await mkdir(dirname(path),{recursive:true});let size=0;
   await pipeline(incoming,new Transform({transform(chunk,encoding,callback){size+=chunk.length;callback(size>12*1024*1024?fail(413,'Google Photos images are limited to 12 MB'):null,chunk);}}),createWriteStream(path,{flags:'wx',mode:0o600}));
   const file=await open(path,'r');const bytes=Buffer.alloc(16);try{await file.read(bytes,0,16,0);}finally{await file.close();}
   type=photosImageType(bytes);
   if(!type)throw fail(400,'Google Photos returned an unsupported image. Choose JPG, PNG, WebP, GIF or HEIC.');
   const heic=type==='image/heic';
   let name=photosImageName(req.body.name,type);
   if(heic){const converted=await normalizeHeicFile(path);type=converted.type;size=converted.size;name=name.replace(/\.hei[cf]$/i,'').slice(0,176)+'.jpg';}
   else size=(await stat(path)).size;
   const db=await pool.connect();
   try{
    await db.query('BEGIN');await db.query('select pg_advisory_xact_lock(74529101)');
    const {rows:[used]}=await db.query('select coalesce(sum(size),0)::bigint as size from portfolio.media');
    if(Number(used.size)+size>Math.min(storageQuota(),2*1024**3))throw fail(413,'Portfolio media storage limit reached');
    await db.query('insert into portfolio.media(id,type,size,name,created_by,ready,storage_source) values($1,$2,$3,$4,$5,true,'google-photos')',[id,type,size,name,req.photosOwner.id]);
    await db.query('insert into portfolio.photos_references(media_id,photos_id,picker_session,original_name) values($1,$2,$3,$4)',[id,req.body.itemId,req.body.id,name]);
    await db.query('COMMIT');
   }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
   res.status(201).json({id,type,name,source:'google-photos',backedUpToDrive:false,cachedOnServer:true});
  }catch(error){if(path)await rm(path,{force:true});throw error;}
 });
 return router;
}
