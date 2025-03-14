const { Schema, model } = require('mongoose')



const user = new Schema({
    name: { type: String, required: true },
    credito: { type: Number, required: true },
    password: { type: String, required: true },
    loadHistory: { type: Array, required: true },  //historial de cargas
    passChanged: { type: Boolean, required: true, default: false },

})

module.exports = model('user', user)