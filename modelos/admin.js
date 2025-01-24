const { Schema, model } = require('mongoose')

const actividadSchema = new Schema({
               tipo: { type: String, required: true },
               fecha: { type: Date, required: true },
               detalles: { type: String, required: true },
});
const admin = new Schema({
               name: { type: String, required: true },
               password: { type: String, required: true },
               earningsHistory: { type: [actividadSchema], required: true },
})

module.exports = model('Admin', admin)