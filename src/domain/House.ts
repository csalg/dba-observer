export class House {
    private constructor(
        readonly id : string,
        private properties : HouseProperties,
        ){
            if (properties.price < 0 ||
                properties.deposit < 0 ||
                properties.rooms < 0 ||
                properties.squareMeters < 0 ||
                properties.firstSeenTimestamp < 0 ||
                properties.lastSeenTimestamp < 0
            ){
                throw "Invalid values found!"
            }
            if (!(1000 <= properties.postcode && properties.postcode < 10000 )){
                throw "Postcode should be between 1000 and 10000"
            }
    }

    updateLastSeenTimestamp(timestamp: number) {
        if (!(this.properties.lastSeenTimestamp < timestamp)) {
            throw "Cannot update timestamp with an older timestamp!"
        }
        this.properties.lastSeenTimestamp = timestamp;
    }

    deactivate(){
        this.properties.state = HouseState.Inactive;
    }

}

export interface HouseProperties {
    title : string,
    description : string,
    created : number,
    price : number,
    deposit : number,
    address : string,
    postcode : number,
    rooms: number,
    squareMeters : number,
    state: HouseState,
    firstSeenTimestamp: number,
    lastSeenTimestamp: number
}

enum HouseState {
    Inactive = "INACTIVE",
    Active = "ACTIVE"
}


export interface IHouseDAO {
    add(house: House): void
    addMany(houses: Array<House>): void
    update(house: House) : void
    updateMany(houses: Array<House>)
}