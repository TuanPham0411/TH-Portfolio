// Preserve the existing Pi database/session/media configuration during separation.
process.env.HOST='127.0.0.1';process.env.PORT='3001';process.env.PORTFOLIO_ORIGIN='https://th.io.vn';process.env.PORTFOLIO_WEB_ROOT=new URL('./dist/web/',import.meta.url).pathname;
if(!process.env.DATABASE_URL||!process.env.FILES_ROOT)throw Error('Existing Pi runtime configuration is required');
await import('./dist/server/app.cjs');
