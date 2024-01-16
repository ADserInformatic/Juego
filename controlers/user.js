const user = require('../modelos/user')

const getUser = async (req, res)=>{
    const users = await user.find({})
    try {
        res.json({
            error: false,
            data: users,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}

const saveUser = async (req, res)=>{
    console.log(req.body)
    const {name, credito, valores} = req.body
    const save = await user.create({name, credito, valores})
    try {
        res.json({
            error: false,
            data: save,
            mensaje: 'La solicitud ha sido resuelta exitosamente'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }
}

module.exports = {getUser, saveUser}