import {House, HouseProperties, HouseState, IHouseDAO} from "./domain/House";
import XRay from 'x-ray';
import {HouseSQLDAO} from "./db";
import config from "./config";
import moment from "moment";


const x = XRay()

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
    const scrapedLinks: Array<string> = await scrapeLinksFromDba()
    const activeHousesOnDb : Array<House> = await dao.findActive()
    const currentTimestamp = Date.now()
    updateTimestampIfHouseInLinks(currentTimestamp, scrapedLinks, activeHousesOnDb)

    const newLinks: Array<string> = findLinksNotInActiveHouses(scrapedLinks, activeHousesOnDb)
    const newHouses: House[] = await createHousesFromLinks(currentTimestamp, newLinks)
    await upsertNewHousesToDb(dao, newHouses)

    const housesNoLongerOnline : House[]= findHousesWhichAreNoLongerOnline(currentTimestamp, activeHousesOnDb)
    housesNoLongerOnline.forEach(house => house.deactivate())
    // console.log(`Will deactivate ${housesNoLongerOnline.length} houses no longer online`)
    await dao.updateMany(housesNoLongerOnline)
}


const scrapeLinksFromDba = async () => {
    const response = await x(config.DBA_PAGE_URL, '.dbaListing', [
        {
            link: '.mainContent>.listingLink@href',
        }
    ])
        .paginate('.pagination-right>ul>li:last-child>a@href')
        .limit(config.MAX_PAGES_TO_PARSE)
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
    return dataFromHousePagesArr.map(scrapedData => createHouseFromScrapedData(timestamp, scrapedData))
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

const scrapeDataFromHousePages = async links => {
    const result = [];
    for (const url of links) {
        try {
            const basicProperties = await x(url, "#content", {
                title: ".vip-heading>.row-fluid>h1",
                description: ".vip-additional-text",
                created: ".heading-small",
                price: ".price-tag"
            })
            const propertiesParsedFromTable = await parsePropertiesFromTable(url)
            result.push({url: url, ...basicProperties, ...propertiesParsedFromTable})
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
