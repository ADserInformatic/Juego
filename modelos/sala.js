const { Schema, model } = require('mongoose')
const user = require('./user')

const sala = new Schema({
    name: { type: String, required: true },
    apuesta: { type: Number, required: true },
    partida: { type: Number, default: 1 }, //Toda la partida arranca jugando el mismo
    unaFalta: { type: Boolean, default: true },
    cantosenmano: {
        boolenvido: { type: Boolean, default: false },
        boolreenvido: { type: Boolean, default: false },
        boolrealenvido: { type: Boolean, default: false },
        boolfaltaenvido: { type: Boolean, default: false },
        boolflor: { type: Boolean, default: false },
        boolflorflor: { type: Boolean, default: false },
        boolflormeachico: { type: Boolean, default: false },
        boolcontraflor: { type: Boolean, default: false },
        booltruco: { type: Boolean, default: false },
        boolretruco: { type: Boolean, default: false },
        boolvalecuatro: { type: Boolean, default: false },
        pardaprimera: { type: Boolean, default: false },

    },
    usuarios: [{
        name: { type: String },
        creditos: { type: Number },
        juega: { type: Boolean, default: false }, //Para saber a quien le toca tirar
        valores: { type: Array }, //Estas son las cartas
        jugada: { type: Array }, //Esas son cada una de las jugadas (cada carta tirada)
        tantosPartida: { type: Number, default: 0 }, //Estos serían los tantos particulares de cada partida (se vacía cada vez que se reparten las cartas).
        puntosMentira: { type: Number, default: 0 },//puntos de la mentira de cada partida
        //canto: { type: String, default: 'noHay' }, //Este es para saber si estamos en truco, re o vale cua
        tantos: { type: Number, default: 0 }, //Estos son los puntos generales
        puedeCantar: { type: Boolean, default: true }, //true si no se canto truco o si tiene el quiero
        puedeMentir: { type: Boolean, default: true },//true si aun no tiro una carta o si tiene el quiero
        id: { type: Schema.ObjectId, ref: user },
        mano: { type: Boolean, default: false }, //true si el jugador es mano,
        puedeflor: { type: Boolean, default: false },//true si puede cantar flor
        ganoPrimera: { type: Boolean, default: false }, //quien gano primera 

    }]

})

module.exports = model('sala', sala)