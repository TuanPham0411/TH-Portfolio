import pg from 'pg';import {readdir,readFile} from 'node:fs/promises';import {dirname,join} from 'node:path';
async function main(){
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});const db=await pool.connect();
try{await db.query('select pg_advisory_lock(74529082)');await db.query('create table if not exists public.portfolio_schema_migrations(name text primary key)');for(const name of (await readdir(join(dirname(process.argv[1]),'migrations'))).filter(x=>x.endsWith('.sql')).sort()){
 if((await db.query('select 1 from public.portfolio_schema_migrations where name=$1',[name])).rowCount)continue;
 await db.query('begin');try{await db.query(await readFile(join(dirname(process.argv[1]),'migrations',name),'utf8'));await db.query('insert into public.portfolio_schema_migrations values($1)',[name]);await db.query('commit');}catch(e){await db.query('rollback');throw e;}
}await db.query('revoke all on schema portfolio from public;grant usage on schema portfolio,extensions to th_api;grant select,insert,update,delete on all tables in schema portfolio to th_api;');}finally{await db.query('select pg_advisory_unlock(74529082)');db.release();await pool.end();}

}
main().catch(()=>{console.error("Portfolio migration failed");process.exitCode=1;});
