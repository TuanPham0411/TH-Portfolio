import test from 'node:test';import assert from 'node:assert/strict';
import {ensureStudioProject} from '../site/portfolio-model.js';
test('Studio project is added once without changing existing projects',()=>{const original=[{id:'custom',title:'My original project',public:false}],result=ensureStudioProject(original);assert.equal(result[0].id,'agent-studio');assert.equal(result[0].url,'https://ai.th.io.vn');assert.equal(result[0].public,true);assert.deepEqual(result[1],original[0]);assert.equal(ensureStudioProject(result),result);});
test('user-edited Studio entries keep their title, visibility and content',()=>{const custom=[{id:'custom-studio',url:'https://ai.th.io.vn/',title:'Custom title',public:false}];assert.equal(ensureStudioProject(custom),custom);});
