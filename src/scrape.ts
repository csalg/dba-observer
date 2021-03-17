import {House} from "./domain/House";
import XRay from 'x-ray';
const x = XRay()

const main = async () => {
    const scrapedLinks: Array<string> = await scrapeLinksFromDba()
    const activeHouses : Array<House> = []
    const currentTimestamp = Date.now()

    const scrapedLinksToUnseenHouses: Array<string> = findLinksNotInActiveHouses(scrapedLinks, activeHouses)
    const newHouses = await createHousesFromLinks(scrapedLinksToUnseenHouses)
    console.log(newHouses)

    makeHousesWithOldTimestampInactive(currentTimestamp, activeHouses)
}


const scrapeLinksFromDba = async () => {
    const response = await x('https://www.dba.dk/boliger/lejebolig/lejelejlighed/antalvaerelser-2/?pris=(4000-8000)&soegfra=2860&radius=7', '.dbaListing', [
        {
            link: '.mainContent>.listingLink@href',
        }
    ])
        .paginate('.pagination-right>ul>li:last-child>a@href')
        .limit(100)
    return response.map(scrapedLink => scrapedLink.link)

}


const findLinksNotInActiveHouses = (links: Array<string>, houses: Array<House>) => links.filter(link => {
        const existingHousesWithLink = houses.filter(house => house.id === link)
        return existingHousesWithLink.length === 0
    })


const createHousesFromLinks = async links => await Promise.all(links.map(async url => {
    const tableSelector = (x:number,y:number) => `table.table>tbody>tr:nth-child(${x})>td:nth-child(${y})`

    return await x(url, "#content", {
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
    }
))


const makeHousesWithOldTimestampInactive = (currentTimestamp, activeHouses) => {
    const housesNoLongerOnline = activeHouses.filter(house => house.lastSeenTimestamp < currentTimestamp)
    housesNoLongerOnline.forEach(house => house.deactivate())
}


main().then(() => console.log("Done"))