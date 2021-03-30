import {House, HouseProperties, HouseState} from "../src/domain/House";
import "mocha"
import {assert} from "chai"

describe('House', () => {

    it('Should not overwrite first seen timestamp when scraping', () => {
        const url = "some url"
        const properties: HouseProperties = {
            address: "",
            created: 0,
            deposit: 0,
            description: "",
            firstSeenTimestamp: 0,
            lastSeenTimestamp: 0,
            postcode: 1000,
            price: 0,
            rooms: 0,
            squareMeters: 0,
            state: HouseState.Active,
            timesStateToggled: 0,
            title: ""
        }
        const house : House = new House(url, properties)
        const scrape : HouseProperties = {
            address: "",
            created: 0,
            deposit: 0,
            description: "",
            firstSeenTimestamp: 10,
            lastSeenTimestamp: 15,
            postcode: 1000,
            price: 0,
            rooms: 0,
            squareMeters: 0,
            state: undefined,
            timesStateToggled: 0,
            title: ""
        }
        const scrapedHouse = new House(url, scrape)

        house.updateFromNewScrape(scrapedHouse)
        assert(house.properties.firstSeenTimestamp === properties.firstSeenTimestamp)



    });

});
