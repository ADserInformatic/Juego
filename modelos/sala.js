const {Schema, model} = require('mongoose')
const user = require('./user')

const sala = new Schema({
    name: {type: String, required: true},
    apuesta: {type: Number, required: true},
    usuarios: [{type: Schema.ObjectId, ref: user}]
})

module.exports = model('sala', sala)