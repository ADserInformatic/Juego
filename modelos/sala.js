const {Schema, model} = require('mongoose')
const user = require('./user')

const sala = new Schema({
    name: {type: String, required: true},
    apuesta: {type: Number, required: true},
    usuarios: [{
        name: {type: String},
        valores: {type: Array}, //Estas son las cartas
        jugada: {type: Array}, //Esas son cada una de las jugadas (cada carta tirada)
        tantosPartida: {type: Number, default: 0}, //Estos serían los tantos particulares de cada partida (se vacía cada vez que se reparten las cartas).
        tantos: {type: Number}, //Estos son los puntos generales
        id:{type: Schema.ObjectId, ref: user}}]
})

module.exports = model('sala', sala)