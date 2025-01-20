const user = require('../modelos/user')

const getUser = async (req, res) => {
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

const saveUser = async (req, res) => {
    console.log(req.body)
    const { name, credito, valores } = req.body
    const save = await user.create({ name, credito, valores })
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
const addUser = async (req, res) => {
    const { name, credito, passAdmin } = req.body

    //CORROBORAR PASS DEL ADMINISTRADOR

    let CreditBefore = 0;
    let CreditAfter = credito;
    let passUser = "123456Aa";
    letloadHistory = [
        {
            Carga: credito,
            CreditBefore: CreditBefore,
            CreditAfter: CreditAfter,
            Date: new Date()
        }
    ]
    const save = await user.create({ name, credito, passUser, loadHistory })
    try {
        await save.save();
        res.json({
            error: false,
            data: save,
            mensaje: 'Usuario CREADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}

const addCredit = async (req, res) => { //ver donde tengo el id
    let idUser = req.params.id;
    let usuario = await user();
    const { name, credito, passAdmin } = req.body

    //CORROBORAR PASS DEL ADMINISTRADOR

    letloadHistory = [
        {
            Carga: credito,
            CreditBefore: 0,
            CreditAfter: CreditBefore + Carga,
            Date: new Date()
        }
    ]
    const save = await user.create({ name, credito, passUser, loadHistory })
    try {
        await save.save();
        res.json({
            error: false,
            data: save,
            mensaje: 'Usuario CREADO EXITOSAMENTE'
        })
    } catch (e) {
        res.json({
            error: true,
            mensaje: `El servidor devuelve el siguiente error ${e}`
        })
    }

}





module.exports = { getUser, saveUser, addUser, addCredit }