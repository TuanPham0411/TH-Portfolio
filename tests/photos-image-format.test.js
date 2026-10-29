import test from 'node:test';
import assert from 'node:assert/strict';
import {photosImageType,photosImageName} from '../server/photos-image-format.js';
test('Photos JPEG downloads use actual bytes even when original was HEIC or PNG',()=>{
 const jpeg=Buffer.from([255,216,255,224,0,16,74,70,73,70,0,0,0,0,0,0]);
 assert.equal(photosImageType(jpeg),'image/jpeg');
 assert.equal(photosImageName('iPhone.HEIC',photosImageType(jpeg)),'iPhone.jpg');
 assert.equal(photosImageName('image.png',photosImageType(jpeg)),'image.jpg');
});
test('Supported formats are distinguished and non-image responses are rejected',()=>{
 assert.equal(photosImageType(Buffer.from([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(photosImageType(Buffer.from('GIF89a')),'image/gif');
 assert.equal(photosImageType(Buffer.from('RIFF0000WEBP')),'image/webp');
 assert.equal(photosImageType(Buffer.from('0000ftypheic0000')),'image/heic');
 for(const bytes of [Buffer.alloc(0),Buffer.from('<html>Sign in</html>'),Buffer.from('{"error":true}'),Buffer.from('RIFF0000WAVE')])assert.equal(photosImageType(bytes),null);
});
