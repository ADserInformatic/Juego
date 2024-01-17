const {Schema, model} = require('mongoose')
const user = require('./user')

const sala = new Schema({
    name: {type: String, required: true},
    apuesta: {type: Number, required: true},
    usuarios: [{
        name: {type: String},
        valores: {type: Array},
        jugada: {type: Array},
        id:{type: Schema.ObjectId, ref: user}}]
})

module.exports = model('sala', sala)