const { Schema, model } = require('mongoose')

const admin = new Schema({
               name: { type: String, required: true },
               password: { type: Number, required: true },
               earningsHistory: { type: Array, required: true },
})

module.exports = model('admin', admin)