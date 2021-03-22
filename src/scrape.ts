import {House, HouseProperties, HouseState, IHouseDAO} from "./domain/House";
import XRay from 'x-ray';
import {HouseSQLDAO} from "./db";
import config from "./config";
import moment from "moment";
import {internalLog} from "./util";

const x = XRay()
const scrape_url = pageNumber => `https://www.dba.dk/boliger/lejebolig/lejelejlighed/side-${pageNumber}/?pris=(4000-8000)&soegfra=1051&radius=15`

const main = async () => {
    const delay = ms => new Promise(res => setTimeout(res, ms));
    while (true){
        await mainProcedure(null)
        await delay(config.SECONDS_BETWEEN_SCRAPES * 1000)
    }
}

const mainProcedure = async (dao: IHouseDAO) => {
    if (!dao) {
        dao = new HouseSQLDAO()
    }
    await internalLog("Will scrape links")
    const scrapedLinks: Array<string> = await scrapeLinksFromDba()
    await internalLog(`Found ${scrapedLinks.length} houses online.`)
    const activeHousesOnDb : Array<House> = await dao.findActive()
    await internalLog(`Found ${activeHousesOnDb.length} active houses on the database.`)
    const currentTimestamp = Date.now()
    await internalLog("Updating timestamps of active houses which are online.")
    updateTimestampIfHouseInLinks(currentTimestamp, scrapedLinks, activeHousesOnDb)

    const newLinks: Array<string> = findLinksNotInActiveHouses(scrapedLinks, activeHousesOnDb)
    await internalLog(`Out of all the online houses, ${newLinks.length} links are new.`)
    const newHouses: House[] = await createHousesFromLinks(currentTimestamp, newLinks.slice(0,2))
    await internalLog(`Parsed ${newHouses.length} new houses.`)
    await upsertNewHousesToDb(dao, newHouses)

    const housesNoLongerOnline : House[]= findHousesWhichAreNoLongerOnline(currentTimestamp, activeHousesOnDb)
    await internalLog(`Found ${housesNoLongerOnline.length} houses no longer online. Will update database.`)
    housesNoLongerOnline.forEach(house => house.deactivate())
    await dao.updateMany(housesNoLongerOnline)
    await internalLog('Done')
}


const scrapeLinksFromDba = async () => {
    const numberOfPagesString = await x(scrape_url(1), ".pagination-right>ul>li:nth-last-child(2)")
    // const numberOfPages = parseInt(numberOfPagesString)
    const numberOfPages = 1
    const linksFromPages = await  Promise.all([...Array(numberOfPages)].map(scrapeLinksFromDbaPage))
    return Array.prototype.concat(...linksFromPages)
}

const scrapeLinksFromDbaPage = async (page) => {
    const url = scrape_url(page)
    const response = await x(url, '.dbaListing', [
        {
            link: '.mainContent>.listingLink@href',
        }
    ])
    return response.map(scrapedLink => scrapedLink.link)

}

function updateTimestampIfHouseInLinks(currentTimestamp: number, links: string[], activeHouses: Array<House>) {
    activeHouses.forEach(house => {
        const filteredLinks = links.filter(link => link === house.id)
        if (filteredLinks.length){
           house.updateLastSeenTimestamp(currentTimestamp)
        }
    })
}

const findLinksNotInActiveHouses = (links: Array<string>, houses: Array<House>) => (
    links.filter(link => {
        const existingHousesWithLink = houses.filter(house => house.id === link)
        return existingHousesWithLink.length === 0
    })
)


const createHousesFromLinks= async (timestamp, links) => {
    const dataFromHousePagesArr = await scrapeDataFromHousePages(links)
    const result = []
    dataFromHousePagesArr.forEach(
        scrapedData => {
            try {
                result.push(createHouseFromScrapedData(timestamp, scrapedData))
            } catch(err) {
                console.log("Error creating house from scraped data");
                console.log(scrapedData);
                console.log(err)
            }
        }
    )
    return result
}


const scrapeDataFromHousePages = async links => {
    const result = [];
    for (const url of links) {
        try {
            await internalLog(`Will scrape data for ${url}`)
            const basicProperties = await x(url, "#content", {
                title: ".vip-heading>.row-fluid>h1",
                description: ".vip-additional-text",
                created: ".heading-small",
                price: ".price-tag"
            })
            const propertiesParsedFromTable = await parsePropertiesFromTable(url)
            result.push({url: url, ...basicProperties, ...propertiesParsedFromTable})
            await internalLog(`Successfully scraped data for ${url}`)
        } catch {
            console.log(`Could not parse ${url}`)
        }
    }
    return result
}

const parsePropertiesFromTable= async (url: string) => {
    const tds : Array<any> = await x(url, 'td', [{val:""}])
    const result = {
        postcode: "0",
        deposit: "0",
        address: "",
        rooms: "0",
        squareMeters: "0"
    }
    for (let i=0; i!=tds.length-1; i++){
        const key = tds[i]['val']
            , val = tds[i+1]['val']
        switch(key) {
            case "Postnr.":
                result.postcode = val;
                break;
            case "Depositum":
                result.deposit = val;
                break;
            case "Adresse":
                result.address = val
                break;
            case "Antal værelser":
                result.rooms = val;
                break;
            case "Boligkvm.":
                result.squareMeters = val;
                break;
        }
    }
    return result
}

async function upsertNewHousesToDb(dao: IHouseDAO, newHouses: House[]) {
    for (const newHouse of newHouses){
        const existingHouse = await dao.find(newHouse.id)
        if (existingHouse){
            existingHouse.activate()
            existingHouse.updateFromNewScrape(newHouse)
            await dao.update(existingHouse)
        } else {
            await dao.add(newHouse)
        }
    }
}

const createHouseFromScrapedData = (timestamp, scrapedData) => {
    let created = timestamp;
    try {
        created = createdStringToDate(scrapedData.created)
    } catch(err) {}

    const properties: HouseProperties = {
        address: scrapedData.address,
        created: created,
        description: scrapedData.description,
        firstSeenTimestamp: timestamp,
        lastSeenTimestamp: timestamp,
        postcode: parseInt(scrapedData.postcode),
        price:    parseInt(scrapedData.price.replace(" kr.", "").replace(".", "")),
        deposit:  parseInt(scrapedData.deposit.replace(".", "")),
        rooms:    parseInt(scrapedData.rooms),
        squareMeters: parseInt(scrapedData.squareMeters),
        state: HouseState.Active,
        title: scrapedData.title,
        timesStateToggled: 0
    }
    return new House(scrapedData.url, properties)
}

const createdStringToDate = (createdString) => {
    const parsableString = createdString
        .replace("kl.", new Date().getFullYear().toString())
        .replace(". ", " ")
        .replace(".", ":")
    let result = moment(parsableString);
    return result.unix()
}


const findHousesWhichAreNoLongerOnline = (currentTimestamp, activeHouses) => {
    return activeHouses.filter(house => house.properties.lastSeenTimestamp < currentTimestamp)
}

main()
