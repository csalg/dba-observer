import {House, HouseProperties, HouseState, IHouseDAO} from "./domain/House";
import XRay from 'x-ray';
import {HouseSQLDAO} from "./db";
import config from "./config";
import {internalLog} from "./util";
import moment from "moment";

const x = XRay()
const scrape_url = pageNumber => `https://www.dba.dk/boliger/lejebolig/lejelejlighed/side-${pageNumber}/?pris=(4000-8000)&soegfra=1051&radius=15`

const main = async () => {
        try {
            await mainProcedure(null)
        } catch(error) {
            await internalLog(`Error while attempting to run procedure: ${error}`)
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
    await dao.updateMany(activeHousesOnDb)

    const newLinks: Array<string> = findLinksNotInActiveHouses(scrapedLinks, activeHousesOnDb)
    await internalLog(`Out of all the online houses, ${newLinks.length} links are new.`)
    const newHouses: House[] = await createHousesFromLinks(currentTimestamp, newLinks)
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
    const numberOfPages = parseInt(numberOfPagesString)
    // const numberOfPages = 1
    const linksFromPages = await  Promise.all(Array.from(new Array(numberOfPages), (x,i) => i+1).map(scrapeLinksFromDbaPage))
    return Array.from(new Set(Array.prototype.concat(...linksFromPages)))
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
        created = createdStringToDate(scrapedData.created, timestamp)
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

export const createdStringToDate = (createdString, currentTimestamp) => {
    const currentDatetime = new Date(currentTimestamp)
    const isToday = createdString.toLowerCase().search('i dag') !== -1
        , isYesterday = createdString.toLowerCase().search('i går') !== -1
    if (isToday || isYesterday) {
        const [hours, minutes] = createdString
            .split("kl. ")
            .pop()
            .split(".")
            .map(x => parseInt(x))
        currentDatetime.setHours(hours)
        currentDatetime.setMinutes(minutes)
        if (isYesterday) {
            currentDatetime.setDate(currentDatetime.getDate() - 1)
        }
        return currentDatetime.getTime()
    }

    const parsableString : string = createdString
        .replace("kl.", new Date().getFullYear().toString())
        .replace(". ", " ")
        .replace(".", ":")
    let result = moment.utc(parsableString);
    if (!result.valueOf()){
        return currentTimestamp
    }
    console.log(result)
    result.set("year", currentDatetime.getFullYear())

    if (result.unix()*1000 > currentTimestamp){
        result.subtract(1, 'year')
    }

    return result.unix()*1000
}

const findHousesWhichAreNoLongerOnline = (currentTimestamp, activeHouses) => {
    return activeHouses.filter(house => house.properties.lastSeenTimestamp < currentTimestamp)
}

main().then(() => process.exit())
