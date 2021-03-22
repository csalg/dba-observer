export default {
    DB_PATH: process.env['DB_PATH'] || "./db.sqlite",
    DBA_PAGE_URL: process.env['DBA_PAGE_URL'] || 'https://www.dba.dk/boliger/lejebolig/lejelejlighed/?pris=(4000-8000)&soegfra=1051&radius=15',
    MAX_PAGES_TO_PARSE: parseInt(process.env['MAX_PAGES_TO_PARSE']) || 100,
    SECONDS_BETWEEN_SCRAPES: parseInt(process.env['SECONDS_BETWEEN_SCRAPES']) || 600
}