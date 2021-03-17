import {House, HouseState, IHouseDAO} from "./domain/House";
import {Sequelize, DataTypes} from "sequelize";
import config from "./config";

export class HouseSQLDAO implements IHouseDAO {
    private connection: Sequelize;
    private table: any;

    constructor() {
        this.connection = new Sequelize({
            dialect: 'sqlite',
            storage: config.PATH
        })
        this.table = this.connection.define("house", houseSchema)
        this.connection.sync({})

        this.add = this.add.bind(this)
        this.addMany = this.addMany.bind(this)
    }


    async add(house: House): Promise<void> {
        const existingHouseWithId = await this.table.findByPk(house.id)
        console.log(existingHouseWithId)
        if (existingHouseWithId) {
            throw "Entity already exists. Use the update method!"
        }
        const tuple = HouseSQLDAO.houseToTuple(house)
        this.table.create(tuple)
    }

    private static houseToTuple(house: House){
        return {id: house.id, ...house.properties}
    }

    addMany(houses: Array<House>): void {
        houses.map(this.add)
    }

    update(house: House): void {
    }

    updateMany(houses: Array<House>) {
    }

    async findActive(): Promise<House[]> {
        const queryResults = await this.table.findAll({where: {state: HouseState.Active}})
        const houses = queryResults.map(result => HouseSQLDAO.tupleToHouse(result.dataValues))
        return houses
    }

    private static tupleToHouse(tuple){
        const id = tuple.id
        let properties = Object.assign({},tuple)
        delete properties.id
        return new House(id, properties)
    }
}

const STRING = {type: DataTypes.STRING}
    , INTEGER = {type: DataTypes.INTEGER}
const houseSchema = {
    id: {type: DataTypes.STRING, primaryKey: true},
    title: {type: DataTypes.STRING},
    description: {type: DataTypes.STRING},
    created: {type: DataTypes.INTEGER},
    price: {type: DataTypes.INTEGER},
    deposit: {type: DataTypes.INTEGER},
    address: {type: DataTypes.STRING},
    postcode: {type: DataTypes.INTEGER},
    rooms: {type: DataTypes.INTEGER},
    squareMeters: {type: DataTypes.INTEGER},
    state: {type: DataTypes.STRING},
    firstSeenTimestamp: {type: DataTypes.INTEGER},
    lastSeenTimestamp: {type: DataTypes.INTEGER}
}