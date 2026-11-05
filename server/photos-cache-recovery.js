import {lstat,link,rm} from 'node:fs/promises';
import {filePath} from './storage.js';
import {dirname} from 'node:path';

const fail=(status,message)=>Object.assign(Error(message),{status,expose:true});
export async function missingPhotos(root,rows){
 const missing=[];
 for(const row of rows){
  if(!/^[a-f0-9-]{36}$/.test(row.id))throw fail(409,'Invalid stored photo reference');
  const path=await filePath(root,`portfolio/${row.id}`,true);
  try{if((await lstat(dirname(path))).isSymbolicLink())throw fail(409,'Photo cache directory cannot be a symlink');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  try{
   const info=await lstat(path);
   if(info.isSymbolicLink()||!info.isFile()||info.size!==Number(row.size))throw fail(409,'Existing photo cache differs; preserved for inspection');
  }catch(error){if(error.code==='ENOENT')missing.push({...row,path});else throw error;}
 }
 return missing;
}

export async function restorePhotoCache({root,rows,source,persist}){
 const missing=await missingPhotos(root,rows),published=[];
 if(!missing.length)return {restoredIds:[],skipped:rows.length};
 try{
  for(const row of missing){await link(source.path,row.path);published.push(row.path);}
  await persist(missing);
  return {restoredIds:missing.map(row=>row.id),skipped:rows.length-missing.length};
 }catch(error){
  for(const path of published)await rm(path,{force:true});
  throw error;
 }
}
