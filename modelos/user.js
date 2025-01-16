const { Schema, model } = require('mongoose')

const user = new Schema({
    name: { type: String, required: true },
    credito: { type: Number, required: true },
    valores: { type: Array, required: true },
    loadHistory: { type: Array, required: true }
})

module.exports = model('user', user)