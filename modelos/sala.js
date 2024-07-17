const {Schema, model} = require('mongoose')
const user = require('./user')

const sala = new Schema({
    name: {type: String, required: true},
    apuesta: {type: Number, required: true},
    partida: {type: Number, default: 1}, //Toda la partida arranca jugando el mismo
    usuarios: [{
        name: {type: String},
        creditos: {type: Number},
        juega: {type: Boolean, default: false}, //Para saber a quien le toca tirar
        valores: {type: Array}, //Estas son las cartas
        jugada: {type: Array}, //Esas son cada una de las jugadas (cada carta tirada)
        tantosPartida: {type: Number, default: 0}, //Estos serían los tantos particulares de cada partida (se vacía cada vez que se reparten las cartas).
        canto: {type: String, default: 'noHay'}, //Este es para saber si estamos en truco, re o vale cua
        tantos: {type: Number,  default: 0}, //Estos son los puntos generales
        puedeCantar: {type: boolean, default: true}, //
        id:{type: Schema.ObjectId, ref: user}}]
})

module.exports = model('sala', sala)