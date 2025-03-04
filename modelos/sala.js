const { Schema, model } = require('mongoose')
const user = require('./user')


const sala = new Schema({
    name: { type: String, required: true },
    apuesta: { type: Number, required: true },
    partida: { type: Number, default: 1 }, //Toda la partida arranca jugando el mismo
    unaFalta: { type: Boolean, default: true },
    finish: { type: Boolean, default: true },
    partidaFinalizada: { type: Boolean, default: false },
    cantosenmano: {
        boolEnvido: { type: Boolean, default: false },
        boolReEnvido: { type: Boolean, default: false },
        boolRealEnvido: { type: Boolean, default: false },
        boolFaltaEnvido: { type: Boolean, default: false },
        boolFlor: { type: Boolean, default: false },
        boolFlorFlor: { type: Boolean, default: false },
        boolFlorMeAchico: { type: Boolean, default: false },
        boolContraFlor: { type: Boolean, default: false },
        boolTruco: { type: Boolean, default: false },
        boolReTruco: { type: Boolean, default: false },
        boolValeCuatro: { type: Boolean, default: false },
        pardaPrimera: { type: Boolean, default: false },
        faltaRespuesta: { type: Boolean, default: false },// booleano si no contestaron
        canto: { type: String, require: false },// cual fue el ultimo canto
        respuesta: { type: String, require: false },// 
        jugador: { type: String, require: false },// jugador que falta contestar
        puntosDevolver: { type: Number, required: false },//puntos que se devuelven si tenia cantora y tiro todas o carta indebida
        posGanMentira: { type: Number, required: false },//posicion del jugador que gano la mentira
        florNegada: { type: Boolean, default: false }
    },

    usuarios: [{
        name: { type: String },
        creditos: { type: Number },
        juega: { type: Boolean, default: false }, //Para saber a quien le toca tirar
        valores: { type: Array }, //Estas son las cartas
        aMostrar: { type: Array }, //Estas son las cartas que se muestran al final x mentir o cantora
        noTirar: { type: Array }, //Esta es la carta que si niega y miente no debo mostrar
        jugada: { type: Array }, //Esas son cada una de las jugadas (cada carta tirada)
        puntosMentira: { type: Number, default: 0 },//puntos de la mentira de cada partida
        //canto: { type: String, default: 'noHay' }, //Este es para saber si estamos en truco, re o vale cua
        tantos: { type: Number, default: 0 }, //Estos son los puntos generales
        puedeCantar: { type: Boolean, default: true }, //true si no se canto truco o si tiene el quiero
        puedeMentir: { type: Boolean, default: true },//true si aun no tiro una carta o si tiene el quiero
        id: { type: Schema.ObjectId, ref: user },
        mano: { type: Boolean, default: false }, //true si el jugador es mano,
        puedeFlor: { type: Boolean, default: false },//true si puede cantar flor
        tieneFlor: { type: Boolean, default: false },//true si tiene flor
        cantoFlor: { type: Boolean, default: false },//si canto flor o la dejo pasar
        ganoPrimera: { type: Boolean, default: false }, //quien gano primera 

    }]

})

module.exports = model('sala', sala)     