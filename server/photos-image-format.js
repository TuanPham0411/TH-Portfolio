import {isHeic} from './heic-format.js';
// Google Photos may transcode downloads independently of the original metadata.
export function photosImageType(bytes){
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(bytes.length>=6&&['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6)))return 'image/gif';
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 if(isHeic(bytes))return 'image/heic';
 return null;
}
export function photosImageName(value,type){
 const ext={'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp','image/heic':'.heic'}[type];
 const name=String(value||'Google Photos image').slice(0,180);
 return ext?name.replace(/\.(?:jpe?g|png|gif|webp|hei[cf])$/i,'').slice(0,180-ext.length)+ext:name;
}
