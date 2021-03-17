export class House {
    constructor(
        readonly id : string,
        private _properties : HouseProperties,
        ){
            if (_properties.price < 0 ||
                _properties.deposit < 0 ||
                _properties.rooms < 0 ||
                _properties.squareMeters < 0 ||
                _properties.firstSeenTimestamp < 0 ||
                _properties.lastSeenTimestamp < 0
            ){
                throw "Invalid values found!"
            }
            if (!(1000 <= _properties.postcode && _properties.postcode < 10000 )){
                throw "Postcode should be between 1000 and 10000"
            }
    }

    updateLastSeenTimestamp(newTimestamp: number) {
        if (!(this._properties.lastSeenTimestamp < newTimestamp)) {
            throw "Cannot update timestamp with an older timestamp!"
        }
        this._properties.lastSeenTimestamp = newTimestamp;
    }

    deactivate(){
        this._properties.state = HouseState.Inactive;
    }

    get properties(){
        return this._properties
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

export enum HouseState {
    Inactive = "INACTIVE",
    Active = "ACTIVE"
}


export interface IHouseDAO {
    add(house: House): Promise<void>
    addMany(houses: Array<House>): void
    update(house: House) : void
    updateMany(houses: Array<House>)
    findActive(): Promise<Array<House>>
}