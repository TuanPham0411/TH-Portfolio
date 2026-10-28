import {build} from 'esbuild';import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
for(const [entry,name]of [['index','app'],['migrate','migrate'],['heic-worker','heic-worker']])await build({entryPoints:[`server/${entry}.js`],bundle:true,platform:'node',target:'node22',format:'cjs',external:['pg-native'],outfile:`dist/server/${name}.cjs`});
await cp('server/migrations','dist/server/migrations',{recursive:true});


await build({entryPoints:['server/storage-operator.js'],bundle:true,platform:'node',target:'node22',format:'cjs',external:['pg-native'],outfile:'dist/server/storage-operator.cjs'});
await cp('server/th-storage/capture.sql','dist/server/storage-capture.sql');
