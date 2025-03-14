const { Schema, model } = require('mongoose')

const actividadSchema = new Schema({
               montoBefore: { type: Number, required: false },
               montoCurrently: { type: Number, required: false },
               montoCobrado: { type: Number, required: false },
               fecha: { type: String, required: false },
               comentario: { type: String, required: false },

});
const admin = new Schema({
               name: { type: String, required: true },
               password: { type: String, required: true },
               earning: { type: Number, required: true },
               earningsHistory: { type: [actividadSchema], required: true },
})

module.exports = model('Admin', admin)