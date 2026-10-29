import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultPortfolio,validatePortfolio,normalizePortfolio,publicPortfolio,referencedMedia} from '../site/portfolio-model.js';
test('milestones, events and nested galleries retain more than eight media',()=>{
 const data=structuredClone(defaultPortfolio);
 const media=Array.from({length:100},(_,i)=>'photo-'+i);
 data.journey[0].media=media;
 data.activities=[{id:'event',title:'Event',subtitle:'',description:'',tags:[],media,public:true}];
 data.mediaDescriptions={};
 data.mediaDescriptions[media[0]]={title:'Album',description:'',media:['nested-photo']};
 const saved=validatePortfolio(data),visible=publicPortfolio(saved);
 assert.deepEqual(visible.journey[0].media,media);
 assert.deepEqual(visible.activities[0].media,media);
 assert.equal(referencedMedia(visible).has('nested-photo'),true);
 saved.mediaDescriptions[media[0]].media=media;
 assert.doesNotThrow(()=>validatePortfolio(saved));
 saved.activities[0].media.push(123);
 assert.throws(()=>validatePortfolio(saved),/Invalid tags or media/);
});
test('stored MES project becomes TH-Ticket without losing custom content or photos',()=>{
 const data=structuredClone(defaultPortfolio);
 data.projects=[{id:'mes-ticket',title:'MES Ticket',name:'MES Ticket',subtitle:'Custom subtitle',description:'MES Ticket for my team',tags:['MES','Custom'],media:['photo-1'],public:false,url:'https://mes.th.io.vn',source:'old'}];
 const value=normalizePortfolio(data),p=value.projects[0];
 assert.equal(p.title,'TH-Ticket');assert.equal(p.name,'TH-Ticket');
 assert.equal(p.url,'https://ticket.th.io.vn');assert.equal(p.source,'https://github.com/TuanPham0411/TH-Ticket');
 assert.equal(p.subtitle,'Custom subtitle');assert.deepEqual(p.media,['photo-1']);assert.equal(p.public,false);
 assert.equal(data.projects[0].title,'MES Ticket');
 assert.deepEqual(normalizePortfolio(value),value);
});
