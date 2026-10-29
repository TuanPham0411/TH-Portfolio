import {renameTicketProjects} from '../site/portfolio-model.js';
export async function upgradeTicketProject(pool){
 const db=await pool.connect();
 try{
  await db.query('begin');
  await db.query('select pg_advisory_xact_lock(74529101)');
  const {rows:[row]}=await db.query("select data from portfolio.content where id='main' for update");
  if(row&&Array.isArray(row.data.projects)){
   const projects=renameTicketProjects(row.data.projects);
   if(JSON.stringify(projects)!==JSON.stringify(row.data.projects))
    await db.query("update portfolio.content set data=jsonb_set(data,'{projects}',$1::jsonb),version=version+1,updated_at=now() where id='main'",[JSON.stringify(projects)]);
  }
  await db.query('commit');
 }catch(error){await db.query('rollback');throw error;}finally{db.release();}
}
