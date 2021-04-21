import NEDB from "nedb";
import config from "./config";

export interface Log {
    type: string,
    houseId: string,
    verb: string,
    payload: object,
    timestamp: number
}

export enum LogType {Info= "INFO", Error="ERROR"}

export enum LogVerbs {
    NEW_LINK_FOUND = "NEW_LINK_FOUND",
    HOUSE_WILL_BE_SCRAPED = "HOUSE_WILL_BE_SCRAPED",
    HOUSE_WAS_SCRAPED = "HOUSE_WAS_SCRAPED",
    ERROR_SCRAPING_HOUSE = "ERROR_SCRAPING_HOUSE",
    HOUSE_WAS_CREATED = "HOUSE_WAS_CREATED",
    ERROR_CREATING_HOUSE = "ERROR_CREATING_HOUSE",
    HOUSE_WAS_SCRAPED_AGAIN = "HOUSE_WAS_SCRAPED_AGAIN",
    HOUSE_WAS_UPDATED = "HOUSE_WAS_UPDATED",
    HOUSE_TIMESTAMP_WAS_UPDATED = "HOUSE_TIMESTAMP_WAS_UPDATED",
}

export const createLogRepository = () => {
    return new LogRepository(config.LOG_PATH)
}

class LogRepository{
    private db: NEDB;
    constructor(db_path) {
        this.db = new NEDB({
                filename: db_path,
                autoload: true
            })
        this.add = this.add.bind(this)
    }

    add(document){
        this.db.insert(document)
    }
}