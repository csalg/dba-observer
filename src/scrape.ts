import {House, HouseProperties, HouseState, IHouseDAO} from "./domain/House";
import XRay from 'x-ray';
import {HouseSQLDAO} from "./db";
import config from "./config";
import moment from "moment";


const x = XRay()

const main = async () => {
    const delay = ms => new Promise(res => setTimeout(res, ms));
    while (true){
        await mainProcedure(null).then(() => console.log("Done"))
        await delay(config.SECONDS_BETWEEN_SCRAPES * 1000)
        console.log("Finished waiting")
    }
}


const mainProcedure = async (dao: IHouseDAO) => {
    if (!dao) {
        dao = new HouseSQLDAO()
    }
    const scrapedLinks: Array<string> = await scrapeLinksFromDba()
    const activeHouses : Array<House> = await dao.findActive()
    const currentTimestamp = Date.now()

    const scrapedLinksToUnseenHouses: Array<string> = findLinksNotInActiveHouses(scrapedLinks, activeHouses)
    const newHouses: House[] = await createHousesFromLinks(currentTimestamp, scrapedLinksToUnseenHouses)
    console.log(`Houses currently on dba ${scrapedLinks.length}, active houses ${activeHouses.length}, new houses: ${newHouses.length}`)
    dao.addMany(newHouses)

    makeHousesWithOldTimestampInactive(currentTimestamp, activeHouses)
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


const findLinksNotInActiveHouses = (links: Array<string>, houses: Array<House>) => links.filter(link => {
        const existingHousesWithLink = houses.filter(house => house.id === link)
        return existingHousesWithLink.length === 0
    })


const createHousesFromLinks= async (timestamp, links) => {
    const dataFromHousePagesArr = await scrapeDataFromHousePages(links)
    return dataFromHousePagesArr.map(scrapedData => createHouseFromScrapedData(timestamp, scrapedData))
}


const scrapeDataFromHousePages = async links => await Promise.all(links.map(async url => {
    const tableSelector = (x:number,y:number) => `table.table>tbody>tr:nth-child(${x})>td:nth-child(${y})`
    const result = await x(url, "#content", {
            title:       ".vip-heading>.row-fluid>h1",
            description: ".vip-additional-text",
            created:     ".heading-small",
            price:       ".price-tag",
            deposit:     tableSelector(1, 5),
            address:     tableSelector(2, 2),
            postcode:    tableSelector(3, 2),
            rooms:       tableSelector(4, 2),
            squareMeters: tableSelector(5, 2),
        })
    result.url = url
    return result
    }
))


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
        price: parseInt(scrapedData.price.replace(" kr.", "")),
        deposit: parseInt(scrapedData.deposit.replace(".", "")),
        rooms: parseInt(scrapedData.rooms),
        squareMeters: parseInt(scrapedData.squareMeters),
        state: HouseState.Active,
        title: scrapedData.title,
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


const makeHousesWithOldTimestampInactive = (currentTimestamp, activeHouses) => {
    const housesNoLongerOnline = activeHouses.filter(house => house.lastSeenTimestamp < currentTimestamp)
    housesNoLongerOnline.forEach(house => house.deactivate())
}

main()
