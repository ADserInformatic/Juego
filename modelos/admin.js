const { Schema, model } = require('mongoose')

const actividadSchema = new Schema({
               monto: { type: String, required: true },
               fecha: { type: Date, required: true },
               comentario: { type: String, required: true },
});
const admin = new Schema({
               name: { type: String, required: true },
               password: { type: String, required: true },
               earning: { type: Number, required: true },
               earningsHistory: { type: [actividadSchema], required: true },
})

module.exports = model('Admin', admin)