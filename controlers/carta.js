const carta = require('../modelos/carta')

const getCards = async (req, res)=>{
    const cards = await carta.find({})
    try {
        res.json({
            error: false,
            data: cards,
            mensaje: 'La solicitud fue exitosa'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `Error: ${e}`
        })
    }
}

const saveCard = async (req, res)=>{
    const {name, valor} = req.body
    const guardar = await carta.create({name, valor})
    try {
        res.json({
            error: false,
            data: guardar,
            mensaje: 'Se guardó correctamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `Error: ${e}`
        })
    }
}

module.exports = {saveCard, getCards}