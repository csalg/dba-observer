import {House, HouseState, IHouseDAO} from "./domain/House";
import {Sequelize, DataTypes} from "sequelize";
import config from "./config";

export class HouseSQLDAO implements IHouseDAO {
    private connection: Sequelize;
    private table: any;

    constructor() {
        this.connection = new Sequelize({
            dialect: 'sqlite',
            storage: config.DB_PATH
        })
        this.table = this.connection.define("house", houseSchema)
        this.connection.sync({})

        this.add = this.add.bind(this)
        this.addMany = this.addMany.bind(this)
        this.findActive = this.findActive.bind(this)
        this.update = this.update.bind(this)
        this.updateMany = this.updateMany.bind(this)
    }


    async add(house: House): Promise<void> {
        const existingHouseWithId = await this.find(house.id)
        console.log(existingHouseWithId)
        if (existingHouseWithId) {
            throw "Entity already exists. Use the update method!"
        }
        const tuple = HouseSQLDAO.houseToTuple(house)
        this.table.create(tuple)
    }

    async find(id: string) : Promise<House> {
        const query = await this.table.findByPk(id)
        if (query) {
            return HouseSQLDAO.tupleToHouse(query.dataValues)
        }
        return null
    }

    private static houseToTuple(house: House){
        return {id: house.id, ...house.properties}
    }

    async addMany(houses: Array<House>): Promise<void> {
        console.log("Will addMany houses")
        await Promise.all(houses.map(this.add))
    }

    async update(house: House): Promise<void> {
        if (!this.table){
            throw "Table is undefined!"
        }
        console.log(`Updating house with id ${house.id}`)
        const tuple = HouseSQLDAO.houseToTuple(house)
        console.log(tuple)
        this.table.update(tuple, {where: {id:tuple.id}})
        console.log(`Updated`)
    }

    async updateMany(houses: Array<House>): Promise<void> {
        await Promise.all(houses.map(this.update))
        
    }

    async findActive(): Promise<House[]> {
        const queryResults = await this.table.findAll({where: {state: HouseState.Active}})
        console.log(`Query returned ${queryResults.length} results`)
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
    lastSeenTimestamp: {type: DataTypes.INTEGER},
    timesStateToggled: {type: DataTypes.INTEGER},
}