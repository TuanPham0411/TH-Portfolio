import express from 'express';
import cookieParser from 'cookie-parser';
import {rateLimit} from 'express-rate-limit';
import pg from 'pg';
import {resolve} from 'node:path';
import {runtimeSites,hostOf} from './sites.js';
import {sameOrigin} from './security.js';
import {portfolioRouter} from './portfolio.js';
import {oauthRouter} from './oauth.js';
export function createApp(pool,filesRoot,{webRoot=process.env.PORTFOLIO_WEB_ROOT,sites=runtimeSites()}={}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',(process.env.TRUST_PROXY||'loopback').split(','));app.locals.sites=sites;
 app.use((req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(![hostOf(sites.portfolio),'localhost','127.0.0.1'].includes(req.hostname))return res.sendStatus(400);next();});
 app.get('/api/health',async(req,res)=>{await pool.query('select 1');res.json({ok:true,service:'th-portfolio'});});
 app.use('/api',sameOrigin,cookieParser(),rateLimit({windowMs:60000,limit:180,standardHeaders:'draft-7',legacyHeaders:false}));
 const authLimit=rateLimit({windowMs:900000,limit:30,standardHeaders:'draft-7',legacyHeaders:false});
 app.use('/api/oauth',authLimit,oauthRouter(pool));app.use(express.json({limit:'1mb'}));
 app.use((req,res,next)=>['login','register','reset','consumeToken'].includes(req.body?.action)?authLimit(req,res,next):next());
 app.use('/api/portfolio',portfolioRouter(pool,filesRoot));
 app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
 if(webRoot){app.use(express.static(resolve(webRoot)));app.get('/',(req,res)=>res.sendFile(resolve(webRoot,'index.html')));}
 app.use((err,req,res,next)=>{if(res.headersSent)return next(err);const status=err.status||503;if(status===503)console.error('Portfolio request failed',{code:err.code||'internal'});res.status(status).json({error:err.expose?err.message:'Request failed. Check credentials, permissions and input.'});});return app;
}
if(process.env.NODE_ENV!=='test'){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL must be configured');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:4,connectionTimeoutMillis:5000,options:'-c statement_timeout=15000'});pool.on('error',()=>console.error('Database connection interrupted'));
 const app=createApp(pool,process.env.FILES_ROOT||'/data/files');const server=app.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1');server.requestTimeout=180000;
 const cleanup=setInterval(()=>pool.query('delete from portfolio.sessions where expires<now();delete from portfolio.tokens where expires<now()').catch(()=>{}),3600000);cleanup.unref();
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(cleanup);server.close(()=>pool.end().then(()=>process.exit(0)));});
}
