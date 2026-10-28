process.env.HOST||='0.0.0.0';process.env.PORTFOLIO_WEB_ROOT=new URL('./dist/web/',import.meta.url).pathname;process.env.FILES_ROOT||='/data/files';
if(!process.env.DATABASE_URL||!process.env.PORTFOLIO_ORIGIN)throw Error('DATABASE_URL and PORTFOLIO_ORIGIN must be configured');
await import('./dist/server/app.cjs');
