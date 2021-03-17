export default {
    PATH: process.env['PATH'] || "./db.sqlite",
    DBA_PAGE_URL: process.env['DBA_PAGE_URL'] || 'https://www.dba.dk/boliger/lejebolig/lejelejlighed/antalvaerelser-2/?pris=(4000-8000)&soegfra=2860&radius=7',
    MAX_PAGES_TO_PARSE: parseInt(process.env['MAX_PAGES_TO_PARSE']) || 100,
    SECONDS_BETWEEN_SCRAPES: parseInt(process.env['SECONDS_BETWEEN_SCRAPES']) || 600
}