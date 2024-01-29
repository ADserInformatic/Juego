const {Schema, model} = require('mongoose')

const carta = new Schema({
    name: {type: String, required: true},
    valor: {type: Number, required: true}
})

module.exports = model('carta', carta)